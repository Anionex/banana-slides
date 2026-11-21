# GPT-Researcher Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate gpt-researcher as a Python package so users can opt-in to web research before slide generation, with the report saved as a reference file.

**Architecture:** New `ResearchService` wraps GPTResearcher, mapping banana-slides provider config to gpt-researcher env vars. A new API endpoint creates an async Task. Frontend adds a toggle on Home.tsx and a Tavily API key field in Settings. The research report is stored as a `ReferenceFile`, automatically injected into all AI prompts via the existing mechanism.

**Tech Stack:** Python (gpt-researcher, asyncio), Flask, SQLAlchemy/Alembic, React/TypeScript, Zustand, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/services/research_service.py` | GPTResearcher wrapper, provider mapping, report storage |
| Modify | `backend/models/settings.py:17-50` | Add `tavily_api_key` column |
| Modify | `backend/config.py:44-88` | Add `TAVILY_API_KEY` env var |
| Create | `backend/migrations/versions/<auto>_add_tavily_api_key.py` | DB migration |
| Modify | `backend/controllers/settings_controller.py:303-340` | Handle `tavily_api_key` in PUT |
| Modify | `backend/controllers/project_controller.py` | Add `POST /<project_id>/research` endpoint |
| Modify | `frontend/src/api/endpoints.ts` | Add `startResearch()` API call |
| Modify | `frontend/src/store/useProjectStore.ts:200-286` | Add research step to `initializeProject` |
| Modify | `frontend/src/pages/Home.tsx:1036-1094` | Add web research toggle |
| Modify | `frontend/src/pages/Settings.tsx:545-570` | Add Web Research settings section |
| Create | `backend/tests/test_research_service.py` | Unit tests for provider mapping |
| Create | `frontend/e2e/web-research.spec.ts` | E2E tests |

---

### Task 1: Add gpt-researcher dependency

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add gpt-researcher to dependencies**

In `pyproject.toml`, add to the `dependencies` array:

```toml
"gpt-researcher>=0.9.0",
```

- [ ] **Step 2: Install the dependency**

Run:
```bash
cd backend && uv sync
```

Expected: Successful installation with gpt-researcher and its dependencies.

- [ ] **Step 3: Verify import works**

Run:
```bash
cd backend && uv run python -c "from gpt_researcher import GPTResearcher; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "feat(research): add gpt-researcher dependency"
```

---

### Task 2: Settings model — add tavily_api_key

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/models/settings.py`
- Create: Alembic migration

- [ ] **Step 1: Add TAVILY_API_KEY to Config**

In `backend/config.py`, after the `IMAGE_CAPTION_API_BASE` line (around line 87), add:

```python
# Web Research (gpt-researcher) configuration
TAVILY_API_KEY = os.getenv('TAVILY_API_KEY', '')
```

- [ ] **Step 2: Add tavily_api_key column to Settings model**

In `backend/models/settings.py`, after the `baidu_api_key` field (line 44), add:

```python
tavily_api_key = db.Column(db.String(500), nullable=True)  # Tavily API Key for web research
```

- [ ] **Step 3: Update to_dict() in Settings model**

In `backend/models/settings.py`, in the `to_dict()` method, add after the `baidu_api_key` handling (around line 104):

```python
tavily_api_key = self._val('tavily_api_key', d)
```

And in the return dict, after `'baidu_api_key_length'`:

```python
'tavily_api_key_length': len(tavily_api_key) if tavily_api_key else 0,
```

- [ ] **Step 4: Update _get_config_defaults()**

In `backend/models/settings.py`, in `_get_config_defaults()`, add to the return dict:

```python
'tavily_api_key': Config.TAVILY_API_KEY or None,
```

- [ ] **Step 5: Create Alembic migration**

Run:
```bash
cd backend && uv run alembic revision --autogenerate -m "add tavily_api_key to settings"
```

Expected: New migration file created.

- [ ] **Step 6: Apply migration**

Run:
```bash
cd backend && uv run alembic upgrade head
```

Expected: Migration applied successfully.

- [ ] **Step 7: Commit**

```bash
git add backend/config.py backend/models/settings.py backend/migrations/versions/
git commit -m "feat(research): add tavily_api_key to settings model"
```

---

### Task 3: Settings controller — handle tavily_api_key updates

**Files:**
- Modify: `backend/controllers/settings_controller.py`

