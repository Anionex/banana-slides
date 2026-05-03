"""
Task Manager - handles background tasks using ThreadPoolExecutor
No need for Celery or Redis, uses in-memory task tracking
"""
import logging
import os
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, List, Dict, Any, Optional
from datetime import datetime
from math import gcd
import time
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from PIL import Image, ImageDraw, ImageFilter
from models import db, Task, Page, Material, PageImageVersion
from utils import get_filtered_pages
from utils.image_utils import check_image_resolution


def _get_image_prompt_field_names() -> set | None:
    """读取设置中允许进入文生图 prompt 的额外字段名。返回 None 表示全部允许。"""
    try:
        from models import Settings
        settings = Settings.get_settings()
        if settings.image_prompt_extra_fields is None:
            return None  # 未配置 → 全部允许
        return set(settings.get_image_prompt_extra_fields())
    except Exception:
        return None


def _append_extra_fields(desc_text: str, desc_content: dict) -> str:
    """将 extra_fields 拼接到描述文本末尾，供图片生成 prompt 使用。"""
    extra_fields = desc_content.get('extra_fields')
    if not extra_fields or not isinstance(extra_fields, dict):
        return desc_text
    allowed = _get_image_prompt_field_names()
    parts = [desc_text]
    for name, value in extra_fields.items():
        if value and (allowed is None or name in allowed):
            parts.append(f"\n{name}：{value}")
    return ''.join(parts)
from pathlib import Path
from services.pdf_service import split_pdf_to_pages

logger = logging.getLogger(__name__)


class TaskManager:
    """Simple task manager using ThreadPoolExecutor"""
    
    def __init__(self, max_workers: int = 4):
        """Initialize task manager"""
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_tasks = {}  # task_id -> Future
        self.lock = threading.Lock()
    
    def submit_task(self, task_id: str, func: Callable, *args, **kwargs):
        """Submit a background task"""
        future = self.executor.submit(func, task_id, *args, **kwargs)
        
        with self.lock:
            self.active_tasks[task_id] = future
        
        # Add callback to clean up when done and log exceptions
        future.add_done_callback(lambda f: self._task_done_callback(task_id, f))
    
    def _task_done_callback(self, task_id: str, future):
        """Handle task completion and log any exceptions"""
        try:
            # Check if task raised an exception
            exception = future.exception()
            if exception:
                logger.error(f"Task {task_id} failed with exception: {exception}", exc_info=exception)
        except Exception as e:
            logger.error(f"Error in task callback for {task_id}: {e}", exc_info=True)
        finally:
            self._cleanup_task(task_id)
    
    def _cleanup_task(self, task_id: str):
        """Clean up completed task"""
        with self.lock:
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
    
    def is_task_active(self, task_id: str) -> bool:
        """Check if task is still running"""
        with self.lock:
            return task_id in self.active_tasks
    
    def shutdown(self):
        """Shutdown the executor"""
        self.executor.shutdown(wait=True)


# Global task manager instance
task_manager = TaskManager(max_workers=4)


def save_image_with_version(image, project_id: str, page_id: str, file_service,
                            page_obj=None, image_format: str = 'PNG') -> tuple[str, int]:
    """
    保存图片并创建历史版本记录的公共函数

    Args:
        image: PIL Image 对象
        project_id: 项目ID
        page_id: 页面ID
        file_service: FileService 实例
        page_obj: Page 对象（可选，如果提供则更新页面状态）
        image_format: 图片格式，默认 PNG

    Returns:
        tuple: (image_path, version_number) - 图片路径和版本号

    这个函数会：
    1. 计算下一个版本号（使用 MAX 查询确保安全）
    2. 标记所有旧版本为非当前版本
    3. 保存图片到最终位置
    4. 生成并保存压缩的缓存图片
    5. 创建新版本记录
    6. 如果提供了 page_obj，更新页面状态和图片路径
    """
    # 使用 MAX 查询确保版本号安全（即使有版本被删除也不会重复）
    max_version = db.session.query(func.max(PageImageVersion.version_number)).filter_by(page_id=page_id).scalar() or 0
    next_version = max_version + 1

    # 批量更新：标记所有旧版本为非当前版本（使用单条 SQL 更高效）
    PageImageVersion.query.filter_by(page_id=page_id).update({'is_current': False})

    # 保存原图到最终位置（使用版本号）
    image_path = file_service.save_generated_image(
        image, project_id, page_id,
        version_number=next_version,
        image_format=image_format
    )

    # 生成并保存压缩的缓存图片（用于前端快速显示）
    cached_image_path = file_service.save_cached_image(
        image, project_id, page_id,
        version_number=next_version,
        quality=85
    )

    # 创建新版本记录
    new_version = PageImageVersion(
        page_id=page_id,
        image_path=image_path,
        version_number=next_version,
        is_current=True
    )
    db.session.add(new_version)

    # 如果提供了 page_obj，更新页面状态和图片路径
    if page_obj:
        page_obj.generated_image_path = image_path
        page_obj.cached_image_path = cached_image_path
        page_obj.status = 'COMPLETED'
        page_obj.updated_at = datetime.utcnow()

    _commit_with_retry()

    logger.debug(f"Page {page_id} image saved as version {next_version}: {image_path}, cached: {cached_image_path}")

    return image_path, next_version


def _commit_with_retry(max_retries=5, base_delay=0.5):
    for attempt in range(max_retries):
        try:
            db.session.commit()
            return
        except OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                db.session.rollback()
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Database locked, retrying commit in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                raise


SUPPORTED_IMAGE_ASPECT_RATIOS = (
    '1:1',
    '1:4',
    '1:8',
    '2:3',
    '3:2',
    '3:4',
    '4:1',
    '4:3',
    '4:5',
    '5:4',
    '8:1',
    '9:16',
    '16:9',
    '21:9',
)


def _aspect_ratio_from_size(width: int, height: int) -> str:
    """Map arbitrary pixel dimensions to the nearest provider-supported aspect ratio."""
    safe_width = max(1, width)
    safe_height = max(1, height)
    divisor = gcd(safe_width, safe_height)
    normalized = f"{safe_width // divisor}:{safe_height // divisor}"
    if normalized in SUPPORTED_IMAGE_ASPECT_RATIOS:
        return normalized

    source_ratio = safe_width / safe_height
    return min(
        SUPPORTED_IMAGE_ASPECT_RATIOS,
        key=lambda candidate: abs(source_ratio - (int(candidate.split(':')[0]) / int(candidate.split(':')[1]))),
    )


