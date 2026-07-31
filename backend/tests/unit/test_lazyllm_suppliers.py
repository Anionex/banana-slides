"""Tests for deterministic LazyLLM supplier registration and source resolution.

Regression coverage for the PyInstaller-packaged desktop backend where
``pkgutil.iter_modules`` can fail to discover ``lazyllm ... supplier`` modules,
leaving every vendor source unregistered ("Unsupported source: ...").
"""
import subprocess
import sys

import pytest

from services.ai_providers.lazyllm_env import (
    LAZYLLM_SUPPLIER_MODULES,
    ensure_lazyllm_suppliers,
    resolve_lazyllm_source,
)


pytestmark = pytest.mark.unit

# Vendors expected in the chat registry of LazyLLM 0.7.x.
CHAT_VENDORS = (
    'qwen', 'doubao', 'deepseek', 'glm', 'kimi', 'minimax',
    'sensenova', 'siliconflow', 'ppio', 'aiping', 'openai',
)


def _registered_chat_keys():
    import lazyllm
    return sorted(lazyllm.online.chat.keys())


def test_ensure_suppliers_registers_every_vendor():
    imported = ensure_lazyllm_suppliers()
    assert set(imported) == set(LAZYLLM_SUPPLIER_MODULES)

    keys = _registered_chat_keys()
    for vendor in CHAT_VENDORS:
        assert f'{vendor}chat' in keys, f'{vendor} missing from chat registry: {keys}'


def test_known_chat_sources_resolve():
    ensure_lazyllm_suppliers()
    for vendor in CHAT_VENDORS:
        assert resolve_lazyllm_source(vendor) == vendor


def test_image_editing_sources_resolve():
    ensure_lazyllm_suppliers()
    for vendor in ('qwen', 'doubao', 'siliconflow', 'aiping', 'glm', 'minimax'):
        assert resolve_lazyllm_source(vendor, registry_name='text2image') == vendor


def test_unknown_source_raises_descriptive_error():
    ensure_lazyllm_suppliers()
    with pytest.raises(ValueError, match='not registered for chat'):
        resolve_lazyllm_source('no-such-vendor')


def test_resolve_suffix_fallback_with_plain_dict(monkeypatch):
    """LazyLLM's fuzzy LazyDict may be bypassed by a plain dict registry."""
    monkeypatch.setattr(
        'lazyllm.online.chat',
        {'qwenchat': object(), 'glmchat': object()},
    )
    assert resolve_lazyllm_source('qwen') == 'qwen'
    assert resolve_lazyllm_source('glm') == 'glm'


def test_frozen_supplier_discovery_failure_is_recoverable():
    """Simulate a PyInstaller-frozen runtime where pkgutil.iter_modules sees
    no supplier modules; ensure_lazyllm_suppliers() must still register all."""
    code = '''\
import pkgutil

# Pretend the PYZ archive exposes no submodules (PyInstaller frozen behavior).
real_iter_modules = pkgutil.iter_modules
pkgutil.iter_modules = lambda path=None, prefix='': iter(())

import lazyllm
import lazyllm.module.llms.onlinemodule.supplier

empty_before = sorted(lazyllm.online.chat.keys())

from services.ai_providers.lazyllm_env import ensure_lazyllm_suppliers
imported = ensure_lazyllm_suppliers()
keys_after = sorted(lazyllm.online.chat.keys())
expected = sorted([v + 'chat' for v in {vendors!r}])
assert 'qwenchat' not in empty_before, \\
    f'iter_modules patch had no effect: {{empty_before}}'
assert set(imported) == set({vendors!r}), f'imported mismatch: {{imported}}'
assert keys_after == expected, f'registry incomplete: {{keys_after}}'
print('FROZEN_SIM_OK')
'''.format(vendors=list(LAZYLLM_SUPPLIER_MODULES))
    result = subprocess.run(
        [sys.executable, '-c', code],
        cwd=str(__import__('pathlib').Path(__file__).resolve().parents[2]),
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, f'frozen simulation failed:\n{result.stdout}\n{result.stderr}'
    assert 'FROZEN_SIM_OK' in result.stdout