- [ ] **Step 1: Add tavily_api_key handling to update_settings()**

In `backend/controllers/settings_controller.py`, after the `baidu_api_key` block (around line 305), add:

```python
if "tavily_api_key" in data:
    settings.tavily_api_key = data["tavily_api_key"] or None
```

- [ ] **Step 2: Verify with py_compile**

Run:
```bash
cd backend && uv run python -m py_compile controllers/settings_controller.py
```

Expected: No output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/settings_controller.py
git commit -m "feat(research): handle tavily_api_key in settings controller"
```

---

### Task 4: Research service — provider mapping and core logic

**Files:**
- Create: `backend/services/research_service.py`

- [ ] **Step 1: Write the provider mapping test**

Create `backend/tests/test_research_service.py`:

```python
"""Tests for research service provider mapping."""
import pytest
from unittest.mock import patch, MagicMock


class TestBuildResearchEnv:
    """Test _build_research_env maps banana-slides config to gpt-researcher env vars."""

    def test_gemini_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-google-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['FAST_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['STRATEGIC_LLM'] == 'google_genai:gemini-2.0-flash'
        assert env['GOOGLE_API_KEY'] == 'test-google-key'
        assert env['RETRIEVER'] == 'duckduckgo'

    def test_openai_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='openai',
            text_model='gpt-4o',
            api_key='test-openai-key',
            api_base='https://api.openai.com/v1',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'openai:gpt-4o'
        assert env['FAST_LLM'] == 'openai:gpt-4o'
        assert env['OPENAI_API_KEY'] == 'test-openai-key'
        assert env['RETRIEVER'] == 'duckduckgo'

    def test_openai_custom_base(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='openai',
            text_model='gpt-4o',
            api_key='test-key',
            api_base='https://custom.api.com/v1',
            tavily_api_key='',
        )
        assert env['OPENAI_BASE_URL'] == 'https://custom.api.com/v1'

    def test_anthropic_provider(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='anthropic',
            text_model='claude-sonnet-4-20250514',
            api_key='test-anthropic-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['SMART_LLM'] == 'anthropic:claude-sonnet-4-20250514'
        assert env['ANTHROPIC_API_KEY'] == 'test-anthropic-key'

    def test_tavily_when_key_present(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-key',
            api_base='',
            tavily_api_key='tvly-test-key',
        )
        assert env['RETRIEVER'] == 'tavily'
        assert env['TAVILY_API_KEY'] == 'tvly-test-key'

    def test_duckduckgo_when_no_tavily_key(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='gemini',
            text_model='gemini-2.0-flash',
            api_key='test-key',
            api_base='',
            tavily_api_key='',
        )
        assert env['RETRIEVER'] == 'duckduckgo'
        assert 'TAVILY_API_KEY' not in env

    def test_lazyllm_vendor(self):
        from services.research_service import _build_research_env
        env = _build_research_env(
            provider_format='lazyllm',
            text_model='qwen-plus',
            api_key='lazyllm-key',
            api_base='https://api.lazyllm.com/v1',
            tavily_api_key='',
            text_model_source='qwen',
        )
        assert env['SMART_LLM'] == 'openai:qwen-plus'
        assert env['OPENAI_API_KEY'] == 'lazyllm-key'
        assert env['OPENAI_BASE_URL'] == 'https://api.lazyllm.com/v1'
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && uv run python -m pytest tests/test_research_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'services.research_service'`

- [ ] **Step 3: Implement _build_research_env**

Create `backend/services/research_service.py`:

```python
"""Web research service using gpt-researcher."""
import asyncio
import logging
import os
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Provider format mapping: banana-slides format → gpt-researcher LLM prefix
_PROVIDER_LLM_PREFIX = {
    'gemini': 'google_genai',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'codex': 'openai',
}

# Provider format → which env var holds the API key for gpt-researcher
_PROVIDER_API_KEY_ENV = {
    'gemini': 'GOOGLE_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'codex': 'OPENAI_API_KEY',
}


def _build_research_env(
    provider_format: str,
    text_model: str,
    api_key: str,
    api_base: str,
    tavily_api_key: str,
    text_model_source: str = '',
) -> dict:
    """
    Map banana-slides provider config to gpt-researcher environment variables.

    Returns a dict of env vars to set before creating GPTResearcher.
    """
    env = {}
    fmt = (provider_format or 'gemini').lower()

    # Determine LLM prefix and API key env var
    if fmt in _PROVIDER_LLM_PREFIX:
        prefix = _PROVIDER_LLM_PREFIX[fmt]
        key_env = _PROVIDER_API_KEY_ENV[fmt]
    elif fmt == 'lazyllm' or text_model_source:
        # LazyLLM vendors use OpenAI-compatible endpoints
        prefix = 'openai'
        key_env = 'OPENAI_API_KEY'
    else:
        # Unknown format, try openai-compatible
        prefix = 'openai'
        key_env = 'OPENAI_API_KEY'

    llm_value = f'{prefix}:{text_model}'
    env['SMART_LLM'] = llm_value
    env['FAST_LLM'] = llm_value
    env['STRATEGIC_LLM'] = llm_value

    if api_key:
        env[key_env] = api_key

    # Set custom base URL for OpenAI-compatible providers
    if api_base and prefix == 'openai':
        env['OPENAI_BASE_URL'] = api_base

    # Search engine: Tavily if key present, else DuckDuckGo
    if tavily_api_key:
        env['RETRIEVER'] = 'tavily'
        env['TAVILY_API_KEY'] = tavily_api_key
    else:
        env['RETRIEVER'] = 'duckduckgo'

    return env
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && uv run python -m pytest tests/test_research_service.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/research_service.py backend/tests/test_research_service.py
git commit -m "feat(research): add provider mapping for gpt-researcher"
```

---

### Task 5: Research service — research execution and report storage

**Files:**
- Modify: `backend/services/research_service.py`

- [ ] **Step 1: Add _temp_env context manager and research functions**

Append to `backend/services/research_service.py`:

```python
@contextmanager
def _temp_env(env_vars: dict):
    """Temporarily set environment variables, restoring originals on exit."""
    old_values = {}
    for key, value in env_vars.items():
        old_values[key] = os.environ.get(key)
        os.environ[key] = value
    try:
        yield
    finally:
        for key, old_value in old_values.items():
            if old_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old_value


def _run_research_async(query: str, env_config: dict) -> tuple:
    """Run GPTResearcher in a new event loop. Returns (report_markdown, source_urls)."""
    from gpt_researcher import GPTResearcher

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


def _resolve_text_provider_config(app) -> dict:
    """Read the current text provider config from Flask app.config / Settings."""
    from models.settings import Settings

    with app.app_context():
        settings = Settings.get_settings()
        defaults = Settings._get_config_defaults()

        # Per-model source takes priority
        text_source = settings.text_model_source or defaults.get('text_model_source') or ''
        text_model = settings.text_model or defaults.get('text_model') or 'gemini-2.0-flash'
        tavily_key = settings.tavily_api_key or defaults.get('tavily_api_key') or ''

        # Determine effective provider format
        if text_source:
            provider_format = text_source
        else:
            provider_format = settings.ai_provider_format or defaults.get('ai_provider_format') or 'gemini'

        # Determine API key and base URL
        # Per-model credentials take priority over global
        api_key = settings.text_api_key or ''
        api_base = settings.text_api_base_url or ''

        if not api_key:
            # Fall back to global
            api_key = settings.api_key or defaults.get('api_key') or ''
            api_base = api_base or settings.api_base_url or defaults.get('api_base_url') or ''

        # For lazyllm vendors, resolve from lazyllm_api_keys
        fmt_lower = (provider_format or '').lower()
        if fmt_lower not in ('gemini', 'openai', 'anthropic', 'codex', 'vertex') and not api_key:
            lazyllm_keys = settings.get_lazyllm_api_keys_dict()
            vendor_key = lazyllm_keys.get(fmt_lower, '')
            if vendor_key:
                api_key = vendor_key
                # LazyLLM vendors use a standard base URL
                from services.ai_providers.lazyllm_env import LAZYLLM_VENDORS
                vendor_info = LAZYLLM_VENDORS.get(fmt_lower, {})
                if not api_base and isinstance(vendor_info, dict):
                    api_base = vendor_info.get('api_base', '')

        return {
            'provider_format': provider_format,
            'text_model': text_model,
            'api_key': api_key,
            'api_base': api_base,
            'tavily_api_key': tavily_key,
            'text_model_source': text_source,
        }


def run_research_task(task_id: str, project_id: str, query: str, app=None):
    """
    Background task function for web research.
    Called by task_manager.submit_task(). First arg is always task_id.
    """
    from models import db, Task, ReferenceFile

    with app.app_context():
        try:
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Research task {task_id} not found")
                return

            task.status = 'PROCESSING'
            task.set_progress({'stage': 'researching'})
            db.session.commit()

            # Build env config from current settings
            provider_config = _resolve_text_provider_config(app)
            env_config = _build_research_env(**provider_config)

            logger.info(f"Starting research for project {project_id}: '{query[:100]}...'")

            # Run the research
            report, sources = _run_research_async(query, env_config)

            if not report:
                raise ValueError("GPTResearcher returned empty report")

            # Save report as a file on disk
            upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
            project_dir = os.path.join(upload_folder, project_id)
            os.makedirs(project_dir, exist_ok=True)

            report_filename = 'web_research_report.md'
            report_path = os.path.join(project_dir, report_filename)
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(report)

            # Delete any existing research report for this project
            existing = ReferenceFile.query.filter_by(
                project_id=project_id,
                filename=report_filename,
            ).first()
            if existing:
                db.session.delete(existing)
                db.session.flush()

            # Create ReferenceFile record
            ref_file = ReferenceFile(
                project_id=project_id,
                filename=report_filename,
                file_path=os.path.join(project_id, report_filename),
                file_size=len(report.encode('utf-8')),
                file_type='md',
                parse_status='completed',
                markdown_content=report,
            )
            db.session.add(ref_file)

            # Update task
            task.status = 'COMPLETED'
            from datetime import datetime
            task.completed_at = datetime.utcnow()
            task.set_progress({
                'stage': 'completed',
                'sources_count': len(sources),
                'report_length': len(report),
                'reference_file_id': ref_file.id,
            })
            db.session.commit()

            logger.info(f"Research completed for project {project_id}: "
                        f"{len(report)} chars, {len(sources)} sources")

        except Exception as e:
            logger.error(f"Research task {task_id} failed: {e}", exc_info=True)
            try:
                task = Task.query.get(task_id)
                if task:
                    task.status = 'FAILED'
                    from datetime import datetime
                    task.completed_at = datetime.utcnow()
                    task.error_message = str(e)
                    db.session.commit()
            except Exception:
                logger.error("Failed to update task status", exc_info=True)
```

- [ ] **Step 2: Verify with py_compile**

Run:
```bash
cd backend && uv run python -m py_compile services/research_service.py
```

Expected: No output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/services/research_service.py
git commit -m "feat(research): add research execution and report storage"
```

---

### Task 6: API endpoint — POST /research

**Files:**
- Modify: `backend/controllers/project_controller.py`

- [ ] **Step 1: Add the research endpoint**

In `backend/controllers/project_controller.py`, add the following endpoint (after the existing generate endpoints, before the export section):

```python
@project_bp.route('/<project_id>/research', methods=['POST'])
def start_research(project_id):
    """
    POST /api/projects/{project_id}/research - Start web research
    
    Request body (optional):
    {
        "query": "custom research query"  // defaults to project.idea_prompt
    }
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        data = request.get_json() or {}
        query = data.get('query') or project.idea_prompt

        if not query:
            return bad_request("No research query provided and project has no idea_prompt")

        # Create task
        task = Task(
            project_id=project_id,
            task_type='RESEARCH',
            status='PENDING'
        )
        task.set_progress({'stage': 'pending'})
        db.session.add(task)
        db.session.commit()

        app = current_app._get_current_object()

        from services.research_service import run_research_task
        task_manager.submit_task(
            task.id,
            run_research_task,
            project_id,
            query,
            app,
        )

        return success_response({
            'task_id': task.id,
        }, status_code=202)

    except Exception as e:
        db.session.rollback()
        logger.error(f"start_research failed: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)
```

- [ ] **Step 2: Verify with py_compile**

Run:
```bash
cd backend && uv run python -m py_compile controllers/project_controller.py
```

Expected: No output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/controllers/project_controller.py
git commit -m "feat(research): add POST /research API endpoint"
```

---

### Task 7: Frontend API client — add startResearch endpoint

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

- [ ] **Step 1: Add startResearch function**

In `frontend/src/api/endpoints.ts`, after the existing generate endpoints, add:

```typescript
/**
 * 启动网络搜索
 */
export const startResearch = async (
  projectId: string,
  query?: string
): Promise<ApiResponse<{ task_id: string }>> => {
  const response = await apiClient.post<ApiResponse<{ task_id: string }>>(
    `/api/projects/${projectId}/research`,
    query ? { query } : {}
  );
  return response.data;
};
```

- [ ] **Step 2: Verify with lint**

Run:
```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to endpoints.ts.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "feat(research): add startResearch API endpoint"
```

---

### Task 8: Store — add research step to initializeProject

**Files:**
- Modify: `frontend/src/store/useProjectStore.ts`

- [ ] **Step 1: Import startResearch in the API imports**

At the top of `frontend/src/store/useProjectStore.ts`, where API functions are imported, add `startResearch` to the imports from `../api/endpoints` (or wherever the API module is imported).

- [ ] **Step 2: Add enableWebResearch parameter to initializeProject**

Modify the `initializeProject` function signature (around line 200) to accept an additional parameter:

Change:
```typescript
initializeProject: async (type, content, templateImage, templateStyle, referenceFileIds, aspectRatio) => {
```

To:
```typescript
initializeProject: async (type, content, templateImage, templateStyle, referenceFileIds, aspectRatio, enableWebResearch) => {
```

- [ ] **Step 3: Add research step before outline generation**

After the reference file association block (around line 241) and before the `generateWithRollback` block (around line 254), add the research step:

```typescript
// 4.5. If web research enabled, run research before generation
if (enableWebResearch && type === 'idea') {
  try {
    const researchResponse = await api.startResearch(projectId);
    const researchTaskId = researchResponse.data?.task_id;
    if (researchTaskId) {
      // Poll research task until complete
      await new Promise<void>((resolve, reject) => {
        const pollResearch = async () => {
          try {
            const taskResponse = await api.getTaskStatus(projectId, researchTaskId);
            const task = taskResponse.data;
            if (task?.status === 'COMPLETED') {
              resolve();
            } else if (task?.status === 'FAILED') {
              console.warn('[Research] Task failed:', task.error_message);
              // Research failure is non-blocking — continue without research
              resolve();
            } else {
              setTimeout(pollResearch, 2000);
            }
          } catch (err) {
            console.warn('[Research] Poll error:', err);
            resolve(); // Non-blocking
          }
        };
        pollResearch();
      });
    }
  } catch (error) {
    console.warn('[Research] Failed to start research:', error);
    // Research failure is non-blocking
  }
}
```

- [ ] **Step 4: Update the store type definition**

Find the store interface/type definition and update `initializeProject` to include the new parameter:

```typescript
initializeProject: (
  type: CreationType,
  content: string,
  templateImage?: File,
  templateStyle?: string,
  referenceFileIds?: string[],
  aspectRatio?: string,
  enableWebResearch?: boolean,
) => Promise<void>;
```

- [ ] **Step 5: Verify with lint**

Run:
```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/useProjectStore.ts
git commit -m "feat(research): add research step to initializeProject flow"
```

---

### Task 9: Home.tsx — add web research toggle

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

- [ ] **Step 1: Add state for web research toggle**

In `Home.tsx`, near the other state declarations (around line 180-210), add:

```typescript
const [enableWebResearch, setEnableWebResearch] = useState(false);
```

- [ ] **Step 2: Add i18n translations**

In the `homeI18n` object in `Home.tsx`, add to the `zh` section:

```typescript
webResearch: {
  label: '联网搜索',
  tooltip: '生成前先搜索网络资料，提升内容质量',
},
```

And to the `en` section:

```typescript
webResearch: {
  label: 'Web Research',
  tooltip: 'Search the web before generating for better content',
},
```

- [ ] **Step 3: Add toggle UI in the toolbar**

In the `toolbarLeft` section of the `MarkdownTextarea` (around line 1036-1074), after the aspect ratio dropdown's closing `</div>`, add the web research toggle. Only show it for `idea` tab:

```tsx
{activeTab === 'idea' && (
  <label
    className="flex items-center gap-1.5 cursor-pointer group ml-1"
    title={t('home.webResearch.tooltip')}
  >
    <Globe size={16} className={`transition-colors ${enableWebResearch ? 'text-banana' : 'text-gray-400 dark:text-foreground-tertiary group-hover:text-gray-600 dark:group-hover:text-foreground-secondary'}`} />
    <span className={`text-xs transition-colors ${enableWebResearch ? 'text-banana font-medium' : 'text-gray-400 dark:text-foreground-tertiary group-hover:text-gray-600 dark:group-hover:text-foreground-secondary'}`}>
      {t('home.webResearch.label')}
    </span>
    <div className="relative">
      <input
        type="checkbox"
        checked={enableWebResearch}
        onChange={(e) => setEnableWebResearch(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-8 h-4 bg-gray-200 dark:bg-background-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-banana"></div>
    </div>
  </label>
)}
```

- [ ] **Step 4: Import Globe icon**

At the top of `Home.tsx`, add `Globe` to the lucide-react imports:

```typescript
import { ..., Globe } from 'lucide-react';
```

- [ ] **Step 5: Pass enableWebResearch to initializeProject**

In the `handleSubmit` function (around line 624), update the `initializeProject` call:

Change:
```typescript
await initializeProject(activeTab as 'idea' | 'outline' | 'description', content, templateFile || undefined, styleDesc, refFileIds.length > 0 ? refFileIds : undefined, aspectRatio);
```

To:
```typescript
await initializeProject(activeTab as 'idea' | 'outline' | 'description', content, templateFile || undefined, styleDesc, refFileIds.length > 0 ? refFileIds : undefined, aspectRatio, enableWebResearch);
```

- [ ] **Step 6: Verify with lint**

Run:
```bash
cd frontend && npm run lint:frontend 2>&1 | tail -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Home.tsx
git commit -m "feat(research): add web research toggle to Home page"
```

---

### Task 10: Settings.tsx — add Tavily API key field

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Add i18n translations for web research settings**

In the Settings i18n object, add to `zh`:

```typescript
webResearchConfig: '网络搜索',
tavilyApiKey: 'Tavily API Key',
tavilyApiKeyPlaceholder: '留空则使用 DuckDuckGo（免费）',
tavilyApiKeyDesc: '可选。Tavily 提供更高质量的搜索结果。',
```

And to `en`:

```typescript
webResearchConfig: 'Web Research',
tavilyApiKeyPlaceholder: 'Leave empty to use DuckDuckGo (free)',
tavilyApiKeyDesc: 'Optional. Tavily provides higher quality search results.',
```

- [ ] **Step 2: Add tavily_api_key to initialFormData**

In the `initialFormData` object (around line 324-355), add:

```typescript
tavily_api_key: '',
```

- [ ] **Step 3: Add Web Research section to settingsSections**

In the `settingsSections` array (around line 545), add a new section. Place it after the MinerU config section:

```typescript
{
  title: t('settings.sections.webResearchConfig'),
  icon: <Globe size={20} />,
  fields: [
    {
      key: 'tavily_api_key',
      label: t('settings.fields.tavilyApiKey'),
      type: 'password',
      placeholder: t('settings.fields.tavilyApiKeyPlaceholder'),
      sensitiveField: true,
      lengthKey: 'tavily_api_key_length',
      description: t('settings.fields.tavilyApiKeyDesc'),
      link: 'https://tavily.com/',
    },
  ],
},
```

- [ ] **Step 4: Import Globe icon**

At the top of `Settings.tsx`, add `Globe` to the lucide-react imports.

- [ ] **Step 5: Verify with lint**

Run:
```bash
cd frontend && npm run lint:frontend 2>&1 | tail -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(research): add Tavily API key to Settings page"
```

---

### Task 11: E2E tests

**Files:**
- Create: `frontend/e2e/web-research.spec.ts`

- [ ] **Step 1: Write mock E2E test for the toggle and research flow**

Create `frontend/e2e/web-research.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Web Research Feature', () => {
  test.describe('Mock Tests', () => {
    test('web research toggle is visible only on idea tab', async ({ page }) => {
      await page.goto('/');
      
      // On idea tab (default), toggle should be visible
      const toggle = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")');
      await expect(toggle).toBeVisible();

      // Switch to outline tab — toggle should disappear
      const outlineTab = page.locator('button:has-text("大纲"), button:has-text("Outline")').first();
      await outlineTab.click();
      await expect(toggle).not.toBeVisible();

      // Switch back to idea tab — toggle should reappear
      const ideaTab = page.locator('button:has-text("想法"), button:has-text("Idea")').first();
      await ideaTab.click();
      await expect(toggle).toBeVisible();
    });

    test('web research toggle can be checked and unchecked', async ({ page }) => {
      await page.goto('/');
      
      const checkbox = page.locator('label:has-text("联网搜索") input[type="checkbox"], label:has-text("Web Research") input[type="checkbox"]');
      
      // Initially unchecked
      await expect(checkbox).not.toBeChecked();
      
      // Click to enable
      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")');
      await label.click();
      await expect(checkbox).toBeChecked();
      
      // Click to disable
      await label.click();
      await expect(checkbox).not.toBeChecked();
    });

    test('research API is called when toggle is enabled', async ({ page }) => {
      let researchCalled = false;
      let outlineCalled = false;

      // Mock create project
      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { project_id: 'test-project-123' },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Mock research endpoint
      await page.route('**/api/projects/test-project-123/research', async (route) => {
        researchCalled = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { task_id: 'research-task-1' },
          }),
        });
      });

      // Mock task polling — research completes immediately
      await page.route('**/api/projects/test-project-123/tasks/research-task-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'research-task-1',
              status: 'COMPLETED',
              progress: { stage: 'completed' },
            },
          }),
        });
      });

      // Mock outline generation
      await page.route('**/api/projects/test-project-123/generate/outline', async (route) => {
        outlineCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { pages: [] },
          }),
        });
      });

      // Mock get project
      await page.route('**/api/projects/test-project-123', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'test-project-123',
                title: 'Test',
                status: 'OUTLINE_READY',
                pages: [],
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      // Enable web research
      const label = page.locator('label:has-text("联网搜索"), label:has-text("Web Research")');
      await label.click();

      // Type idea
      const textarea = page.locator('textarea').first();
      await textarea.fill('AI trends in 2026');

      // Click generate
      const generateBtn = page.locator('button:has-text("下一步"), button:has-text("Next")').first();
      await generateBtn.click();

      // Wait for navigation or timeout
      await page.waitForTimeout(3000);

      expect(researchCalled).toBe(true);
    });

    test('research API is NOT called when toggle is disabled', async ({ page }) => {
      let researchCalled = false;

      await page.route('**/api/projects', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { project_id: 'test-project-456' },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.route('**/api/projects/test-project-456/research', async (route) => {
        researchCalled = true;
        await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
      });

      await page.route('**/api/projects/test-project-456/generate/outline', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { pages: [] } }),
        });
      });

      await page.route('**/api/projects/test-project-456', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'test-project-456', title: 'Test', status: 'OUTLINE_READY', pages: [] },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      // Do NOT enable web research toggle

      const textarea = page.locator('textarea').first();
      await textarea.fill('AI trends in 2026');

      const generateBtn = page.locator('button:has-text("下一步"), button:has-text("Next")').first();
      await generateBtn.click();

      await page.waitForTimeout(3000);

      expect(researchCalled).toBe(false);
    });
  });

  test.describe('Settings Tests', () => {
    test('Tavily API key field exists in settings', async ({ page }) => {
      await page.goto('/settings');

      // Look for the Web Research section
      const section = page.locator('text=Web Research, text=网络搜索').first();
      await expect(section).toBeVisible();

      // Look for the Tavily API Key field
      const tavilyField = page.locator('input[placeholder*="DuckDuckGo"], input[placeholder*="duckduckgo"]').first();
      await expect(tavilyField).toBeVisible();
    });
  });
});
```

- [ ] **Step 2: Run mock E2E tests**

Run:
```bash
cd frontend && BASE_URL=http://localhost:<port> npx playwright test e2e/web-research.spec.ts --reporter=list
```

Expected: All mock tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/web-research.spec.ts
git commit -m "test(research): add E2E tests for web research feature"
```