def _normalize_selection_bbox(selection: dict, image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    """Clamp a selection rectangle into source image bounds."""
    width, height = image_size
    x0 = max(0, min(int(selection['x']), width - 1))
    y0 = max(0, min(int(selection['y']), height - 1))
    x1 = max(x0 + 1, min(x0 + int(selection['width']), width))
    y1 = max(y0 + 1, min(y0 + int(selection['height']), height))
    return x0, y0, x1, y1


def _create_marked_reference_image(source_image: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    """Highlight the selected region so edit models can focus on it reliably."""
    marked = source_image.convert('RGB').copy()
    draw = ImageDraw.Draw(marked, 'RGBA')
    outline_width = max(4, min(source_image.size) // 120)
    draw.rectangle(bbox, fill=(0, 0, 0, 190), outline=(255, 255, 255, 255), width=outline_width)
    return marked


def _blend_region_into_source(
    source_image: Image.Image,
    edited_image: Image.Image,
    bbox: tuple[int, int, int, int],
    feather_radius: int = 12,
) -> Image.Image:
    """Blend only the selected region from the edited result back into the source image."""
    if edited_image.size != source_image.size:
        edited_image = edited_image.resize(source_image.size, Image.Resampling.LANCZOS)

    source_rgb = source_image.convert('RGB')
    edited_rgb = edited_image.convert('RGB')
    mask = Image.new('L', source_rgb.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle(bbox, fill=255)
    if feather_radius > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather_radius))
    return Image.composite(edited_rgb, source_rgb, mask)


def _build_region_edit_instruction(prompt: str, operation: str) -> str:
    """Create a focused prompt for region-based edits using a marked reference image."""
    cleaned_prompt = (prompt or '').strip()
    if operation == 'erase_region':
        user_goal = cleaned_prompt or "移除黑色标记区域中的主体内容，并自然补全背景纹理与光影。"
        return (
            "用户会提供两张参考图：一张原图，一张带有黑色实心选区标记的图。\n"
            "请只处理黑色标记区域，将该区域内容移除，并根据周围视觉自然补全。\n"
            "黑色区域之外的构图、文字、光影、色调尽量保持不变。\n"
            f"额外要求：{user_goal}"
        )

    return (
        "用户会提供两张参考图：一张原图，一张带有黑色实心选区标记的图。\n"
        "请重点修改黑色标记区域，严格围绕该区域执行用户指令。\n"
        "未标记区域尽量保持原样，不要无关改动整体构图。\n"
        f"用户编辑要求：{cleaned_prompt}"
    )


def generate_descriptions_task(task_id: str, project_id: str, ai_service,
                               project_context, outline: List[Dict],
                               max_workers: int = 5, app=None,
                               language: str = None,
                               detail_level: str = 'default'):
    """
    Background task for generating page descriptions
    Based on demo.py gen_desc() with parallel processing

    Note: app instance MUST be passed from the request context

    Args:
        task_id: Task ID
        project_id: Project ID
        ai_service: AI service instance
        project_context: ProjectContext object containing all project information
        outline: Complete outline structure
        max_workers: Maximum number of parallel workers
        app: Flask app instance
        language: Output language (zh, en, ja, auto)
        detail_level: Description detail level (concise/default/detailed)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    # 在整个任务中保持应用上下文
    with app.app_context():
        try:
            # 重要：在后台线程开始时就获取task和设置状态
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            logger.info(f"Task {task_id} status updated to PROCESSING")
            
            # Flatten outline to get pages
            pages_data = ai_service.flatten_outline(outline)
            
            # Get all pages for this project
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
            
            if len(pages) != len(pages_data):
                raise ValueError("Page count mismatch")
            
            # Mark all pages as GENERATING_DESCRIPTION before starting
            for page in pages:
                page.status = 'GENERATING_DESCRIPTION'

            # Initialize progress
            task.set_progress({
                "total": len(pages),
                "completed": 0,
                "failed": 0
            })
            db.session.commit()

            # Generate descriptions in parallel
            completed = 0
            failed = 0
            
            def generate_single_desc(page_id, page_outline, page_index):
                """
                Generate description for a single page
                注意：只传递 page_id（字符串），不传递 ORM 对象，避免跨线程会话问题
                """
                # 关键修复：在子线程中也需要应用上下文
                with app.app_context():
                    try:
                        # Get singleton AI service instance
                        from services.ai_service_manager import get_ai_service
                        ai_service = get_ai_service()
                        
                        desc_result = ai_service.generate_page_description(
                            project_context, outline, page_outline, page_index,
                            language=language,
                            detail_level=detail_level
                        )

                        # generate_page_description returns dict with text + optional extra_fields
                        desc_content = {
                            "text": desc_result['text'],
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        if desc_result.get('extra_fields'):
                            desc_content['extra_fields'] = desc_result['extra_fields']
                        
                        return (page_id, desc_content, None)
                    except Exception as e:
                        import traceback
                        error_detail = traceback.format_exc()
                        logger.error(f"Failed to generate description for page {page_id}: {error_detail}")
                        return (page_id, None, str(e))
            
            # Use ThreadPoolExecutor for parallel generation
            # 关键：提前提取 page.id，不要传递 ORM 对象到子线程
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(generate_single_desc, page.id, page_data, i)
                    for i, (page, page_data) in enumerate(zip(pages, pages_data), 1)
                ]
                
                # Process results as they complete
                for future in as_completed(futures):
                    page_id, desc_content, error = future.result()
                    
                    db.session.expire_all()
                    
                    # Update page in database
                    page = Page.query.get(page_id)
                    if page:
                        if error:
                            page.status = 'FAILED'
                            failed += 1
                        else:
                            page.set_description_content(desc_content)
                            page.status = 'DESCRIPTION_GENERATED'
                            completed += 1
                        
                        db.session.commit()
                    
                    # Update task progress
                    task = Task.query.get(task_id)
                    if task:
                        task.update_progress(completed=completed, failed=failed)
                        db.session.commit()
                        logger.info(f"Description Progress: {completed}/{len(pages)} pages completed")
            
            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                db.session.commit()
                logger.info(f"Task {task_id} COMPLETED - {completed} pages generated, {failed} failed")
            
            # Update project status
            from models import Project
            project = Project.query.get(project_id)
            if project and failed == 0:
                project.status = 'DESCRIPTIONS_GENERATED'
                db.session.commit()
                logger.info(f"Project {project_id} status updated to DESCRIPTIONS_GENERATED")
        
        except Exception as e:
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def generate_images_task(task_id: str, project_id: str, ai_service, file_service,
                        outline: List[Dict], use_template: bool = True, 
                        max_workers: int = 8, aspect_ratio: str = "16:9",
                        resolution: str = "2K", app=None,
                        extra_requirements: str = None,
                        language: str = None,
                        page_ids: list = None):
    """
    Background task for generating page images
    Based on demo.py gen_images_parallel()
    
    Note: app instance MUST be passed from the request context
    
    Args:
        language: Output language (zh, en, ja, auto)
        page_ids: Optional list of page IDs to generate (if not provided, generates all pages)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            
            # Get pages for this project (filtered by page_ids if provided)
            pages = get_filtered_pages(project_id, page_ids)
            all_pages_data = ai_service.flatten_outline(outline)

            # Build mapping from order_index to page_data so filtered pages
            # get matched to the correct outline entry (not just first N)
            pages_data_by_index = {i: pd for i, pd in enumerate(all_pages_data)}
            
            # 注意：不在任务开始时获取模板路径，而是在每个子线程中动态获取
            # 这样可以确保即使用户在上传新模板后立即生成，也能使用最新模板
            
            # Initialize progress
            task.set_progress({
                "total": len(pages),
                "completed": 0,
                "failed": 0
            })
            db.session.commit()
            
            # Generate images in parallel
            completed = 0
            failed = 0
            resolution_mismatched = 0  # Count of resolution mismatches
            
            def generate_single_image(page_id, page_data, page_index):
                """
                Generate image for a single page
                注意：只传递 page_id（字符串），不传递 ORM 对象，避免跨线程会话问题
                """
                # 关键修复：在子线程中也需要应用上下文
                with app.app_context():
                    try:
                        logger.debug(f"Starting image generation for page {page_id}, index {page_index}")
                        # Get page from database in this thread
                        page_obj = Page.query.get(page_id)
                        if not page_obj:
                            raise ValueError(f"Page {page_id} not found")
                        
                        # Update page status
                        page_obj.status = 'GENERATING'
                        db.session.commit()
                        logger.debug(f"Page {page_id} status updated to GENERATING")
                        
                        # Get description content
                        desc_content = page_obj.get_description_content()
                        if not desc_content:
                            raise ValueError("No description content for page")
                        
                        # 获取描述文本（可能是 text 字段或 text_content 数组）
                        desc_text = desc_content.get('text', '')
                        if not desc_text and desc_content.get('text_content'):
                            # 如果 text 字段不存在，尝试从 text_content 数组获取
                            text_content = desc_content.get('text_content', [])
                            if isinstance(text_content, list):
                                desc_text = '\n'.join(text_content)
                            else:
                                desc_text = str(text_content)

                        # 将 extra_fields 拼入描述文本供图片生成使用
                        desc_text = _append_extra_fields(desc_text, desc_content)

                        logger.debug(f"Got description text for page {page_id}: {desc_text[:100]}...")
                        
                        # 从当前页面的描述内容中提取图片 URL
                        page_additional_ref_images = []
                        has_material_images = False
                        
                        # 从描述文本中提取图片
                        if desc_text:
                            image_urls = ai_service.extract_image_urls_from_markdown(desc_text)
                            if image_urls:
                                logger.info(f"Found {len(image_urls)} image(s) in page {page_id} description")
                                page_additional_ref_images = image_urls
                                has_material_images = True
                        
                        # 在子线程中动态获取模板路径，确保使用最新模板
                        page_ref_image_path = None
                        if use_template:
                            page_ref_image_path = file_service.get_template_path(project_id)
                            # 注意：如果有风格描述，即使没有模板图片也允许生成
                            # 这个检查已经在 controller 层完成，这里不再检查
                        
                        # Generate image prompt
                        prompt = ai_service.generate_image_prompt(
                            outline, page_data, desc_text, page_index,
                            has_material_images=has_material_images,
                            extra_requirements=extra_requirements,
                            language=language,
                            has_template=use_template,
                            aspect_ratio=aspect_ratio
                        )
                        logger.debug(f"Generated image prompt for page {page_id}")
                        
                        # Generate image
                        logger.info(f"🎨 Calling AI service to generate image for page {page_index}/{len(pages)}...")
                        image = ai_service.generate_image(
                            prompt, page_ref_image_path, aspect_ratio, resolution,
                            additional_ref_images=page_additional_ref_images if page_additional_ref_images else None
                        )
                        logger.info(f"✅ Image generated successfully for page {page_index}")
                        
                        if not image:
                            raise ValueError("Failed to generate image")
                        
                        # Check resolution for all providers
                        actual_res, is_match = check_image_resolution(image, resolution)
                        if not is_match:
                            logger.warning(f"Resolution mismatch for page {page_index}: requested {resolution}, got {actual_res}")
                        
                        # 优化：直接在子线程中计算版本号并保存到最终位置
                        # 每个页面独立，使用数据库事务保证版本号原子性，避免临时文件
                        image_path, next_version = save_image_with_version(
                            image, project_id, page_id, file_service, page_obj=page_obj
                        )
                        
                        return (page_id, image_path, None, not is_match)
                        
                    except Exception as e:
                        import traceback
                        error_detail = traceback.format_exc()
                        logger.error(f"Failed to generate image for page {page_id}: {error_detail}")
                        return (page_id, None, str(e), None)
            
            # Use ThreadPoolExecutor for parallel generation
            # 关键：提前提取 page.id，不要传递 ORM 对象到子线程
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(
                        generate_single_image, page.id,
                        pages_data_by_index.get(page.order_index, {}), i
                    )
                    for i, page in enumerate(pages, 1)
                ]
                
                # Process results as they complete
                for future in as_completed(futures):
                    page_id, image_path, error, is_mismatched = future.result()
                    
                    if is_mismatched:
                        resolution_mismatched += 1
                    
                    db.session.expire_all()
                    
                    # Update page in database (主要是为了更新失败状态)
                    page = Page.query.get(page_id)
                    if page:
                        if error:
                            page.status = 'FAILED'
                            failed += 1
                            db.session.commit()
                        else:
                            # 图片已在子线程中保存并创建版本记录，这里只需要更新计数
                            completed += 1
                            # 刷新页面对象以获取最新状态
                            db.session.refresh(page)
                    
                    # Update task progress
                    task = Task.query.get(task_id)
                    if task:
                        progress = task.get_progress()
                        progress['completed'] = completed
                        progress['failed'] = failed
                        # 第一次检测到不匹配时设置警告
                        if resolution_mismatched > 0 and 'warning_message' not in progress:
                            progress['warning_message'] = "图片返回分辨率与设置不符，建议使用gemini格式以避免此问题"
                        task.set_progress(progress)
                        db.session.commit()
                        logger.info(f"Image Progress: {completed}/{len(pages)} pages completed")
            
            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                if resolution_mismatched > 0:
                    logger.warning(f"Task {task_id} has {resolution_mismatched} resolution mismatches")
                db.session.commit()
                logger.info(f"Task {task_id} COMPLETED - {completed} images generated, {failed} failed")
            
            # Update project status
            from models import Project
            project = Project.query.get(project_id)
            if project and failed == 0:
                project.status = 'COMPLETED'
                db.session.commit()
                logger.info(f"Project {project_id} status updated to COMPLETED")
        
        except Exception as e:
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def generate_single_page_image_task(task_id: str, project_id: str, page_id: str, 
                                    ai_service, file_service, outline: List[Dict],
                                    use_template: bool = True, aspect_ratio: str = "16:9",
                                    resolution: str = "2K", app=None,
                                    extra_requirements: str = None,
                                    language: str = None):
    """
    Background task for generating a single page image
    
    Note: app instance MUST be passed from the request context
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            
            # Get page from database
            page = Page.query.get(page_id)
            if not page or page.project_id != project_id:
                raise ValueError(f"Page {page_id} not found")
            
            # Update page status
            page.status = 'GENERATING'
            db.session.commit()
            
            # Get description content
            desc_content = page.get_description_content()
            if not desc_content:
                raise ValueError("No description content for page")
            
            # 获取描述文本（可能是 text 字段或 text_content 数组）
            desc_text = desc_content.get('text', '')
            if not desc_text and desc_content.get('text_content'):
                text_content = desc_content.get('text_content', [])
                if isinstance(text_content, list):
                    desc_text = '\n'.join(text_content)
                else:
                    desc_text = str(text_content)

            # 将 extra_fields 拼入描述文本供图片生成使用
            desc_text = _append_extra_fields(desc_text, desc_content)

            # 从描述文本中提取图片 URL
            additional_ref_images = []
            has_material_images = False
            
            if desc_text:
                image_urls = ai_service.extract_image_urls_from_markdown(desc_text)
                if image_urls:
                    logger.info(f"Found {len(image_urls)} image(s) in page {page_id} description")
                    additional_ref_images = image_urls
                    has_material_images = True
            
            # Get template path if use_template
            ref_image_path = None
            if use_template:
                ref_image_path = file_service.get_template_path(project_id)
                # 注意：如果有风格描述，即使没有模板图片也允许生成
                # 这个检查已经在 controller 层完成，这里不再检查
            
            # Generate image prompt
            page_data = page.get_outline_content() or {}
            if page.part:
                page_data['part'] = page.part
            
            prompt = ai_service.generate_image_prompt(
                outline, page_data, desc_text, page.order_index + 1,
                has_material_images=has_material_images,
                extra_requirements=extra_requirements,
                language=language,
                has_template=use_template,
                aspect_ratio=aspect_ratio
            )
            
            # Generate image
            logger.info(f"🎨 Generating image for page {page_id}...")
            image = ai_service.generate_image(
                prompt, ref_image_path, aspect_ratio, resolution,
                additional_ref_images=additional_ref_images if additional_ref_images else None
            )
            
            if not image:
                raise ValueError("Failed to generate image")
            
            # 保存图片并创建历史版本记录
            image_path, next_version = save_image_with_version(
                image, project_id, page_id, file_service, page_obj=page
            )
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Page {page_id} image generated")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
            
            # Update page status
            page = Page.query.get(page_id)
            if page:
                page.status = 'FAILED'
                db.session.commit()


def edit_page_image_task(task_id: str, project_id: str, page_id: str,
                         edit_instruction: str, ai_service, file_service,
                         aspect_ratio: str = "16:9", resolution: str = "2K",
                         original_description: str = None,
                         additional_ref_images: List[str] = None,
                         temp_dir: str = None, app=None):
    """
    Background task for editing a page image
    
    Note: app instance MUST be passed from the request context
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            
            # Get page from database
            page = Page.query.get(page_id)
            if not page or page.project_id != project_id:
                raise ValueError(f"Page {page_id} not found")
            
            if not page.generated_image_path:
                raise ValueError("Page must have generated image first")
            
            # Update page status
            page.status = 'GENERATING'
            db.session.commit()
            
            # Get current image path
            current_image_path = file_service.get_absolute_path(page.generated_image_path)
            
            # Edit image
            logger.info(f"🎨 Editing image for page {page_id}...")
            try:
                image = ai_service.edit_image(
                    edit_instruction,
                    current_image_path,
                    aspect_ratio,
                    resolution,
                    original_description=original_description,
                    additional_ref_images=additional_ref_images if additional_ref_images else None
                )
            finally:
                # Clean up temp directory if created
                if temp_dir:
                    import shutil
                    from pathlib import Path
                    temp_path = Path(temp_dir)
                    if temp_path.exists():
                        shutil.rmtree(temp_dir)
            
            if not image:
                raise ValueError("Failed to edit image")
            
            # 保存编辑后的图片并创建历史版本记录
            image_path, next_version = save_image_with_version(
                image, project_id, page_id, file_service, page_obj=page
            )
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Page {page_id} image edited")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Clean up temp directory on error
            if temp_dir:
                import shutil
                from pathlib import Path
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir)
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
            
            # Update page status
            page = Page.query.get(page_id)
            if page:
                page.status = 'FAILED'
                db.session.commit()


