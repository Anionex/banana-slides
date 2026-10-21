# Shared website GitHub statistics

Website-only implementation for `production/bananaslides-online`.

The homepage renders a verified, timestamped snapshot in its HTML and uses the same
snapshot for hydration. It then fetches `/stats/github.json` from this website.
No browser storage or browser-to-GitHub request is required. Failed/malformed
responses keep the snapshot visible; an older server snapshot cannot replace it.

## Refresh the release seed

From the repository root, run:

```sh
python3 scripts/refresh_website_github_stats.py --output frontend/src/landing/githubStats.snapshot.json
cd frontend && npm run build:online
```

Commit the successful seed with the release. Failed refreshes do not change it.
The online build copies the seed to `dist/stats/github.json`, so standalone builds
also work. A production server mounts the persistent directory over `dist/stats`.

## Production setup

The server uses Python's standard library; no credentials or new package are needed.
Install `scripts/refresh_website_github_stats.py` at
`/opt/banana-website-stats/refresh_website_github_stats.py`. Initialize
`/var/lib/banana-website-stats/github.json` with the successful release seed **only
if missing**, then run the refresh command against that file. Never overwrite an
existing server snapshot during deployment or rollback.

Install the supplied service and timer under `/etc/systemd/system/`, then run:

```sh
systemctl daemon-reload
systemctl enable --now banana-website-stats.timer
systemctl start banana-website-stats.service
systemctl list-timers banana-website-stats.timer
```

Add this read-only directory mount to the website frontend service:

```yaml
volumes:
  - /var/lib/banana-website-stats:/usr/share/nginx/html/stats:ro
```

Mount the directory, not the file: atomic replacement must remain visible to nginx.
The nginx exact-match location returns JSON (or 404), never SPA HTML, with
`Cache-Control: no-cache`. The persistent file survives frontend replacement.
The timer refreshes hourly and after missed schedules at startup. Failed runs
leave the previous file intact and report failure in the systemd journal; the
next scheduled run still proceeds. Publication changes no backend or database.

## Verification

```sh
python3 -m unittest discover -s scripts/tests -p test_website_github_stats.py
cd frontend
npm run test:run -- src/landing/GithubStars.test.tsx
npm run build:online
```

Check first visits with empty storage and GitHub requests blocked, and then with
the same-origin JSON request also blocked: the pre-rendered count must remain.
Verify successful shared JSON replacement, service/timer status, and byte-for-byte
retention of the persistent JSON after a failed refresh. Recreate the candidate
frontend and confirm it still reads the same mounted snapshot. Restore browser
network overrides after testing.
