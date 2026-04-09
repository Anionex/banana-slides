---
name: banana-cli
description: >
  CLI tool for creating, managing, and exporting AI-generated presentations via the Banana Slides API.
  Use when the user asks to: (1) generate a PPT/presentation/slides from an idea, outline, or description,
  (2) export a project to PPTX, PDF, or images, (3) batch-generate multiple presentations,
  (4) manage projects, pages, materials, or templates programmatically,
  (5) renovate/redesign an existing PPT or PDF, (6) edit slide images with natural language.
  Invoke with `uv run banana-cli` from the project root.
---

# banana-cli

Generate, manage, and export AI presentations from the command line.

## Prerequisites

- Backend running (default `http://localhost:5000`)
- Run from the project root (where `pyproject.toml` lives)
- Invoke via `uv run banana-cli`

## End-to-End Workflow

```bash
# 1. Create project and set as working project
result=$(uv run banana-cli --json projects create --creation-type idea --idea-prompt "Your topic")
project_id=$(echo "$result" | jq -r '.data.project_id')
uv run banana-cli projects use "$project_id"

# 2. Generate everything (outline → descriptions → images)
uv run banana-cli workflows full --language zh --pages 8

# 3. Export
uv run banana-cli exports pptx
```

Once a working project is set, `--project-id` is optional on all subsequent commands.

## Key Patterns

### Short ID prefix matching

All `--project-id` and `--page-id` options accept short prefixes (like git short hashes):

```bash
uv run banana-cli projects get a1b2          # matches a1b2c3d4-...
uv run banana-cli pages edit-image --page-id b9c8 --instruction "change title to red"
```

### Working project context

Avoid repeating `--project-id` by setting a working project:

```bash
uv run banana-cli projects use a1b2     # set (accepts prefix)
uv run banana-cli workflows outline      # uses working project
uv run banana-cli projects use           # show current
uv run banana-cli projects unuse         # clear
```

### Page count control

Use `--pages N` to control the number of generated slides:

```bash
uv run banana-cli workflows outline --pages 5
uv run banana-cli workflows full --pages 10 --language en
```

### Batch generation

```bash
cat > jobs.jsonl << 'EOF'
{"job_id":"t1","job_type":"full_generation","creation_type":"idea","idea_prompt":"AI Intro","language":"zh","export":{"formats":["pptx"]}}
{"job_id":"t2","job_type":"full_generation","creation_type":"idea","idea_prompt":"ML Basics","language":"zh","export":{"formats":["pptx","pdf"]}}
EOF

uv run banana-cli run jobs --file jobs.jsonl --report report.json --state-file state.json
```

### Renovate existing PPT

```bash
uv run banana-cli renovation create --file /absolute/path/to/slides.pptx --language zh
```

### JSON output for scripting

Append `--json` for machine-readable output, pipe to `jq`:

```bash
uv run banana-cli --json projects list | jq '.data.projects[].project_id'
```

## Important Notes

- File path arguments (`--file`, `--image`) require **absolute paths**
- Async tasks (descriptions, images, editable export) need `--wait` to block until done
- `--help` output is plain text when piped (non-TTY) — safe for agent consumption
- Config priority: CLI args > env vars (`BANANA_CLI_*`) > TOML config (`~/.config/banana-slides/cli.toml`) > defaults

## Common Commands

| Task | Command |
|------|---------|
| List projects | `uv run banana-cli projects list` |
| Get project | `uv run banana-cli projects get <id>` |
| Generate outline | `uv run banana-cli workflows outline [--pages N]` |
| Refine outline | `uv run banana-cli workflows outline --refine "add section about X"` |
| Full generation | `uv run banana-cli workflows full --language zh --pages 8` |
| Export PPTX | `uv run banana-cli exports pptx` |
| Export PDF | `uv run banana-cli exports pdf` |
| Edit page image | `uv run banana-cli pages edit-image --page-id <pid> --instruction "..."` |
| Upload material | `uv run banana-cli materials upload --file /path/to/img.png` |
| Renovate PPT | `uv run banana-cli renovation create --file /path/to/slides.pptx` |
| Extract style | `uv run banana-cli styles extract --image /path/to/img.png` |