def generate_material_image_task(task_id: str, project_id: str, prompt: str,
                                 ai_service, file_service,
                                 ref_image_path: str = None,
                                 additional_ref_images: List[str] = None,
                                 aspect_ratio: str = "16:9",
                                 resolution: str = "2K",
                                 temp_dir: str = None, app=None):
    """
    Background task for generating a material image
    复用核心的generate_image逻辑，但保存到Material表而不是Page表
    
    Note: app instance MUST be passed from the request context
    project_id can be None for global materials (but Task model requires a project_id,
    so we use a special value 'global' for task tracking)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            
            # Generate image (复用核心逻辑)
            logger.info(f"🎨 Generating material image with prompt: {prompt[:100]}...")
            image = ai_service.generate_image(
                prompt=prompt,
                ref_image_path=ref_image_path,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                additional_ref_images=additional_ref_images or None,
            )
            
            if not image:
                raise ValueError("Failed to generate image")
            
            # 处理project_id：如果为'global'或None，转换为None
            actual_project_id = None if (project_id == 'global' or project_id is None) else project_id
            
            # Save generated material image
            relative_path = file_service.save_material_image(image, actual_project_id)
            relative = Path(relative_path)
            filename = relative.name
            
            # Construct frontend-accessible URL
            image_url = file_service.get_file_url(actual_project_id, 'materials', filename)
            
            # Save material info to database
            material = Material(
                project_id=actual_project_id,
                filename=filename,
                relative_path=relative_path,
                url=image_url
            )
            db.session.add(material)
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0,
                "material_id": material.id,
                "image_url": image_url
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Material {material.id} generated")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
        
        finally:
            if temp_dir:
                import shutil
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)


def process_material_image_task(
    task_id: str,
    project_id: str,
    operation: str,
    prompt: str,
    ai_service,
    file_service,
    source_image_path: str = None,
    ref_image_path: str = None,
    additional_ref_images: List[str] = None,
    aspect_ratio: str = "16:9",
    resolution: str = "2K",
    selection: Optional[dict] = None,
    apply_mode: str = "overlay_selection",
    temp_dir: str = None,
    app=None,
):
    """Unified material processing task for generate/edit/region-edit workflows."""
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        try:
            task = Task.query.get(task_id)
            if not task:
                return

            task.status = 'PROCESSING'
            db.session.commit()

            refs = list(additional_ref_images or [])
            result_image: Optional[Image.Image] = None
            source_image = None
            source_aspect_ratio = aspect_ratio

            if source_image_path:
                source_image = Image.open(source_image_path).convert('RGB')
                source_aspect_ratio = _aspect_ratio_from_size(*source_image.size)

            if operation == 'generate':
                result_image = ai_service.generate_image(
                    prompt=prompt,
                    ref_image_path=ref_image_path,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    additional_ref_images=refs if refs else None,
                )
            elif operation == 'edit_full':
                if not source_image_path:
                    raise ValueError("source_image_path is required for edit_full")

                if ref_image_path:
                    refs.insert(0, ref_image_path)

                result_image = ai_service.edit_image(
                    prompt=prompt,
                    current_image_path=source_image_path,
                    aspect_ratio=source_aspect_ratio,
                    resolution=resolution,
                    additional_ref_images=refs if refs else None,
                )
            elif operation in {'region_edit', 'erase_region'}:
                if not source_image or not source_image_path:
                    raise ValueError("source_image_path is required for region operations")
                if not selection:
                    raise ValueError("selection is required for region operations")

                bbox = _normalize_selection_bbox(selection, source_image.size)
                marked_reference = _create_marked_reference_image(source_image, bbox)
                if not temp_dir:
                    raise ValueError("区域操作需要 temp_dir")

                marked_reference_path = str(Path(temp_dir) / f"{task_id}_marked_region.png")
                marked_reference.save(marked_reference_path)
                refs.insert(0, marked_reference_path)

                if ref_image_path:
                    refs.insert(0, ref_image_path)

                instruction = _build_region_edit_instruction(prompt, operation)
                generated = ai_service.edit_image(
                    prompt=instruction,
                    current_image_path=source_image_path,
                    aspect_ratio=source_aspect_ratio,
                    resolution=resolution,
                    additional_ref_images=refs if refs else None,
                )

                if generated is None:
                    raise ValueError("Failed to process region edit")

                if generated.size != source_image.size:
                    generated = generated.resize(source_image.size, Image.Resampling.LANCZOS)

                if operation == 'erase_region' or apply_mode == 'overlay_selection':
                    result_image = _blend_region_into_source(source_image, generated, bbox)
                else:
                    result_image = generated
            else:
                raise ValueError(f"Unsupported material operation: {operation}")

            if result_image is None:
                raise ValueError("Failed to generate image")

            actual_project_id = None if (project_id == 'global' or project_id is None) else project_id
            relative_path = file_service.save_material_image(result_image, actual_project_id)
            relative = Path(relative_path)
            filename = relative.name
            image_url = file_service.get_file_url(actual_project_id, 'materials', filename)

            material = Material(
                project_id=actual_project_id,
                filename=filename,
                relative_path=relative_path,
                url=image_url
            )
            db.session.add(material)

            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0,
                "operation": operation,
                "apply_mode": apply_mode if operation == 'region_edit' else None,
                "selection": selection if operation in {'region_edit', 'erase_region'} else None,
                "material_id": material.id,
                "image_url": image_url
            })
            db.session.commit()

            logger.info(f"✅ Task {task_id} COMPLETED - Material {material.id} processed via {operation}")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")

            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()

        finally:
            if source_image is not None:
                try:
                    source_image.close()
                except Exception:
                    pass
            if temp_dir:
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)


def process_ppt_renovation_task(task_id: str, project_id: str, ai_service,
                                file_service, file_parser_service,
                                keep_layout: bool = False,
                                max_workers: int = 5, app=None,
                                language: str = 'zh'):
    """
    Background task for PPT renovation: parse PDF pages → extract content → fill outline + description

    Flow:
    1. Split PDF → per-page PDFs
    2. Parallel: parse each page PDF → markdown via fileparser
    3. Parallel: AI extract {title, points, description} from each markdown
    4. If keep_layout: parallel caption model describe layout → append to description
    5. Update page.outline_content + page.description_content
    6. Concatenate descriptions → project.description_text
    7. project.status = DESCRIPTIONS_GENERATED

    Args:
        task_id: Task ID
        project_id: Project ID
        ai_service: AI service instance
        file_service: FileService instance
        file_parser_service: FileParserService instance
        keep_layout: Whether to preserve original layout via caption model
        max_workers: Maximum parallel workers
        app: Flask app instance
        language: Output language
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        try:
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return

            task.status = 'PROCESSING'
            db.session.commit()

            from models import Project
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            # Get the PDF path from project
            pdf_path = None
            project_dir = Path(app.config['UPLOAD_FOLDER']) / project_id
            # Look for the uploaded PDF file
            for f in (project_dir / "template").iterdir() if (project_dir / "template").exists() else []:
                if f.suffix.lower() == '.pdf':
                    pdf_path = str(f)
                    break

            if not pdf_path:
                raise ValueError("No PDF file found for renovation project")

            # Step 1: Split PDF into per-page PDFs
            split_dir = str(project_dir / "split_pages")
            page_pdfs = split_pdf_to_pages(pdf_path, split_dir)
            logger.info(f"Split PDF into {len(page_pdfs)} pages")

            # Get existing pages
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

            # Ensure page count matches
            if len(pages) != len(page_pdfs):
                logger.warning(f"Page count mismatch: {len(pages)} pages vs {len(page_pdfs)} PDFs. Using min.")
            page_count = min(len(pages), len(page_pdfs))
            if page_count == 0:
                raise ValueError("No pages to process")

            task.set_progress({
                "total": page_count,
                "completed": 0,
                "failed": 0,
                "current_step": "parsing"
            })
            db.session.commit()

            # Process each page as an independent pipeline:
            # parse markdown → AI extract content → (optional layout caption) → write to DB
            logger.info("Processing pages (parse → extract → save pipeline)...")
            import threading
            progress_lock = threading.Lock()
            completed = 0
            failed = 0
            extraction_errors = []
            content_results = {}  # index -> {title, points, description}

            def process_single_page(idx, page_pdf_path):
                nonlocal completed, failed
                with app.app_context():
                    try:
                        # Step A: Parse page PDF → markdown
                        filename = os.path.basename(page_pdf_path)
                        _batch_id, md_text, extract_id, error_msg, _failed = file_parser_service.parse_file(page_pdf_path, filename)
                        if error_msg:
                            logger.warning(f"Page {idx} parse warning: {error_msg}")
                        md_text = md_text or ''

                        # Supplement with header/footer from layout.json
                        if extract_id:
                            hf_text = file_parser_service.extract_header_footer_from_layout(extract_id)
                            if hf_text:
                                md_text = hf_text + '\n\n' + md_text

                        if not md_text.strip():
                            content = {'title': f'Page {idx + 1}', 'points': [], 'description': ''}
                            error = 'empty_input'
                        else:
                            # Step B: AI extract structured content
                            content = ai_service.extract_page_content(md_text, language=language)
                            error = None

                        # Step C: Optional layout caption
                        if keep_layout and not error:
                            try:
                                page_obj = pages[idx] if idx < len(pages) else None
                                if page_obj:
                                    image_path = None
                                    if page_obj.cached_image_path:
                                        image_path = file_service.get_absolute_path(page_obj.cached_image_path)
                                    elif page_obj.generated_image_path:
                                        image_path = file_service.get_absolute_path(page_obj.generated_image_path)
                                    if image_path and Path(image_path).exists():
                                        caption = ai_service.generate_layout_caption(image_path)
                                        if caption:
                                            content['description'] += f"\n\n{caption}"
                            except Exception as e:
                                logger.error(f"Layout caption failed for page {idx}: {e}")

                        # Step D: Write to DB immediately
                        content_results[idx] = content
                        page_obj = Page.query.get(pages[idx].id)
                        if page_obj:
                            title = content.get('title', f'Page {idx + 1}')
                            points = content.get('points', [])
                            description = content.get('description', '')

                            page_obj.set_outline_content({
                                'title': title,
                                'points': points
                            })
                            page_obj.set_description_content({
                                "text": description,
                                "generated_at": datetime.utcnow().isoformat()
                            })
                            page_obj.status = 'DESCRIPTION_GENERATED'
                            db.session.commit()

                        with progress_lock:
                            if error and error != 'empty_input':
                                failed += 1
                                extraction_errors.append(error)
                            else:
                                completed += 1
                            task_obj = Task.query.get(task_id)
                            if task_obj:
                                task_obj.update_progress(completed=completed, failed=failed)
                                db.session.commit()

                        logger.info(f"Page {idx} pipeline done (completed={completed}, failed={failed})")

                    except Exception as e:
                        logger.error(f"Pipeline failed for page {idx}: {e}")
                        with progress_lock:
                            failed += 1
                            extraction_errors.append(str(e))
                            task_obj = Task.query.get(task_id)
                            if task_obj:
                                task_obj.update_progress(completed=completed, failed=failed)
                                db.session.commit()

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(process_single_page, i, page_pdfs[i])
                    for i in range(page_count)
                ]
                for future in as_completed(futures):
                    future.result()  # propagate any unexpected exceptions

            logger.info(f"All pages processed: {completed} completed, {failed} failed")

            # Fail-fast: any extraction failure aborts the entire task
            if failed > 0:
                reason = extraction_errors[0] if extraction_errors else "empty page content"
                raise ValueError(f"{failed}/{page_count} 页内容提取失败: {reason}")

            # Update project-level aggregated text
            project = Project.query.get(project_id)
            if project:
                all_outlines = []
                all_descriptions = []
                for i in range(page_count):
                    content = content_results.get(i, {})
                    title = content.get('title', '')
                    points = content.get('points', [])
                    description = content.get('description', '')
                    header = f"第{i + 1}页：{title}"
                    if points:
                        all_outlines.append(f"{header}\n" + "\n".join(f"- {p}" for p in points))
                    else:
                        all_outlines.append(header)
                    all_descriptions.append(f"--- 第{i + 1}页 ---\n{description}")
                project.outline_text = "\n\n".join(all_outlines)
                project.description_text = "\n\n".join(all_descriptions)
                project.status = 'DESCRIPTIONS_GENERATED'
                project.updated_at = datetime.utcnow()

            db.session.commit()

            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": page_count,
                    "completed": completed,
                    "failed": failed,
                    "current_step": "done"
                })
                db.session.commit()

            logger.info(f"Task {task_id} COMPLETED - PPT renovation processed {page_count} pages")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")

            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()

            # Reset project status so user can retry
            project = Project.query.get(project_id)
            if project:
                project.status = 'DRAFT'

            db.session.commit()