---

### Task 12: Integration test — full research flow

**Files:**
- Create: `backend/tests/test_research_integration.py`

- [ ] **Step 1: Write integration test for the research endpoint**

Create `backend/tests/test_research_integration.py`:

```python
"""Integration test for the research endpoint.

Requires a running backend and a valid AI provider config.
Uses DuckDuckGo (no API key needed) for search.
"""
import time
import requests
import os

BASE_URL = os.environ.get('BASE_URL', 'http://localhost:5000')


def test_research_endpoint_creates_reference_file():
    """Full flow: create project → research → verify reference file created."""
    # 1. Create a project
    resp = requests.post(f'{BASE_URL}/api/projects', json={
        'creation_type': 'idea',
        'idea_prompt': 'Latest trends in artificial intelligence 2026',
    })
    assert resp.status_code == 200, f"Create project failed: {resp.text}"
    project_id = resp.json()['data']['project_id']

    # 2. Start research
    resp = requests.post(f'{BASE_URL}/api/projects/{project_id}/research')
    assert resp.status_code == 202, f"Start research failed: {resp.text}"
    task_id = resp.json()['data']['task_id']

    # 3. Poll until complete (max 3 minutes)
    for _ in range(90):
        resp = requests.get(f'{BASE_URL}/api/projects/{project_id}/tasks/{task_id}')
        assert resp.status_code == 200
        task = resp.json()['data']
        if task['status'] == 'COMPLETED':
            break
        if task['status'] == 'FAILED':
            raise AssertionError(f"Research task failed: {task.get('error_message')}")
        time.sleep(2)
    else:
        raise AssertionError("Research task did not complete within 3 minutes")

    # 4. Verify reference file was created
    resp = requests.get(f'{BASE_URL}/api/projects/{project_id}')
    assert resp.status_code == 200
    project = resp.json()['data']

    # Check reference files
    resp = requests.get(f'{BASE_URL}/api/projects/{project_id}/reference-files')
    assert resp.status_code == 200
    ref_files = resp.json()['data']
    research_files = [f for f in ref_files if f['filename'] == 'web_research_report.md']
    assert len(research_files) == 1, f"Expected 1 research report, got {len(research_files)}"

    report = research_files[0]
    assert report['parse_status'] == 'completed'
    assert report['file_type'] == 'md'
    assert len(report.get('markdown_content', '')) > 100, "Report content too short"

    # 5. Cleanup
    requests.delete(f'{BASE_URL}/api/projects/{project_id}')

    print(f"✓ Research integration test passed. Report: {len(report['markdown_content'])} chars")


if __name__ == '__main__':
    test_research_endpoint_creates_reference_file()
```

