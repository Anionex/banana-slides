---
name: banana-cli
description: >
  CLI tool for creating, managing, and exporting AI-generated presentations via the Banana Slides API.
  Use when the user asks to: (1) generate a PPT/presentation/slides from an idea, outline, or description,
  (2) export a project to PPTX, PDF, or images, (3) batch-generate multiple presentations,
  (4) manage projects, pages, materials, or templates programmatically,
  (5) renovate/redesign an existing PPT or PDF, (6) edit slide images with natural language.
---

# banana-cli

CLI for creating, managing, and exporting AI-generated presentations.

## Environment Check

Before running any command, verify the backend is reachable:

```bash
curl -sf http://localhost:5000/health
```

If this fails, the backend is not running. Read [references/setup.md](references/setup.md) and follow the steps to clone the repo, configure `.env`, and start the backend. Do not proceed until the health check passes.

## Invocation

```bash
banana-cli <command> [options]
```

If `banana-cli` is not on PATH, use `uv run banana-cli` from the project root, or install globally with `uv tool install .`

## End-to-End Workflow

```bash
# 1. Create project and set as working project
result=$(banana-cli --json projects create --creation-type idea --idea-prompt "Your topic")
project_id=$(echo "$result" | jq -r '.data.project_id')
banana-cli projects use "$project_id"

# 2. Generate everything (outline → descriptions → images)
banana-cli workflows full --language zh --pages 8

# 3. Export to local file
banana-cli exports pptx --output ./slides.pptx
```

Once a working project is set, `--project-id` is optional on all subsequent commands.

## Key Patterns

### Short ID prefix matching

All `--project-id` and `--page-id` accept short prefixes (like git short hashes):

```bash
banana-cli projects get a1b2          # matches a1b2c3d4-...
banana-cli pages edit-image --page-id b9c8 --instruction "change title to red"
```

### Working project context

Avoid repeating `--project-id` by setting a working project:

```bash
banana-cli projects use a1b2     # set (accepts prefix)
banana-cli workflows outline      # uses working project
banana-cli projects use           # show current
banana-cli projects unuse         # clear
```

### Page count control

`--pages` is a hint to the AI — actual page count may differ. The CLI warns on stderr when they don't match.

```bash
banana-cli workflows outline --pages 5
banana-cli workflows full --pages 10 --language en
```

### Export with auto-download

```bash
# Download directly to local path
banana-cli exports pptx --output ./slides.pptx
banana-cli exports pdf --output ./report.pdf

# Without --output, returns a server-side download URL
banana-cli exports pptx
```

### Batch generation

```bash
cat > jobs.jsonl << 'EOF'
{"job_id":"t1","job_type":"full_generation","creation_type":"idea","idea_prompt":"AI Intro","language":"zh","export":{"formats":["pptx"]}}
{"job_id":"t2","job_type":"full_generation","creation_type":"idea","idea_prompt":"ML Basics","language":"zh","export":{"formats":["pptx","pdf"]}}
EOF

banana-cli run jobs --file jobs.jsonl --report report.json --state-file state.json
```

### Renovate existing PPT

```bash
banana-cli renovation create --file /absolute/path/to/slides.pptx --language zh
```

### JSON output for scripting

```bash
banana-cli --json projects list | jq '.data.projects[].project_id'
```

## Important Notes

- File path arguments (`--file`, `--image`) require **absolute paths**
- Async tasks (descriptions, images, editable export) **wait by default** and show progress on stderr. Pass `--no-wait` to get a task_id immediately
- `--wait` / `tasks wait` can be interrupted (Ctrl+C) and resumed anytime — backend tasks are unaffected
- Progress lines go to stderr (format: `[PROGRESS] STAGE STATUS completed/total`), keeping stdout JSON clean
- `--help` output is plain text when piped (non-TTY) — safe for agent consumption
- Config priority: CLI args > env vars (`BANANA_CLI_*`) > TOML config (`~/.config/banana-slides/cli.toml`) > defaults

## Discovering Commands

Run `banana-cli --help` for the top-level command list, and `banana-cli <command> --help` for subcommand options. Help output is plain text when piped (non-TTY).
