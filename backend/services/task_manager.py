"""
Task Manager - handles background tasks using ThreadPoolExecutor
No need for Celery or Redis, uses in-memory task tracking
"""
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, List, Dict, Any
from datetime import datetime
from sqlalchemy import func
from models import db, Task, Page, Material, PageImageVersion
from pathlib import Path

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
    4. 创建新版本记录
    5. 如果提供了 page_obj，更新页面状态和图片路径
    """
    # 使用 MAX 查询确保版本号安全（即使有版本被删除也不会重复）
    max_version = db.session.query(func.max(PageImageVersion.version_number)).filter_by(page_id=page_id).scalar() or 0
    next_version = max_version + 1
    
    # 批量更新：标记所有旧版本为非当前版本（使用单条 SQL 更高效）
    PageImageVersion.query.filter_by(page_id=page_id).update({'is_current': False})
    
    # 保存图片到最终位置（使用版本号）
    image_path = file_service.save_generated_image(
        image, project_id, page_id,
        version_number=next_version,
        image_format=image_format
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
        page_obj.status = 'COMPLETED'
        page_obj.updated_at = datetime.utcnow()
    
    # 提交事务
    db.session.commit()
    
    logger.debug(f"Page {page_id} image saved as version {next_version}: {image_path}")
    
    return image_path, next_version


def generate_descriptions_task(task_id: str, project_id: str, ai_service, 
                               project_context, outline: List[Dict], 
                               max_workers: int = 5, app=None,
                               language: str = None):
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
                        desc_text = ai_service.generate_page_description(
                            project_context, outline, page_outline, page_index,
                            language=language
                        )
                        
                        # Parse description into structured format
                        # This is a simplified version - you may want more sophisticated parsing
                        desc_content = {
                            "text": desc_text,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        
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
                        language: str = None):
    """
    Background task for generating page images
    Based on demo.py gen_images_parallel()
    
    Note: app instance MUST be passed from the request context
    
    Args:
        language: Output language (zh, en, ja, auto)
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
            
            # Get all pages for this project
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
            pages_data = ai_service.flatten_outline(outline)
            
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
                            has_template=use_template
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
                        
                        # 优化：直接在子线程中计算版本号并保存到最终位置
                        # 每个页面独立，使用数据库事务保证版本号原子性，避免临时文件
                        image_path, next_version = save_image_with_version(
                            image, project_id, page_id, file_service, page_obj=page_obj
                        )
                        
                        return (page_id, image_path, None)
                        
                    except Exception as e:
                        import traceback
                        error_detail = traceback.format_exc()
                        logger.error(f"Failed to generate image for page {page_id}: {error_detail}")
                        return (page_id, None, str(e))
            
            # Use ThreadPoolExecutor for parallel generation
            # 关键：提前提取 page.id，不要传递 ORM 对象到子线程
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(generate_single_image, page.id, page_data, i)
                    for i, (page, page_data) in enumerate(zip(pages, pages_data), 1)
                ]
                
                # Process results as they complete
                for future in as_completed(futures):
                    page_id, image_path, error = future.result()
                    
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
                        task.update_progress(completed=completed, failed=failed)
                        db.session.commit()
                        logger.info(f"Image Progress: {completed}/{len(pages)} pages completed")
            
            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
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
                has_template=use_template
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
            # Clean up temp directory
            if temp_dir:
                import shutil
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)