- [ ] **Step 2: Run integration test (requires running backend)**

Run:
```bash
cd backend && BASE_URL=http://localhost:<port> uv run python tests/test_research_integration.py
```

Expected: Test passes, report created with >100 chars.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_research_integration.py
git commit -m "test(research): add integration test for research endpoint"
```

---

### Task 13: Documentation update

**Files:**
- Modify: `docs/zh/features/web-research.mdx` (create)
- Modify: `README.md` (if needed)

- [ ] **Step 1: Create Chinese documentation**

Create `docs/zh/features/web-research.mdx`:

```mdx
---
title: 联网搜索
description: 使用 AI 搜索网络资料，提升幻灯片内容质量
---

# 联网搜索

Banana Slides 集成了 [GPT-Researcher](https://github.com/assafelovic/gpt-researcher)，可以在生成幻灯片前自动搜索网络资料，让 AI 基于最新信息生成更准确、更丰富的内容。

## 使用方法

1. 在首页输入你的想法
2. 开启输入框工具栏中的「联网搜索」开关
3. 点击「下一步」，系统会先搜索网络资料（约 1-2 分钟）
4. 搜索完成后自动继续生成大纲

搜索报告会自动保存为项目的参考文件，后续所有 AI 生成步骤都会参考这份报告。

## 搜索引擎配置

默认使用 DuckDuckGo（免费，无需配置）。如需更高质量的搜索结果，可以在设置页面配置 Tavily API Key：

1. 前往 [Tavily](https://tavily.com/) 注册并获取 API Key
2. 在 Banana Slides 设置页面的「网络搜索」部分填入 API Key
3. 系统会自动切换到 Tavily 搜索引擎

## 注意事项

- 联网搜索仅在「想法」模式下可用（大纲/描述模式不支持）
- 搜索过程需要调用 LLM 来分析和综合搜索结果，会使用你当前配置的文本模型
- 搜索失败不会阻止幻灯片生成，你可以选择跳过搜索继续生成
- 每个项目只保留最新一份搜索报告
```

- [ ] **Step 2: Run translate-docs skill to sync English version**

Invoke `/translate-docs` to translate `docs/zh/features/web-research.mdx` to English.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add web research feature documentation"
```
