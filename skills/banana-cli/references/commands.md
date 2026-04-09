# banana-cli Command Reference

## Table of Contents

- [Global Options](#global-options)
- [projects](#projects) — CRUD + working project context
- [workflows](#workflows) — AI generation pipeline
- [pages](#pages) — Per-page operations
- [exports](#exports) — PPTX/PDF/image export
- [materials](#materials) — Image material management
- [run](#run) — Batch execution
- [renovation](#renovation) — Renovate existing PPT/PDF
- [styles](#styles) — Style extraction
- [templates](#templates) — Template images
- [refs](#refs) — Reference file management
- [settings](#settings) — Backend settings
- [tasks](#tasks) — Async task polling
- [files](#files) — File download

## Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--base-url URL` | Backend address | `http://localhost:5000` |
| `--access-code CODE` | X-Access-Code header | — |
| `--json` | JSON output (for piping to `jq`) | off |
| `--verbose` | Detailed output | off |
| `--poll-interval N` | Task poll interval (sec) | 2 |
| `--request-timeout N` | Request timeout (sec) | 30 |
| `--config PATH` | TOML config file | `~/.config/banana-slides/cli.toml` |

Config priority: CLI args > env vars (`BANANA_CLI_*`) > TOML config > defaults.

## projects

```
projects list [--limit N] [--offset N]
projects get <project-id-or-prefix>
projects create --creation-type idea|outline|descriptions --idea-prompt "..." [--template-style STR] [--image-aspect-ratio STR]
projects update <project-id> [--data JSON]
projects delete <project-id-or-prefix>
projects use [<project-id-or-prefix>]    # Set working project; no arg = show current
projects unuse                            # Clear working project
```

## workflows

All commands accept `--project-id <id-or-prefix>` (optional if working project is set).

```
workflows outline [--language zh|en|ja|auto] [--pages N] [--refine "..."] [--from-description]
workflows descriptions [--language zh|en|ja|auto] [--max-workers N]
workflows images [--max-workers N] [--use-template|--no-template] [--timeout-sec N]
workflows full [--language zh|en|ja|auto] [--pages N] [--skip-outline] [--skip-descriptions] [--skip-images] [--desc-max-workers N] [--image-max-workers N] [--timeout-sec N]
```

## pages

All commands require `--project-id` (or working project) and `--page-id` where applicable.

```
pages create --project-id <id> [--data JSON]
pages update --project-id <id> --page-id <id> [--part cover|content|transition|ending] [--data JSON]
pages delete --project-id <id> --page-id <id>
pages set-outline --project-id <id> --page-id <id> --data JSON
pages set-description --project-id <id> --page-id <id> --data JSON
pages gen-description --project-id <id> --page-id <id> [--language zh|en|ja|auto]
pages gen-image --project-id <id> --page-id <id> [--use-template|--no-template] [--timeout-sec N]
pages edit-image --project-id <id> --page-id <id> --instruction "..."
pages versions --project-id <id> --page-id <id>
pages set-current --project-id <id> --page-id <id> --version N
pages regenerate-renovation --project-id <id> --page-id <id>
```

## exports

All commands accept `--project-id` (or working project).

```
exports pptx [--project-id <id>]
exports pdf [--project-id <id>]
exports images [--project-id <id>]
exports editable-pptx [--project-id <id>] [--wait] [--timeout-sec N]
```

## materials

```
materials list [--project-id <id>] [--scope project|global]
materials upload --file /absolute/path [--project-id <id>] [--caption "..."]
materials generate --project-id <id> --instruction "..." [--timeout-sec N]
materials associate --project-id <id> --material-id <id>
materials download --project-id <id>
materials delete --material-id <id>
```

Note: `--file` requires **absolute paths**.

## run

```
run jobs --file jobs.jsonl --report report.json [--state-file state.json] [--done-marker-file done.json] [--continue-on-error|--fail-fast] [--timeout-sec N] [--progress-interval-sec N]
run monitor --state-file state.json
```

### JSONL job format

```json
{"job_id":"topic-1","job_type":"full_generation","creation_type":"idea","idea_prompt":"AI Intro","language":"zh","pages":8,"export":{"formats":["pptx"]}}
```

Supported `job_type`: `full_generation`. Export formats: `pptx`, `pdf`, `images`.

## renovation

```
renovation create --file /absolute/path [--language zh|en|ja|auto]
```

Creates a project by analyzing an existing PPT/PDF file.

## styles

```
styles extract --image /absolute/path
```

## templates

```
templates upload --project-id <id> --file /absolute/path
templates delete --project-id <id>
```

## refs

```
refs upload --file /absolute/path [--project-id <id>]
refs list [--project-id <id>]
refs get --ref-id <id>
refs parse --ref-id <id>
refs associate --ref-id <id> --project-id <id>
refs dissociate --ref-id <id> --project-id <id>
refs delete --ref-id <id>
```

## settings

```
settings get
settings update --data JSON
settings reset
settings verify
settings test
settings test-status --task-id <id>
```

## tasks

```
tasks status --task-id <id>
tasks wait --task-id <id> [--timeout-sec N]
```

## files

```
files fetch --url /files/... --output /absolute/path
```
