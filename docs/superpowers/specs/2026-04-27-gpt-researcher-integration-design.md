# GPT-Researcher Integration Design

## Overview

Integrate [gpt-researcher](https://github.com/assafelovic/gpt-researcher) as a Python package into Banana Slides, enabling users to run web research before generating slides. The research report is saved as a project reference file, automatically injected into all subsequent AI prompts.

## Goals

- Users can opt-in to web research via a checkbox on the project creation page
- Research runs asynchronously using the existing Task system
- The generated markdown report becomes a reference file attached to the project
- Search engine auto-selects: Tavily (if API key configured) or DuckDuckGo (free, no key)
- LLM calls inside gpt-researcher reuse the project's existing AI provider configuration

## Non-Goals

- Deep/detailed research modes (only `research_report` for now)
- Custom research queries separate from the project idea
- Streaming research progress to the frontend
- Research for outline/description creation types (only `idea` type)

---

## Architecture

### Data Flow

```
User checks "Web Research" → Create Project → POST /research
  → Task created → ThreadPoolExecutor
    → ResearchService.research(query)
      → Maps banana-slides provider config → gpt-researcher env vars
      → GPTResearcher(query, report_type="research_report")
      → conduct_research() + write_report()
    → Save report as ReferenceFile (markdown)
  → Frontend polls task → Complete
  → Report appears in reference files list
  → User proceeds to generate outline (report auto-injected via existing mechanism)
```

### Key Insight

The existing `reference_files_content` mechanism already injects all project reference files into AI prompts via `_format_reference_files_xml()`. By saving the research report as a `ReferenceFile`, we get prompt injection for free — no changes needed to `prompts.py` or `ai_service.py`.

---

## Backend Changes

### 1. New Dependency

Add `gpt-researcher` to `pyproject.toml`:

```toml
"gpt-researcher>=0.9.0",
```

### 2. New Service: `backend/services/research_service.py`

```python
class ResearchService:
    def research(self, query: str, project_id: str, app) -> dict:
        """
        Run gpt-researcher and save report as a ReferenceFile.
        
        Returns: {"report": str, "sources": list, "reference_file_id": str}
        """
```

Core responsibilities:

**Provider Mapping** — Read banana-slides Settings to build gpt-researcher env vars:

| banana-slides | gpt-researcher env var |
|---|---|
| `text_model_source=gemini` + `text_model=gemini-2.0-flash` | `SMART_LLM=google_genai:gemini-2.0-flash`, `FAST_LLM=google_genai:gemini-2.0-flash` |
| `text_model_source=openai` + `text_model=gpt-4o` | `SMART_LLM=openai:gpt-4o`, `FAST_LLM=openai:gpt-4o` |
| `text_model_source=<lazyllm vendor>` | `SMART_LLM=openai:<model>` with vendor's API key via `OPENAI_API_KEY` + `OPENAI_BASE_URL` (LazyLLM vendors expose OpenAI-compatible endpoints) |
| `text_model_source=codex` | Same as openai, but uses OAuth token from `openai_oauth_access_token` as `OPENAI_API_KEY` |
| `api_key` / per-model `text_api_key` | `GOOGLE_API_KEY` or `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (based on source) |

Note: Anthropic models are not yet tested with gpt-researcher's report generation. If the user's text provider is Anthropic, we still attempt the mapping (`anthropic:<model>`). If it fails, the error is surfaced to the user.

**Search Engine Selection** — Check `tavily_api_key` in Settings:
- If set: `RETRIEVER=tavily`, `TAVILY_API_KEY=<key>`
- If not set: `RETRIEVER=duckduckgo`

**Async Bridge** — gpt-researcher is async. Run in a new event loop inside the ThreadPoolExecutor worker:

```python
import asyncio
from gpt_researcher import GPTResearcher

def _run_research(self, query: str, env_config: dict) -> tuple[str, list]:
    # Temporarily set env vars for gpt-researcher
    with _temp_env(env_config):
        loop = asyncio.new_event_loop()
        try:
            researcher = GPTResearcher(query=query, report_type="research_report")
            loop.run_until_complete(researcher.conduct_research())
            report = loop.run_until_complete(researcher.write_report())
            sources = researcher.get_source_urls()
            return report, sources
        finally:
            loop.close()
```

**Report Storage** — Save the markdown report as a `ReferenceFile`:
- Write to `uploads/<project_id>/research_report.md`
- Create `ReferenceFile` record with `parse_status='completed'`, `markdown_content=report`, `file_type='md'`
- If a previous research report exists for this project, replace it (delete old file + record)

### 3. Settings Model Update

Add one field to `backend/models/settings.py`:

```python
tavily_api_key = db.Column(db.String(500), nullable=True)
```

Update `to_dict()` to include `tavily_api_key_length`.
Update `_get_config_defaults()` to read `TAVILY_API_KEY` from env.

Create an Alembic migration for the new column.

### 4. New API Endpoint

Add to `backend/controllers/project_controller.py`:

```python
@project_bp.route('/api/projects/<project_id>/research', methods=['POST'])
def start_research(project_id):
    """
    POST /api/projects/{project_id}/research
    Body: { "query": "..." }  # optional, defaults to project.idea_prompt
    Response: { "task_id": "..." }
    """
```

Flow:
1. Validate project exists and has an `idea_prompt` (or use provided query)
2. Create a `Task` record with `task_type='research'`
3. Submit to `task_manager.submit_task()` with `research_service.research()`
4. Return `{ "task_id": task.id }`

### 5. Settings Controller Update

Add `tavily_api_key` to the allowed fields in `backend/controllers/settings_controller.py` update handler.

---

## Frontend Changes

### 1. Project Creation (Home.tsx)

Add a "联网搜索" / "Web Research" checkbox in the idea input area. Only visible for `idea` creation type.

When checked and user clicks "Generate":
1. Create project as normal
2. Before calling `generateOutline`, call `POST /api/projects/{id}/research`
3. Poll the research task until complete
4. Then proceed with outline generation

The checkbox state is local UI state, not persisted on the project model.

### 2. Research Progress UI

During research, show a progress indicator in the same area where outline generation progress appears. Use the existing task polling mechanism (`GET /api/tasks/{task_id}`).

Suggested UX:
- While researching: "正在搜索网络资料..." / "Searching the web..."
- On complete: Brief toast/notification, then auto-proceed to outline generation
- On failure: Show error, allow user to retry or skip research and generate outline directly

### 3. Settings Page (Settings.tsx)

Add a "Web Research" section to `settingsSections`:

```typescript
{
  title: 'Web Research',
  icon: <SearchIcon />,
  fields: [
    {
      key: 'tavily_api_key',
      label: 'Tavily API Key',
      type: 'password',
      placeholder: 'Leave empty to use DuckDuckGo (free)',
      description: 'Optional. Provides higher quality search results.'
    }
  ]
}
```

### 4. Store Changes (useProjectStore.ts)

Add a `startResearch(projectId: string, query?: string)` action that:
1. Calls `POST /api/projects/{id}/research`
2. Polls the task
3. Returns when complete

The `createAndGenerate` flow checks if web research is enabled and calls this before `generateOutline`.

### 5. API Client

Add to `frontend/src/api/`:

```typescript
startResearch(projectId: string, query?: string): Promise<{ task_id: string }>
```

---

## Reference File Integration

No changes needed to the prompt system. The research report is stored as a `ReferenceFile` with `parse_status='completed'` and `markdown_content` set. The existing `_get_project_reference_files_content()` in `project_controller.py` already reads all reference files for a project and passes them to `ProjectContext`, which feeds into `_format_reference_files_xml()` in `prompts.py`.

The report will appear in the reference files list in the UI, where users can view or delete it like any other reference file.

---

## Error Handling

- If gpt-researcher fails (network error, LLM error, etc.), the Task is marked as failed with an error message
- Frontend shows the error and offers "Retry" or "Skip" options
- Research failure does not block outline generation — user can always proceed without research
- If the configured LLM provider is incompatible with gpt-researcher, show a clear error message

---

## Configuration Summary

| Setting | Location | Default |
|---|---|---|
| `TAVILY_API_KEY` | Settings page or `.env` | None (uses DuckDuckGo) |
| LLM for research | Auto-mapped from text model config | Same as text generation |
| Search engine | Auto-selected based on Tavily key | DuckDuckGo |

---

## Testing Plan

1. **Unit tests**: ResearchService provider mapping logic (gemini → google_genai, openai → openai, etc.)
2. **Unit tests**: Search engine selection logic (tavily key present vs absent)
3. **Integration test**: Full research flow with real API call (DuckDuckGo, no key needed)
4. **E2E mock test**: Frontend checkbox → research task → outline generation flow
5. **E2E integration test**: Full flow with real backend — research → report appears as reference file → outline generation uses it
