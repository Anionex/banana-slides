#!/usr/bin/env python3
"""
Migrate local uploads to Alibaba Cloud OSS.

Usage:
    python3 scripts/migrate_to_oss.py \
        --bucket anionex-banana-slides \
        --endpoint https://oss-us-west-1.aliyuncs.com \
        --access-key-id LTAI5t... \
        --access-key-secret h2Gs7... \
        --uploads-dir /root/banana-slides-demo/uploads

    # Dry run (default): shows what would be uploaded
    # Add --execute to actually upload
    python3 scripts/migrate_to_oss.py ... --execute
"""
import argparse
import os
import sys
import time

import oss2


def human_size(size_bytes):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def migrate(args):
    auth = oss2.Auth(args.access_key_id, args.access_key_secret)
    bucket = oss2.Bucket(auth, args.endpoint, args.bucket)

    uploads_dir = os.path.abspath(args.uploads_dir)
    if not os.path.isdir(uploads_dir):
        print(f"Error: uploads directory not found: {uploads_dir}")
        sys.exit(1)

    files = []
    for root, dirs, filenames in os.walk(uploads_dir):
        for filename in filenames:
            full_path = os.path.join(root, filename)
            relative_path = os.path.relpath(full_path, uploads_dir)
            size = os.path.getsize(full_path)
            files.append((full_path, relative_path, size))

    total_size = sum(f[2] for f in files)
    print(f"Found {len(files)} files, total size: {human_size(total_size)}")

    if not args.execute:
        print("\n[DRY RUN] Add --execute to actually upload. First 20 files:")
        for _, rel, size in files[:20]:
            print(f"  {rel} ({human_size(size)})")
        if len(files) > 20:
            print(f"  ... and {len(files) - 20} more")
        return

    uploaded = 0
    skipped = 0
    failed = 0
    uploaded_bytes = 0
    start_time = time.time()

    for i, (full_path, relative_path, size) in enumerate(files):
        key = relative_path.replace('\\', '/')

        if not args.force and bucket.object_exists(key):
            skipped += 1
            continue

        try:
            if size > 100 * 1024 * 1024:
                oss2.resumable_upload(bucket, key, full_path,
                                     part_size=10 * 1024 * 1024,
                                     num_threads=4)
            else:
                with open(full_path, 'rb') as f:
                    bucket.put_object(key, f)

            uploaded += 1
            uploaded_bytes += size
        except Exception as e:
            failed += 1
            print(f"  FAILED: {relative_path} - {e}")

        if (i + 1) % 100 == 0 or i == len(files) - 1:
            elapsed = time.time() - start_time
            pct = (i + 1) / len(files) * 100
            speed = uploaded_bytes / elapsed if elapsed > 0 else 0
            print(f"  [{pct:.0f}%] {i + 1}/{len(files)} files, "
                  f"uploaded: {uploaded}, skipped: {skipped}, failed: {failed}, "
                  f"speed: {human_size(speed)}/s")

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.0f}s: uploaded {uploaded} ({human_size(uploaded_bytes)}), "
          f"skipped {skipped}, failed {failed}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Migrate local uploads to OSS')
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--endpoint', required=True)
    parser.add_argument('--access-key-id', required=True)
    parser.add_argument('--access-key-secret', required=True)
    parser.add_argument('--uploads-dir', required=True)
    parser.add_argument('--execute', action='store_true',
                        help='Actually upload (default is dry run)')
    parser.add_argument('--force', action='store_true',
                        help='Re-upload even if file exists on OSS')
    args = parser.parse_args()
    migrate(args)