def export_editable_pptx_with_recursive_analysis_task(
    task_id: str,
    project_id: str,
    filename: str,
    file_service,
    page_ids: list = None,
    max_depth: int = 2,
    max_workers: int = 4,
    export_extractor_method: str = 'hybrid',
    export_inpaint_method: str = 'hybrid',
    app=None
):
    """
    使用递归图片可编辑化分析导出可编辑PPTX的后台任务
    
    这是新的架构方法，使用ImageEditabilityService进行递归版面分析。
    与旧方法的区别：
    - 不再假设图片是16:9
    - 支持任意尺寸和分辨率
    - 递归分析图片中的子图和图表
    - 更智能的坐标映射和元素提取
    - 不需要 ai_service（使用 ImageEditabilityService 和 MinerU）
    
    Args:
        task_id: 任务ID
        project_id: 项目ID
        filename: 输出文件名
        file_service: 文件服务实例
        page_ids: 可选的页面ID列表（如果提供，只导出这些页面）
        max_depth: 最大递归深度
        max_workers: 并发处理数
        export_extractor_method: 组件提取方法 ('mineru' 或 'hybrid')
        export_inpaint_method: 背景修复方法 ('generative', 'baidu', 'hybrid')
        app: Flask应用实例
    """
    logger.info(f"🚀 Task {task_id} started: export_editable_pptx_with_recursive_analysis (project={project_id}, depth={max_depth}, workers={max_workers}, extractor={export_extractor_method}, inpaint={export_inpaint_method})")
    
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        import os
        from datetime import datetime
        from PIL import Image
        from models import Project
        from services.export_service import ExportService, ExportError

        logger.info(f"开始递归分析导出任务 {task_id} for project {project_id}")

        try:
            # Get project
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f'Project {project_id} not found')

            # 读取项目的导出设置：是否允许返回半成品
            export_allow_partial = project.export_allow_partial or False
            fail_fast = not export_allow_partial
            logger.info(f"导出设置: export_allow_partial={export_allow_partial}, fail_fast={fail_fast}")

            # IMPORTANT: Expire cached objects to ensure fresh data from database
            # This prevents reading stale generated_image_path after page regeneration
            db.session.expire_all()

            # Get pages (filtered by page_ids if provided)
            pages = get_filtered_pages(project_id, page_ids)
            if not pages:
                raise ValueError('No pages found for project')
            
            image_paths = []
            for page in pages:
                if page.generated_image_path:
                    img_path = file_service.get_absolute_path(page.generated_image_path)
                    if os.path.exists(img_path):
                        image_paths.append(img_path)
            
            if not image_paths:
                raise ValueError('No generated images found for project')
            
            logger.info(f"找到 {len(image_paths)} 张图片")
            
            # 初始化任务进度（包含消息日志）
            task = Task.query.get(task_id)
            task.set_progress({
                "total": 100,  # 使用百分比
                "completed": 0,
                "failed": 0,
                "current_step": "准备中...",
                "percent": 0,
                "messages": ["🚀 开始导出可编辑PPTX..."]  # 消息日志
            })
            db.session.commit()
            
            # 进度回调函数 - 更新数据库中的进度
            progress_messages = ["🚀 开始导出可编辑PPTX..."]
            max_messages = 10  # 最多保留最近10条消息
            
            def progress_callback(step: str, message: str, percent: int):
                """更新任务进度到数据库"""
                nonlocal progress_messages
                try:
                    # 添加新消息到日志
                    new_message = f"[{step}] {message}"
                    progress_messages.append(new_message)
                    # 只保留最近的消息
                    if len(progress_messages) > max_messages:
                        progress_messages = progress_messages[-max_messages:]
                    
                    # 更新数据库
                    task = Task.query.get(task_id)
                    if task:
                        task.set_progress({
                            "total": 100,
                            "completed": percent,
                            "failed": 0,
                            "current_step": message,
                            "percent": percent,
                            "messages": progress_messages.copy()
                        })
                        db.session.commit()
                except Exception as e:
                    logger.warning(f"更新进度失败: {e}")
            
            # Step 1: 准备工作
            logger.info("Step 1: 准备工作...")
            progress_callback("准备", f"找到 {len(image_paths)} 张幻灯片图片", 2)
            
            # 准备输出路径
            exports_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports')
            os.makedirs(exports_dir, exist_ok=True)
            
            # Handle filename collision
            if not filename.endswith('.pptx'):
                filename += '.pptx'
            
            output_path = os.path.join(exports_dir, filename)
            if os.path.exists(output_path):
                base_name = filename.rsplit('.', 1)[0]
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                filename = f"{base_name}_{timestamp}.pptx"
                output_path = os.path.join(exports_dir, filename)
                logger.info(f"文件名冲突，使用新文件名: {filename}")
            
            # 获取第一张图片的尺寸作为参考
            first_img = Image.open(image_paths[0])
            slide_width, slide_height = first_img.size
            first_img.close()
            
            logger.info(f"幻灯片尺寸: {slide_width}x{slide_height}")
            logger.info(f"递归深度: {max_depth}, 并发数: {max_workers}")
            progress_callback("准备", f"幻灯片尺寸: {slide_width}×{slide_height}", 3)
            
            # Step 2: 创建文字属性提取器
            from services.image_editability import TextAttributeExtractorFactory
            text_attribute_extractor = TextAttributeExtractorFactory.create_caption_model_extractor()
            progress_callback("准备", "文字属性提取器已初始化", 5)
            
            # Step 3: 调用导出方法（使用项目的导出设置）
            logger.info(f"Step 3: 创建可编辑PPTX (extractor={export_extractor_method}, inpaint={export_inpaint_method}, fail_fast={fail_fast})...")
            progress_callback("配置", f"提取方法: {export_extractor_method}, 背景修复: {export_inpaint_method}", 6)

            _, export_warnings = ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=image_paths,
                output_file=output_path,
                slide_width_pixels=slide_width,
                slide_height_pixels=slide_height,
                max_depth=max_depth,
                max_workers=max_workers,
                text_attribute_extractor=text_attribute_extractor,
                progress_callback=progress_callback,
                export_extractor_method=export_extractor_method,
                export_inpaint_method=export_inpaint_method,
                fail_fast=fail_fast
            )
            
            logger.info(f"✓ 可编辑PPTX已创建: {output_path}")
            
            # Step 4: 标记任务完成
            download_path = f"/files/{project_id}/exports/{filename}"
            
            # 添加完成消息
            progress_messages.append("✅ 导出完成！")
            
            # 添加警告信息（如果有）
            warning_messages = []
            if export_warnings and export_warnings.has_warnings():
                warning_messages = export_warnings.to_summary()
                progress_messages.extend(warning_messages)
                logger.warning(f"导出有 {len(warning_messages)} 条警告")
            
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": 100,
                    "completed": 100,
                    "failed": 0,
                    "current_step": "✓ 导出完成",
                    "percent": 100,
                    "messages": progress_messages,
                    "download_url": download_path,
                    "filename": filename,
                    "method": "recursive_analysis",
                    "max_depth": max_depth,
                    "warnings": warning_messages,  # 单独的警告列表
                    "warning_details": export_warnings.to_dict() if export_warnings else {}  # 详细警告信息
                })
                db.session.commit()
                logger.info(f"✓ 任务 {task_id} 完成 - 递归分析导出成功（深度={max_depth}）")

        except ExportError as e:
            # 导出错误（fail_fast 模式下的详细错误）
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"✗ 任务 {task_id} 导出失败: {e.message}")
            logger.error(f"错误类型: {e.error_type}, 详情: {e.details}")

            # 标记任务失败，包含详细错误信息
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                # 构建详细的错误消息
                error_message = f"{e.message}"
                if e.help_text:
                    error_message += f"\n\n💡 {e.help_text}"
                task.error_message = error_message
                task.completed_at = datetime.utcnow()
                # 在 progress 中保存详细错误信息
                task.set_progress({
                    "total": 100,
                    "completed": 0,
                    "failed": 1,
                    "current_step": "导出失败",
                    "percent": 0,
                    "error_type": e.error_type,
                    "error_details": e.details,
                    "help_text": e.help_text
                })
                db.session.commit()

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"✗ 任务 {task_id} 失败: {error_detail}")

            # 标记任务失败
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def export_video_task(
    task_id: str,
    project_id: str,
    filename: str,
    file_service,
    voice: str = 'zh-CN-XiaoxiaoNeural',
    rate: str = '+0%',
    generate_narration: bool = True,
    enable_ken_burns: bool = False,
    include_no_image_pages: bool = False,
    page_ids: list = None,
    language: str = 'zh',
    app=None,
):
    """
    后台任务：导出 TTS 播报视频 (MP4)

    流程:
      0-20%  为缺少旁白的页面生成 narration_text（AI）
      20-50% 逐页生成 TTS 音频（edge-tts）
      50-90% 逐页创建 Ken Burns 视频片段（FFmpeg）
      90-100% 合成最终 MP4
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        import os
        from models import Project
        from services.tts_video_service import (
            generate_narration_video,
            check_ffmpeg_available,
            check_ffmpeg_ass_filter_available,
            create_placeholder_frame,
        )

        progress_messages = ["🚀 开始导出讲解视频..."]
        max_messages = 10

        def progress_callback(step: str, message: str, percent: int):
            """进度回调 — percent 范围对应 generate_narration_video 的内部进度 (20-95%)"""
            nonlocal progress_messages
            try:
                new_message = f"[{step}] {message}"
                progress_messages.append(new_message)
                if len(progress_messages) > max_messages:
                    progress_messages = progress_messages[-max_messages:]

                # 将内部 0-100% 映射到总体 20-95%
                mapped_pct = int(20 + percent * 0.75)
                mapped_pct = min(mapped_pct, 95)

                task = Task.query.get(task_id)
                if task:
                    task.set_progress({
                        "total": 100,
                        "completed": mapped_pct,
                        "failed": 0,
                        "current_step": message,
                        "percent": mapped_pct,
                        "messages": progress_messages.copy(),
                    })
                    db.session.commit()
            except Exception as e:
                logger.warning(f"更新进度失败: {e}")

        try:
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return

            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            export_allow_partial = project.export_allow_partial or False
            fail_fast = not export_allow_partial
            logger.info(f"视频导出设置: export_allow_partial={export_allow_partial}, fail_fast={fail_fast}")

            task.status = 'PROCESSING'
            task.set_progress({
                "total": 100,
                "completed": 0,
                "failed": 0,
                "current_step": "准备中...",
                "percent": 0,
                "messages": progress_messages,
            })
            db.session.commit()

            # 检查 FFmpeg
            ffmpeg_path = app.config.get('FFMPEG_PATH', 'ffmpeg')
            if not check_ffmpeg_available(ffmpeg_path):
                raise RuntimeError(
                    "FFmpeg 未安装或不在 PATH 中。请安装 FFmpeg 以使用视频导出功能。"
                )

            progress_callback("准备", "FFmpeg 可用", 2)
            if not check_ffmpeg_ass_filter_available(ffmpeg_path):
                progress_callback("准备", "当前 FFmpeg 缺少 ASS 字幕滤镜，若需字幕请先安装带 libass 的版本", 3)

            # 获取页面
            pages = get_filtered_pages(project_id, page_ids)
            if not pages:
                raise ValueError("没有找到可导出的页面")

            # 构建页面列表：有图片的用实际图片，无图片的根据选项处理
            valid_pages = []
            placeholder_dir = None

            if include_no_image_pages:
                video_width = app.config.get('VIDEO_OUTPUT_WIDTH', 1920)
                video_height = app.config.get('VIDEO_OUTPUT_HEIGHT', 1080)
                placeholder_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports', f'_placeholder_{task_id}')
                os.makedirs(placeholder_dir, exist_ok=True)

            for page in pages:
                if page.generated_image_path:
                    img_path = file_service.get_absolute_path(page.generated_image_path)
                    if os.path.exists(img_path):
                        valid_pages.append((page, img_path))
                        continue

                if include_no_image_pages:
                    # 为无图页面生成占位帧
                    outline_content = page.get_outline_content() or {}
                    title = outline_content.get('title', f'Page {page.order_index + 1}')
                    placeholder_path = os.path.join(placeholder_dir, f'placeholder_{page.order_index:03d}.png')
                    try:
                        create_placeholder_frame(
                            placeholder_path, title=title,
                            width=video_width, height=video_height,
                            ffmpeg_path=ffmpeg_path,
                        )
                        valid_pages.append((page, placeholder_path))
                    except Exception as e:
                        logger.warning(f"生成占位帧失败 (page {page.id}): {e}")

            if not valid_pages:
                raise ValueError("没有找到可导出的页面（无图片且未启用占位帧）")

            progress_callback("准备", f"找到 {len(valid_pages)} 页幻灯片", 5)

            # ── Step 1: 生成缺失的旁白 ──
            if generate_narration:
                from services.prompts import get_narration_generation_prompt
                from services.ai_service_manager import get_ai_service
                import re as _re

                ai_service = get_ai_service()
                narration_generated = 0

                # 收集需要生成旁白的页面
                pages_needing_narration = []  # list of (page, page_index_in_valid, desc_text)
                for i, (page, _) in enumerate(valid_pages):
                    if page.narration_text:
                        continue

                    desc_content = page.get_description_content()
                    desc_text = ''
                    if desc_content:
                        desc_text = desc_content.get('text', '')
                        if not desc_text and desc_content.get('text_content'):
                            tc = desc_content.get('text_content', [])
                            desc_text = '\n'.join(tc) if isinstance(tc, list) else str(tc)
                        desc_text = _append_extra_fields(desc_text, desc_content)

                    outline_content = page.get_outline_content() or {}
                    if not desc_text:
                        title = outline_content.get('title', '')
                        points = outline_content.get('points', [])
                        if title or points:
                            desc_text = f'{title}\n' + '\n'.join(f'- {p}' for p in points)

                    if not desc_text:
                        if fail_fast:
                            raise RuntimeError(
                                f"第 {page.order_index + 1} 页缺少可生成旁白的描述内容，当前项目未开启“允许返回半成品”，无法导出视频。"
                            )
                        continue

                    pages_needing_narration.append((page, i + 1, outline_content, desc_text))

                if pages_needing_narration:
                    progress_callback("旁白", f"正在生成 {len(pages_needing_narration)} 页旁白...", 5)
                    try:
                        prompt_pages = [
                            {
                                'page_index': seq,
                                'title': outline.get('title', ''),
                                'points': outline.get('points', []),
                                'description_text': desc_text,
                            }
                            for _, seq, outline, desc_text in pages_needing_narration
                        ]
                        prompt = get_narration_generation_prompt(prompt_pages, language=language)
                        result = ai_service.text_provider.generate_text(prompt)

                        # 解析输出：按 === SLIDE n === 分割
                        sections = _re.split(r'===\s*SLIDE\s+(\d+)\s*===', result)
                        # sections: ['', '1', 'narration1', '2', 'narration2', ...]
                        parsed = {}
                        it = iter(sections[1:])  # 跳过开头空串
                        for idx_str, text in zip(it, it):
                            parsed[int(idx_str)] = text.strip()

                        for page, seq, _, _ in pages_needing_narration:
                            narration = parsed.get(seq, '')
                            if narration:
                                page.set_narration_text(narration)
                                narration_generated += 1
                            elif fail_fast:
                                raise RuntimeError(
                                    f"第 {page.order_index + 1} 页旁白生成结果为空，当前项目未开启“允许返回半成品”，已停止导出。"
                                )
                        db.session.commit()

                    except RuntimeError:
                        raise
                    except Exception as e:
                        if fail_fast:
                            raise RuntimeError(f"旁白生成失败，已停止导出: {e}") from e
                        logger.warning(f"批量生成旁白失败: {e}")

                progress_callback("旁白", f"已生成 {narration_generated} 页旁白", 20)

            progress_callback("旁白", "旁白准备完成", 20)

            # ── Step 2: 构建 pages_data ──
            pages_data = []
            missing_narration_pages = []
            for page, img_path in valid_pages:
                db.session.refresh(page)
                narration = page.narration_text
                if not narration or not narration.strip():
                    missing_narration_pages.append(page.order_index + 1)
                logger.info(
                    f"[视频导出] 页面 {page.order_index + 1}: "
                    f"title={((page.get_outline_content() or {}).get('title', ''))[:30]}, "
                    f"narration={narration[:50] if narration else '(无)'}, "
                    f"image={'有图' if page.generated_image_path else '占位帧'}"
                )
                pages_data.append({
                    'image_path': img_path,
                    'narration_text': narration,
                    'page_index': page.order_index,
                })

            if missing_narration_pages and fail_fast:
                pages = '、'.join(str(idx) for idx in missing_narration_pages)
                raise RuntimeError(
                    f"以下页面缺少旁白文本：第 {pages} 页。当前项目未开启“允许返回半成品”，已停止导出。"
                )

            # ── Step 3: 生成视频 ──
            exports_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports')
            os.makedirs(exports_dir, exist_ok=True)

            if not filename.endswith('.mp4'):
                filename += '.mp4'

            output_path = os.path.join(exports_dir, filename)
            if os.path.exists(output_path):
                base_name = filename.rsplit('.', 1)[0]
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                filename = f"{base_name}_{timestamp}.mp4"
                output_path = os.path.join(exports_dir, filename)

            video_width = app.config.get('VIDEO_OUTPUT_WIDTH', 1920)
            video_height = app.config.get('VIDEO_OUTPUT_HEIGHT', 1080)
            video_fps = app.config.get('VIDEO_FPS', 25)
            silent_duration = app.config.get('DEFAULT_SILENT_CLIP_DURATION', 3.0)

            generate_narration_video(
                pages_data=pages_data,
                output_path=output_path,
                voice=voice,
                rate=rate,
                width=video_width,
                height=video_height,
                fps=video_fps,
                enable_ken_burns=enable_ken_burns,
                ffmpeg_path=ffmpeg_path,
                progress_callback=progress_callback,
                silent_duration=silent_duration,
                fail_fast=fail_fast,
            )

            # ── Step 4: 标记完成 ──
            download_path = f"/files/{project_id}/exports/{filename}"
            progress_messages.append("✅ 视频导出完成！")

            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": 100,
                    "completed": 100,
                    "failed": 0,
                    "current_step": "✓ 导出完成",
                    "percent": 100,
                    "messages": progress_messages,
                    "download_url": download_path,
                    "filename": filename,
                })
                db.session.commit()
                logger.info(f"✅ 任务 {task_id} 完成 - 视频已导出: {output_path}")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"✗ 视频导出任务 {task_id} 失败: {error_detail}")

            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()

        finally:
            # 清理占位帧临时目录
            if placeholder_dir and os.path.exists(placeholder_dir):
                import shutil
                shutil.rmtree(placeholder_dir, ignore_errors=True)
