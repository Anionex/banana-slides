# banana-cli Agent Skill

Use `banana-cli` to create, manage, and export AI-generated presentations via the command line.

## When to Use

- User asks to generate a PPT/presentation/slides from an idea or outline
- User asks to export a project to PPTX, PDF, or images
- User wants batch generation of multiple presentations
- User needs to manage projects, pages, materials, or templates programmatically

## Prerequisites

- Backend must be running (default: `http://localhost:5000`)
- Run from the project root where `pyproject.toml` is located
- Use `uv run banana-cli` to invoke

## Quick Reference

### Create a presentation from an idea

```bash
# 1. Create project and set as working project
result=$(uv run banana-cli --json projects create --creation-type idea --idea-prompt "Your topic here")
project_id=$(echo "$result" | jq -r '.data.project.id')
uv run banana-cli projects use "$project_id"

# 2. Generate everything (outline → descriptions → images)
# --project-id is optional when a working project is set
uv run banana-cli workflows full --language zh --pages 8

# 3. Export
uv run banana-cli exports pptx
```

### Short ID prefix matching

All commands accept short ID prefixes instead of full UUIDs:

```bash
uv run banana-cli projects get a1b2          # matches a1b2c3d4-...
uv run banana-cli pages update --page-id b9c8 --part cover
```

### Working project context

Set a working project to skip `--project-id` on subsequent commands:

```bash
uv run banana-cli projects use a1b2           # set working project
uv run banana-cli workflows outline            # uses working project
uv run banana-cli projects use                 # show current
uv run banana-cli projects unuse               # clear
```

### Common commands

| Task | Command |
|------|---------|
| List projects | `uv run banana-cli projects list` |
| Generate outline | `uv run banana-cli workflows outline --project-id <id>` |
| Refine outline | `uv run banana-cli workflows outline --project-id <id> --refine "add a section about X"` |
| Full generation | `uv run banana-cli workflows full --project-id <id> --language zh --pages 8` |
| Export PPTX | `uv run banana-cli exports pptx --project-id <id>` |
| Export PDF | `uv run banana-cli exports pdf --project-id <id>` |
| Edit a page image | `uv run banana-cli pages edit-image --project-id <id> --page-id <pid> --instruction "change title color to red"` |
| Upload material | `uv run banana-cli materials upload --file /absolute/path/to/image.png --project-id <id>` |

### Batch generation

```bash
# Create a JSONL file with one job per line
cat > jobs.jsonl << 'EOF'
{"job_id":"topic-1","job_type":"full_generation","creation_type":"idea","idea_prompt":"AI入门","language":"zh","export":{"formats":["pptx"]}}
{"job_id":"topic-2","job_type":"full_generation","creation_type":"idea","idea_prompt":"机器学习","language":"zh","export":{"formats":["pptx","pdf"]}}
EOF

# Run batch
uv run banana-cli run jobs --file jobs.jsonl --report report.json --state-file state.json
```

### Global options

- `--base-url URL` — backend address (default: `http://localhost:5000`)
- `--access-code CODE` — access code for authentication
- `--json` — output JSON format (useful for piping to `jq`)
- `--verbose` — detailed output

## Important Notes

- All file path arguments (`--file`, `--image`) require **absolute paths**
- Async tasks (descriptions, images, editable export) need `--wait` flag to block until completion
- Use `--json` output when parsing results programmatically
- All `--project-id` and `--page-id` options accept short ID prefixes (e.g. `a1b2` instead of full UUID)
- Use `projects use <id>` to set a working project — subsequent commands will use it automatically
- `--help` output is automatically plain text when piped (non-TTY), AI-agent friendly
- Config priority: CLI args > env vars (`BANANA_CLI_*`) > TOML config (`~/.config/banana-slides/cli.toml`) > defaults