def export_editable_pptx_task(task_id: str, project_id: str, filename: str,
                               ai_service, file_service,
                               aspect_ratio: str = "16:9",
                               resolution: str = "2K",
                               max_workers: int = 8,
                               app=None):
    """
    Background task for exporting editable PPTX
    
    Note: app instance MUST be passed from the request context
    
    Steps:
    1. Generate clean background images (remove text, icons) in parallel
    2. Create temporary PDF from original images
    3. Parse PDF with MinerU
    4. Create editable PPTX from MinerU results + clean backgrounds
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        import tempfile
        import os
        from services.export_service import ExportService
        from services.file_parser_service import FileParserService
        from models import Project, Page
        from PIL import Image
        
        # Track temporary files for cleanup
        clean_background_paths = []
        tmp_pdf_path = None
        
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            logger.info(f"Task {task_id} status updated to PROCESSING")
            
            # Get project and pages
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")
            
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
            if not pages:
                raise ValueError("No pages found for project")
            
            # Get image paths
            image_paths = []
            for page in pages:
                if page.generated_image_path:
                    abs_path = file_service.get_absolute_path(page.generated_image_path)
                    image_paths.append(abs_path)
            
            if not image_paths:
                raise ValueError("No generated images found for project")
            
            # Initialize progress
            total_steps = len(image_paths) + 3  # pdf + mineru + backgrounds + pptx
            task.set_progress({
                "total": total_steps,
                "completed": 0,
                "failed": 0,
                "current_step": "Creating PDF"
            })
            db.session.commit()
            
            # Step 1: Create temporary PDF from original images (moved before background generation)
            logger.info("Step 1: Creating PDF for MinerU parsing...")
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
                tmp_pdf_path = tmp_pdf.name
            
            logger.info(f"Creating PDF from {len(image_paths)} images...")
            ExportService.create_pdf_from_images(image_paths, output_file=tmp_pdf_path)
            logger.info(f"PDF created: {tmp_pdf_path}")
            
            # Update progress: PDF complete
            task = Task.query.get(task_id)
            prog = task.get_progress()
            prog['completed'] = 1
            prog['current_step'] = "Parsing with MinerU"
            task.set_progress(prog)
            db.session.commit()
            
            # Step 2: Parse PDF with MinerU
            logger.info("Parsing PDF with MinerU...")
            
            mineru_token = app.config.get('MINERU_TOKEN')
            mineru_api_base = app.config.get('MINERU_API_BASE', 'https://mineru.net')
            
            if not mineru_token:
                raise ValueError('MinerU token not configured')
            
            parser_service = FileParserService(
                mineru_token=mineru_token,
                mineru_api_base=mineru_api_base
            )
            
            batch_id, markdown_content, extract_id, error_message, failed_image_count = parser_service.parse_file(
                file_path=tmp_pdf_path,
                filename=f'presentation_{project_id}.pdf'
            )
            
            if error_message or not extract_id:
                error_msg = error_message or 'Failed to parse PDF with MinerU - no extract_id returned'
                raise ValueError(error_msg)
            
            logger.info(f"MinerU parsing completed, extract_id: {extract_id}")
            
            # Update progress: MinerU complete
            task = Task.query.get(task_id)
            prog = task.get_progress()
            prog['completed'] = 2
            prog['current_step'] = "Generating clean backgrounds with inpainting"
            task.set_progress(prog)
            db.session.commit()
            
            # Step 3: Generate clean backgrounds using inpainting + MinerU bbox
            logger.info("Step 3: Generating clean backgrounds with inpainting...")
            from services.export_service_inpainting import InpaintingExportHelper
            from config import get_config
            
            # Get MinerU result directory
            mineru_result_dir = os.path.join(
                app.config['UPLOAD_FOLDER'],
                'mineru_files',
                extract_id
            )
            
            if not os.path.exists(mineru_result_dir):
                raise ValueError(f'MinerU result directory not found: {mineru_result_dir}')
            
            # Check if inpainting is enabled
            config = get_config()
            use_inpainting = bool(config.VOLCENGINE_ACCESS_KEY and config.VOLCENGINE_SECRET_KEY)
            
            if use_inpainting:
                logger.info("🚀 Using inpainting for faster background generation")
            else:
                logger.info("⚠️ Inpainting disabled (no Volcengine credentials), using original images as backgrounds")
            
            clean_background_paths = InpaintingExportHelper.generate_clean_backgrounds_with_inpainting(
                image_paths=image_paths,
                mineru_result_dir=mineru_result_dir,
                use_inpainting=use_inpainting
            )
            
            logger.info(f"Generated {len(clean_background_paths)} clean backgrounds")
            
            # Update progress: backgrounds complete
            task = Task.query.get(task_id)
            prog = task.get_progress()
            prog['completed'] = 3
            prog['current_step'] = "Creating editable PPTX"
            task.set_progress(prog)
            db.session.commit()
            
            # Step 4: Create editable PPTX from MinerU results
            logger.info(f"Step 4: Creating editable PPTX from MinerU results: {mineru_result_dir}")
            
            # Determine export directory and filename
            exports_dir = file_service._get_exports_dir(project_id)
            if not filename.endswith('.pptx'):
                filename += '.pptx'
            
            output_path = os.path.join(exports_dir, filename)
            
            # 检查文件是否被占用，如果是则生成新文件名
            if os.path.exists(output_path):
                try:
                    # 尝试以写模式打开文件，检查是否可写
                    with open(output_path, 'a'):
                        pass
                except (IOError, PermissionError) as e:
                    # 文件被占用，生成新文件名
                    logger.warning(f"文件被占用: {output_path}，生成新文件名")
                    base_name = filename.rsplit('.pptx', 1)[0]
                    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                    filename = f"{base_name}_{timestamp}.pptx"
                    output_path = os.path.join(exports_dir, filename)
                    logger.info(f"新文件名: {filename}")
            
            # Get slide dimensions from first image
            first_img = Image.open(image_paths[0])
            slide_width, slide_height = first_img.size
            first_img.close()
            
            # Generate editable PPTX file with clean background images
            logger.info(f"Creating editable PPTX with {len(clean_background_paths)} clean background images")
            ExportService.create_editable_pptx_from_mineru(
                mineru_result_dir=mineru_result_dir,
                output_file=output_path,
                slide_width_pixels=slide_width,
                slide_height_pixels=slide_height,
                background_images=clean_background_paths
            )
            
            logger.info(f"Editable PPTX created: {output_path}")
            
            # Build download URLs
            download_path = f"/files/{project_id}/exports/{filename}"
            
            # Mark task as completed with download URL in progress
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": total_steps,
                    "completed": total_steps,
                    "failed": 0,
                    "current_step": "Complete",
                    "download_url": download_path,
                    "filename": filename,
                    "used_inpainting": use_inpainting
                })
                db.session.commit()
                logger.info(f"Task {task_id} COMPLETED - Editable PPTX exported (inpainting: {use_inpainting})")
        
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
            # Clean up temporary PDF
            if tmp_pdf_path and os.path.exists(tmp_pdf_path):
                try:
                    os.unlink(tmp_pdf_path)
                    logger.info(f"Cleaned up temporary PDF: {tmp_pdf_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary PDF: {str(e)}")
            
            # Clean up temporary clean background images
            if clean_background_paths:
                for bg_path in clean_background_paths:
                    # Only delete if it's a temporary file (not the original)
                    if bg_path not in image_paths and os.path.exists(bg_path):
                        try:
                            os.unlink(bg_path)
                            logger.debug(f"Cleaned up temporary background: {bg_path}")
                        except Exception as e:
                            logger.warning(f"Failed to clean up temporary background: {str(e)}")


def export_editable_pptx_with_recursive_analysis_task(
    task_id: str, 
    project_id: str, 
    filename: str,
    file_service,
    max_depth: int = 2,
    max_workers: int = 4,
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
        max_depth: 最大递归深度
        max_workers: 并发处理数
        app: Flask应用实例
    """
    logger.info(f"🚀 Task {task_id} started: export_editable_pptx_with_recursive_analysis (project={project_id}, depth={max_depth}, workers={max_workers})")
    
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        import os
        from datetime import datetime
        from PIL import Image
        from models import Project
        from services.export_service import ExportService
        
        logger.info(f"开始递归分析导出任务 {task_id} for project {project_id}")
        
        try:
            # Get project
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f'Project {project_id} not found')
            
            # Get all pages with images
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
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
            
            # 初始化任务进度
            task = Task.query.get(task_id)
            total_steps = 3  # 1: 递归分析, 2: 创建PPTX, 3: 完成
            task.set_progress({
                "total": total_steps,
                "completed": 0,
                "failed": 0,
                "current_step": "开始递归分析..."
            })
            db.session.commit()
            
            # Step 1: 使用递归分析方法创建可编辑PPTX
            logger.info("Step 1: 使用递归分析方法处理图片...")
            
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
            
            # 获取MinerU配置
            mineru_token = app.config.get('MINERU_TOKEN')
            mineru_api_base = app.config.get('MINERU_API_BASE', 'https://mineru.net')
            
            if not mineru_token:
                raise ValueError('MinerU token not configured')
            
            # 获取第一张图片的尺寸作为参考
            first_img = Image.open(image_paths[0])
            slide_width, slide_height = first_img.size
            first_img.close()
            
            logger.info(f"幻灯片尺寸: {slide_width}x{slide_height}")
            logger.info(f"递归深度: {max_depth}, 并发数: {max_workers}")
            
            # 更新进度
            task = Task.query.get(task_id)
            prog = task.get_progress()
            prog['completed'] = 1
            prog['current_step'] = f"递归分析图片中（深度={max_depth}）..."
            task.set_progress(prog)
            db.session.commit()
            
            # Step 2: 调用新的导出方法
            logger.info("Step 2: 创建可编辑PPTX...")
            ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=image_paths,
                output_file=output_path,
                slide_width_pixels=slide_width,
                slide_height_pixels=slide_height,
                mineru_token=mineru_token,
                mineru_api_base=mineru_api_base,
                max_depth=max_depth,
                max_workers=max_workers
            )
            
            logger.info(f"✓ 可编辑PPTX已创建: {output_path}")
            
            # 更新进度
            task = Task.query.get(task_id)
            prog = task.get_progress()
            prog['completed'] = 2
            prog['current_step'] = "完成"
            task.set_progress(prog)
            db.session.commit()
            
            # Step 3: 标记任务完成
            download_path = f"/files/{project_id}/exports/{filename}"
            
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": total_steps,
                    "completed": total_steps,
                    "failed": 0,
                    "current_step": "完成",
                    "download_url": download_path,
                    "filename": filename,
                    "method": "recursive_analysis",
                    "max_depth": max_depth
                })
                db.session.commit()
                logger.info(f"✓ 任务 {task_id} 完成 - 递归分析导出成功（深度={max_depth}）")
        
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
