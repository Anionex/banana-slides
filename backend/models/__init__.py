"""Database models package"""
from flask_sqlalchemy import SQLAlchemy

# Engine options are selected by the application factory for the active
# database dialect. Constructor-level options would leak SQLite arguments into
# the product MySQL connection.
db = SQLAlchemy()

from .project import Project
from .page import Page
from .task import Task
from .user_template import UserTemplate
from .page_image_version import PageImageVersion
from .material import Material
from .reference_file import ReferenceFile
from .settings import Settings
from .user_style_template import UserStyleTemplate
from .project_template_asset import ProjectTemplateAsset
from .platform_submission_receipt import PlatformSubmissionReceipt

__all__ = ['db', 'Project', 'Page', 'Task', 'UserTemplate', 'PageImageVersion', 'Material', 'ReferenceFile', 'Settings', 'UserStyleTemplate', 'ProjectTemplateAsset', 'PlatformSubmissionReceipt']

