"""Versioned, content-addressed stage commits. Never deserialize executable data."""
from contextlib import contextmanager
from dataclasses import fields, is_dataclass
import hashlib
import json
import os
from pathlib import Path
import threading
import uuid

SCHEMA = 1
FILE_FIELDS = frozenset({'image_path', 'clean_background', 'inpainted_background_path',
                         'root_image_path', 'source', 'candidate', 'full_image', 'path'})


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def sync_file(path):
    # Windows _commit/FlushFileBuffers requires a writable handle. These are
    # owned staging artifacts; opening r+b preserves their existing contents.
    with Path(path).open('r+b' if os.name == 'nt' else 'rb') as stream:
        os.fsync(stream.fileno())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    try:
        with temp.open('w', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
        if os.name != 'nt':
            fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    finally:
        temp.unlink(missing_ok=True)


def encode(value):
    if is_dataclass(value):
        return {'__type__': type(value).__name__,
                'fields': {f.name: encode(getattr(value, f.name)) for f in fields(value)}}
    if type(value).__name__ in ('ExtractionContext', 'ExtractionResult'):
        return {'__type__': type(value).__name__, 'fields': encode(vars(value))}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, tuple):
        return {'__tuple__': [encode(v) for v in value]}
    if isinstance(value, list):
        return [encode(v) for v in value]
    if isinstance(value, dict):
        return {str(k): encode(v) for k, v in value.items()}
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    raise TypeError(f'Unsupported checkpoint type: {type(value).__name__}')


def decode(value):
    if isinstance(value, list):
        return [decode(v) for v in value]
    if not isinstance(value, dict):
        return value
    if '__tuple__' in value:
        return tuple(decode(v) for v in value['__tuple__'])
    if '__type__' in value:
        from services.image_editability.data_models import BBox, EditableElement, EditableImage
        from services.image_editability.text_attribute_extractors import TextStyleResult, ColoredSegment
        from services.image_editability.extractors import ExtractionContext, ExtractionResult
        classes = {c.__name__: c for c in (BBox, EditableElement, EditableImage,
                   TextStyleResult, ColoredSegment, ExtractionContext, ExtractionResult)}
        return classes[value['__type__']](**decode(value['fields']))
    return {k: decode(v) for k, v in value.items()}


def semantic(value, field=None):
    """Paths are input content, never run-specific cache identities."""
    if isinstance(value, Path) or (field in FILE_FIELDS and isinstance(value, str) and Path(value).is_absolute()):
        return {'sha256': file_hash(value)}
    if is_dataclass(value):
        return semantic(encode(value))
    if isinstance(value, (list, tuple)):
        return [semantic(v) for v in value]
    if isinstance(value, dict):
        return {str(k): semantic(v, str(k)) for k, v in value.items()}
    return value


def artifact_paths(value, field=None):
    if isinstance(value, str) and Path(value).is_absolute() and field in FILE_FIELDS:
        yield Path(value).resolve()
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from artifact_paths(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from artifact_paths(item, key)


class CheckpointStore:
    def __init__(self, root, *, ancestors=(), fingerprints=None, emit=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.ancestors = [Path(p).resolve() for p in ancestors]
        self.fingerprints = fingerprints or {}
        self.emit = emit or (lambda event: None)
        self._locks = {}
        self._mutex = threading.Lock()
        self.reused = 0

    def key(self, stage, inputs):
        return digest({'schema': SCHEMA, 'stage': stage, 'version': 1,
                       'config': self.fingerprints.get(stage, {}),
                       'input': semantic(inputs)})

    def load(self, stage, key):
        for root in [self.root, *self.ancestors]:
            try:
                record = json.loads((root / 'nodes' / stage / f'{key}.json').read_text())
                if record.get('invalidated') is True and record.get('key') == key:
                    break  # A terminal remote job must not be resurrected from an ancestor.
                if record['schema'] != SCHEMA or record['key'] != key:
                    continue
                if digest(record['value']) != record['value_hash']:
                    continue
                valid = True
                for path, expected in record['artifacts'].items():
                    artifact = Path(path).resolve()
                    # No checkpoint may cause reads outside owned run directories.
                    if not any(artifact.is_relative_to(p) for p in [self.root, *self.ancestors]):
                        valid = False
                        break
                    if not artifact.is_file() or file_hash(artifact) != expected:
                        valid = False
                        break
                if valid:
                    return decode(record['value'])
            except (OSError, ValueError, KeyError, TypeError):
                continue
        raise KeyError(key)

    def invalidate(self, stage, inputs):
        key = self.key(stage, inputs)
        atomic_json(self.root / 'nodes' / stage / f'{key}.json',
                    {'schema': SCHEMA, 'key': key, 'invalidated': True})

    def commit(self, stage, key, value):
        from .control import check
        check()
        encoded = encode(value)
        if stage in ('background', 'candidate') and (not isinstance(value, str) or not Path(value).is_absolute()):
            raise ValueError('A background checkpoint must reference an owned image file')
        artifacts = {}
        for path in artifact_paths(encoded, 'path' if stage in ('background', 'candidate') else None):
            if not any(path.is_relative_to(p) for p in [self.root, *self.ancestors]):
                raise ValueError('Checkpoint artifact must belong to an export workspace')
            sync_file(path)
            artifacts[str(path)] = file_hash(path)
        check()
        atomic_json(self.root / 'nodes' / stage / f'{key}.json', {
            'schema': SCHEMA, 'key': key, 'stage': stage, 'value': encoded,
            'value_hash': digest(encoded), 'artifacts': artifacts,
        })

    def run(self, stage, inputs, fn, valid=lambda value: value is not None):
        from .control import check, current
        control = current()
        # Hashing, duplicate-node waits and resource waits all use this deadline.
        with control.node(stage) if control else _empty():
            return self._run(stage, inputs, fn, valid)

    def _run(self, stage, inputs, fn, valid):
        from .control import check
        key = self.key(stage, inputs)
        with self._mutex:
            lock = self._locks.setdefault(key, threading.Lock())
        while not lock.acquire(timeout=.05):
            check()
        try:
            check()
            try:
                result = self.load(stage, key)
                if valid(result):
                    with self._mutex:
                        self.reused += 1
                    self.emit({'event': 'checkpoint', 'stage': stage, 'reused': self.reused})
                    return result
            except KeyError:
                pass
            result = fn()
            check()
            if valid(result):
                self.commit(stage, key, result)
            return result
        finally:
            lock.release()


@contextmanager
def _empty():
    yield


def cached(stage, inputs, fn, valid=lambda value: value is not None):
    from .control import current, check
    check()
    control = current()
    if control and control.store:
        return control.store.run(stage, inputs, fn, valid)
    return fn()
