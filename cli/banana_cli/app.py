"""CLI app entry point using Typer."""

from __future__ import annotations

from typing import Optional

import typer

from .config import resolve_config
from .http_client import APIClient
from .state import state
from .commands.projects import app as projects_app
from .commands.pages import app as pages_app
from .commands.workflows import app as workflows_app
from .commands.exports import app as exports_app
from .commands.materials import app as materials_app
from .commands.run import app as run_app
from .commands.settings import app as settings_app
from .commands.tasks import app as tasks_app
from .commands.templates import app as templates_app
from .commands.refs import app as refs_app
from .commands.renovation import app as renovation_app
from .commands.styles import app as styles_app
from .commands.files import app as files_app

app = typer.Typer(
    name="banana-cli",
    help="Banana Slides API-driven CLI",
    no_args_is_help=True,
    pretty_exceptions_enable=False,
)

app.add_typer(projects_app, name="projects", help="Project operations")
app.add_typer(pages_app, name="pages", help="Page operations")
app.add_typer(workflows_app, name="workflows", help="Workflow operations")
app.add_typer(exports_app, name="exports", help="Export operations")
app.add_typer(materials_app, name="materials", help="Material operations")
app.add_typer(run_app, name="run", help="High-level batch execution")
app.add_typer(settings_app, name="settings", help="Settings operations")
app.add_typer(tasks_app, name="tasks", help="Task operations")
app.add_typer(templates_app, name="templates", help="Template operations")
app.add_typer(refs_app, name="refs", help="Reference file operations")
app.add_typer(renovation_app, name="renovation", help="PPT renovation operations")
app.add_typer(styles_app, name="styles", help="Style extraction operations")
app.add_typer(files_app, name="files", help="File transfer operations")


@app.callback()
def main_callback(
    ctx: typer.Context,
    base_url: Optional[str] = typer.Option(None, "--base-url", help="Backend base URL"),
    access_code: Optional[str] = typer.Option(None, "--access-code", help="X-Access-Code header"),
    poll_interval: Optional[int] = typer.Option(None, "--poll-interval", help="Task polling interval seconds"),
    request_timeout: Optional[int] = typer.Option(None, "--request-timeout", help="Request timeout seconds"),
    config: Optional[str] = typer.Option(None, "--config", help="Config file path (TOML)"),
    json_output: bool = typer.Option(False, "--json", help="Output JSON"),
    verbose: bool = typer.Option(False, "--verbose", help="Verbose output"),
) -> None:
    """Banana Slides API-driven CLI."""
    cfg = resolve_config(
        base_url=base_url,
        access_code=access_code,
        poll_interval=poll_interval,
        request_timeout=request_timeout,
        config_path=config,
        json_output=json_output,
        verbose=verbose,
    )
    state.config = cfg
    state.api = APIClient(cfg)
    state.json_output = json_output
    state.verbose = verbose
