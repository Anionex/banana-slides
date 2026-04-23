"""Aliyun OSS storage backend tests."""

import io


class _FakeBucket:
    def __init__(self, _auth, _endpoint, _bucket_name):
        self.objects = {}

    def put_object(self, key, payload, headers=None):
        if hasattr(payload, 'seek'):
            payload.seek(0)
        self.objects[key] = payload.read() if hasattr(payload, 'read') else payload

    def get_object(self, key):
        if key not in self.objects:
            raise FileNotFoundError(key)
        return io.BytesIO(self.objects[key])

    def delete_object(self, key):
        self.objects.pop(key, None)

    def object_exists(self, key):
        return key in self.objects

    def get_object_to_file(self, key, path):
        with open(path, 'wb') as handle:
            handle.write(self.objects[key])

    def sign_url(self, method, key, ttl, slash_safe=True):
        return f'https://signed-oss.example.com/{key}?ttl={ttl}'


class _FakeObject:
    def __init__(self, key):
        self.key = key


class _FakeObjectIterator:
    def __init__(self, bucket, prefix=''):
        self.bucket = bucket
        self.prefix = prefix

    def __iter__(self):
        for key in self.bucket.objects:
            if key.startswith(self.prefix):
                yield _FakeObject(key)


class _FakeAuth:
    def __init__(self, access_key_id, access_key_secret):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret


class _FakeOSSModule:
    Auth = _FakeAuth
    Bucket = _FakeBucket
    ObjectIteratorV2 = _FakeObjectIterator


class TestAliyunOSSStorage:
    def test_save_file_and_public_url_with_custom_domain(self, monkeypatch):
        monkeypatch.setattr('services.storage.oss.oss2', _FakeOSSModule)

        from services.storage.oss import AliyunOSSStorage

        storage = AliyunOSSStorage(
            bucket='banana-assets',
            endpoint='oss-cn-hangzhou.aliyuncs.com',
            access_key_id='akid',
            access_key_secret='aksecret',
            public_base_url='https://assets.example.com',
        )

        result = storage.save_file(io.BytesIO(b'hello-oss'), 'projects/demo/image.png')

        assert result == 'projects/demo/image.png'
        assert storage.get_file('projects/demo/image.png') == b'hello-oss'
        assert storage.get_public_url('projects/demo/image.png') == 'https://assets.example.com/projects/demo/image.png'

    def test_public_url_falls_back_to_signed_url(self, monkeypatch):
        monkeypatch.setattr('services.storage.oss.oss2', _FakeOSSModule)

        from services.storage.oss import AliyunOSSStorage

        storage = AliyunOSSStorage(
            bucket='banana-assets',
            endpoint='oss-cn-hangzhou.aliyuncs.com',
            access_key_id='akid',
            access_key_secret='aksecret',
            signed_url_ttl=900,
        )
        storage.save_file(io.BytesIO(b'hello-oss'), 'exports/demo.pdf')

        public_url = storage.get_public_url('exports/demo.pdf')
        assert public_url == 'https://signed-oss.example.com/exports/demo.pdf?ttl=900'
