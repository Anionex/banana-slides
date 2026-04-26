"""Web research service using gpt-researcher."""
import asyncio
import logging
import os
import uuid
from contextlib import contextmanager
from collections import deque

logger = logging.getLogger(__name__)

# In-memory progress store: task_id → deque of message strings
_progress_store: dict[str, deque] = {}
_MAX_MESSAGES = 50

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


def get_research_progress(task_id: str) -> list[str]:
    """Return accumulated progress messages for a research task."""
    return list(_progress_store.get(task_id, []))


def clear_research_progress(task_id: str) -> None:
    _progress_store.pop(task_id, None)


class _ProgressCollector:
    """Fake websocket that collects gpt-researcher progress messages."""

    def __init__(self, task_id: str):
        _progress_store[task_id] = deque(maxlen=_MAX_MESSAGES)
        self._queue = _progress_store[task_id]

    async def send_json(self, data: dict) -> None:
        msg_type = data.get('type', '')
        content = data.get('content', '') or data.get('output', '')
        if not content:
            return
        # Filter to meaningful message types
        if msg_type in ('logs', 'report', 'path'):
            self._queue.append(str(content))


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


@contextmanager
def _temp_env(env_vars: dict):
    """Temporarily set environment variables, restoring originals on exit."""
    originals = {k: os.environ.get(k) for k in env_vars}
    try:
        for k, v in env_vars.items():
            os.environ[k] = v
        yield
    finally:
        for k, orig in originals.items():
            if orig is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = orig


def _run_gpt_researcher(query: str, env_config: dict, task_id: str) -> tuple:
    """Run gpt-researcher in a new event loop. Returns (report, sources)."""
    from gpt_researcher import GPTResearcher
    collector = _ProgressCollector(task_id)
    with _temp_env(env_config):
        loop = asyncio.new_event_loop()
        try:
            researcher = GPTResearcher(query=query, report_type='research_report', websocket=collector)
            loop.run_until_complete(researcher.conduct_research())
            report = loop.run_until_complete(researcher.write_report())
            sources = researcher.get_source_urls()
            return report, sources
        finally:
            loop.close()


def run_research_task(query: str, project_id: str, app, task_id: str = '') -> dict:
    """
    Run web research and save the report as a ReferenceFile.

    Returns {"report": str, "sources": list, "reference_file_id": str}
    """
    with app.app_context():
        from models import db, ReferenceFile
        from models.settings import Settings
        from config import Config

        settings = Settings.get_settings()

        # Resolve provider config
        fmt = settings.text_model_source or settings.ai_provider_format or Config.AI_PROVIDER_FORMAT or 'gemini'
        model = settings.text_model or Config.TEXT_MODEL or ''
        tavily_key = settings.tavily_api_key or Config.TAVILY_API_KEY or ''

        # Resolve API key and base URL
        if fmt == 'codex':
            api_key = settings.get_openai_oauth_token() or ''
            api_base = ''
        elif fmt == 'gemini':
            api_key = settings.text_api_key or settings.api_key or Config.GOOGLE_API_KEY or ''
            api_base = settings.text_api_base_url or settings.api_base_url or ''
        elif fmt == 'openai':
            api_key = settings.text_api_key or settings.api_key or Config.OPENAI_API_KEY or ''
            api_base = settings.text_api_base_url or settings.api_base_url or Config.OPENAI_API_BASE or ''
        elif fmt == 'anthropic':
            api_key = settings.text_api_key or settings.api_key or ''
            api_base = ''
        else:
            # LazyLLM vendor — use vendor API key with OpenAI-compatible endpoint
            from services.ai_providers.lazyllm_env import get_lazyllm_api_key
            api_key = get_lazyllm_api_key(fmt)
            api_base = settings.text_api_base_url or settings.api_base_url or ''

        env_config = _build_research_env(
            provider_format=fmt,
            text_model=model,
            api_key=api_key,
            api_base=api_base,
            tavily_api_key=tavily_key,
            text_model_source=settings.text_model_source or '',
        )

        logger.info(f"Starting research for project {project_id}: {query[:80]}")
        report, sources = _run_gpt_researcher(query, env_config, task_id)

        # Save report as ReferenceFile
        upload_dir = os.path.join(Config.UPLOAD_FOLDER, project_id)
        os.makedirs(upload_dir, exist_ok=True)
        report_filename = 'research_report.md'
        report_path = os.path.join(upload_dir, report_filename)

        # Replace existing research report if present
        existing = ReferenceFile.query.filter_by(
            project_id=project_id, filename=report_filename
        ).first()
        if existing:
            try:
                old_full_path = os.path.join(Config.UPLOAD_FOLDER, existing.file_path)
                if os.path.exists(old_full_path):
                    os.remove(old_full_path)
            except OSError:
                pass
            db.session.delete(existing)
            db.session.flush()

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)

        rel_path = os.path.join(project_id, report_filename)
        ref_file = ReferenceFile(
            id=str(uuid.uuid4()),
            project_id=project_id,
            filename=report_filename,
            file_path=rel_path,
            file_size=len(report.encode('utf-8')),
            file_type='md',
            parse_status='completed',
            markdown_content=report,
        )
        db.session.add(ref_file)
        db.session.commit()

        logger.info(f"Research complete for project {project_id}, saved as {ref_file.id}")
        return {'report': report, 'sources': sources, 'reference_file_id': ref_file.id}
