"""R2 storage backend tests."""

import io


class _FakeR2Client:
    def __init__(self):
        self.uploads = []

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None):
        self.uploads.append({
            'bucket': bucket,
            'key': key,
            'content': fileobj.read(),
            'extra': ExtraArgs or {},
        })

    def download_file(self, bucket, key, target_path):
        with open(target_path, 'wb') as f:
            f.write(b'downloaded-from-r2')

    def delete_object(self, Bucket=None, Key=None):
        return None

    def get_paginator(self, *_args, **_kwargs):
        class _Paginator:
            def paginate(self, **_kwargs):
                return [{'Contents': []}]
        return _Paginator()

    def head_object(self, Bucket=None, Key=None):
        return {'ContentLength': 18}

    def list_objects_v2(self, Bucket=None, Prefix=None):
        return {'Contents': []}

    def generate_presigned_url(self, operation_name, Params=None, ExpiresIn=None):
        return f"https://signed.example.com/{Params['Key']}?ttl={ExpiresIn}"


class TestR2Storage:
    def test_save_file_and_public_url_with_custom_domain(self, monkeypatch):
        fake_client = _FakeR2Client()
        monkeypatch.setattr('services.storage.r2.boto3.client', lambda *args, **kwargs: fake_client)

        from services.storage.r2 import R2Storage

        storage = R2Storage(
            bucket='banana-assets',
            account_id='acc_123',
            access_key_id='key_123',
            secret_access_key='secret_123',
            public_base_url='https://cdn.example.com',
        )

        result = storage.save_file(io.BytesIO(b'hello-r2'), 'projects/demo/image.png')

        assert result == 'projects/demo/image.png'
        assert fake_client.uploads[0]['bucket'] == 'banana-assets'
        assert fake_client.uploads[0]['key'] == 'projects/demo/image.png'
        assert fake_client.uploads[0]['content'] == b'hello-r2'
        assert storage.get_public_url('projects/demo/image.png') == 'https://cdn.example.com/projects/demo/image.png'

    def test_public_url_falls_back_to_signed_url(self, monkeypatch):
        fake_client = _FakeR2Client()
        monkeypatch.setattr('services.storage.r2.boto3.client', lambda *args, **kwargs: fake_client)

        from services.storage.r2 import R2Storage

        storage = R2Storage(
            bucket='banana-assets',
            account_id='acc_123',
            access_key_id='key_123',
            secret_access_key='secret_123',
            signed_url_ttl=900,
        )

        public_url = storage.get_public_url('exports/demo.pdf')
        assert public_url == 'https://signed.example.com/exports/demo.pdf?ttl=900'
