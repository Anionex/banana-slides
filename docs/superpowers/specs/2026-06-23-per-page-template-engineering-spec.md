# Per-Page Template 工程实施 Spec

> 创建日期:2026-06-23  
> 上游 PRD:`docs/superpowers/specs/2026-06-22-prd-per-page-template.md`  
> 上游交接:`docs/superpowers/plans/2026-06-22-per-page-template-handoff.md`  
> 范围声明:**全功能一次做完**,不分 MVP/v2。所有 PRD §14 决策(1-6)+ §3.2 决策 7 一并实施。

---

## 1. 范围与原则

### 1.1 包含的功能

本次实施覆盖 PRD 全部章节,不留 v2 阶段:

| 模块 | 来源 | 状态 |
|------|------|------|
| 项目模板库(`project_template_assets`) | PRD §5 | 实施 |
| 页级模板字段(`pages` 加 5 列) | PRD §6 | 实施 |
| TemplateSetupPage 完整页面 | PRD §7 | 实施(决策 1) |
| PDF 拆页上传 | PRD §5.4 + 决策 3 | 实施 |
| AI 模板解析(自动 + 用户编辑) | PRD §5.3 + 决策 4 | 实施 |
| 自动匹配(全项目 + 单页) | PRD §8/§9 + 决策 5 | 实施 |
| 手动选择模板(弹层) | PRD §10 | 实施 |
| 模板删除 + 引用页清空 | PRD §11 | 实施 |
| 模式双向切换(单↔多) | PRD §3.2 决策 7 | 实施 |
| 图片生成链路按页级模板优先级读取 | PRD §13 | 实施 |
| 解析失败降级(可手动用,不进自动匹配) | 决策 2 | 实施 |
| 单模板路由跳过 | 决策 6 | 实施 |

### 1.2 留白(扩展余地)

为避免锁死后续演进,以下点显式做"接口预留 + 当前不实现":

- **系统预设模板**:`GET /api/templates`(`template_controller.py:98`)已存在但返回空列表,不动它,后续作为系统模板池入口
- **模板版本/历史**:`project_template_assets` 不加 `version` 字段,但 `analysis_json` 用 JSON 存,schema 演进无需 migration
- **匹配算法多版本**:`pages.template_selection_source` enum 预留 `auto_v2 / hybrid` 等值,当前只用 `manual / auto / batch_apply`

---

## 2. 数据模型

### 2.1 `projects` 表加 1 列

```python
template_mode = db.Column(db.String(10), nullable=False, server_default='single', default='single')
# 'single' | 'multi' — 仅 UI 渲染分支,不影响页级字段读写
```

### 2.2 新增 `project_template_assets` 表

```python
class ProjectTemplateAsset(db.Model):
    __tablename__ = 'project_template_assets'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    image_path = db.Column(db.String(500), nullable=False)        # 原图相对路径
    thumb_path = db.Column(db.String(500), nullable=True)         # 缩略图,生成失败可空
    file_size = db.Column(db.Integer, nullable=True)
    source = db.Column(db.String(20), nullable=False, default='upload')  # upload | pdf_split | system_preset
    source_pdf_id = db.Column(db.String(36), nullable=True)       # PDF 拆页时记录原 PDF task_id
    source_page_index = db.Column(db.Integer, nullable=True)      # PDF 拆页时记录原 PDF 页码

    analysis_status = db.Column(db.String(20), nullable=False, default='pending')  # pending|processing|completed|failed
    analysis_json = db.Column(db.Text, nullable=True)             # JSON 字符串,9 字段 schema(PRD §5.3)
    analysis_notes = db.Column(db.Text, nullable=True)            # AI 自由文本补充
    analysis_error = db.Column(db.Text, nullable=True)            # 失败原因(决策 2)
    user_label = db.Column(db.String(200), nullable=True)         # 用户标记
    user_edited_analysis = db.Column(db.Boolean, nullable=False, default=False)  # 用户是否编辑过解析

    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship('Project', back_populates='template_assets')
    pages_referenced = db.relationship('Page', back_populates='template_asset', foreign_keys='Page.template_asset_id')
```

`Project.template_assets = db.relationship('ProjectTemplateAsset', back_populates='project', cascade='all, delete-orphan', order_by='ProjectTemplateAsset.sort_order')`

### 2.3 `pages` 表加 5 列

```python
template_asset_id = db.Column(db.String(36), db.ForeignKey('project_template_assets.id', ondelete='SET NULL'), nullable=True, index=True)
template_style_text = db.Column(db.Text, nullable=True)
template_selection_source = db.Column(db.String(20), nullable=True)  # manual | auto | batch_apply
template_match_reason = db.Column(db.Text, nullable=True)
template_match_confidence = db.Column(db.Float, nullable=True)
```

外键 `ondelete='SET NULL'` 实现 PRD §11"删除模板自动清空引用页"。

### 2.4 Alembic migration

文件:`backend/migrations/versions/2026_06_23_add_per_page_template.py`

upgrade 步骤:
1. 加 `projects.template_mode` 列
2. 创建 `project_template_assets` 表
3. 加 `pages` 5 列
4. **Backfill**:对所有现有项目,把 `projects.template_image_path` / `template_style` 批量同步到所有页:
   - 若 `template_image_path` 非空 **且文件存在**:为该项目创建一条 `project_template_assets` 记录(source='upload', analysis_status='pending', image_path 指向原文件,thumb_path 留空交由后续懒生成),把所有页的 `template_asset_id` 指向它
   - 若 `template_image_path` 非空但文件已丢失:跳过 asset 创建,记一行 warning log,该项目仍保持单模板模式但模板字段为空(用户后续可在 setup 页重新上传)
   - 若 `template_style` 非空:把所有页的 `template_style_text` 设成项目级值
   - `template_mode` 默认 `'single'`(对存量项目语义正确——所有页同一模板)

downgrade 步骤(对称回滚)略。

### 2.5 数据语义约束(应用层维护,不写 DB 约束)

- 单模板模式下,所有页 `template_asset_id` 应一致、`template_style_text` 应一致——切换/批量赋值时由后端保证;不在 DB 层加 trigger
- "未确认页":`template_asset_id IS NULL AND (template_style_text IS NULL OR template_style_text = '')`
- 多模板模式门禁(PRD §4):应用层在进入 `SlidePreview` 前校验,不在 DB 层加 check

---

## 3. API Schema

### 3.1 路由组织

新建蓝图 `template_assets_bp = Blueprint('template_assets', __name__, url_prefix='/api/projects')`,挂在 `template_controller.py` 内,与现有 `template_bp` 共存(后者保留旧的"项目级单模板上传"入口,本期不删,作为决策 7 切换语义的兼容层)。

### 3.2 模板资产 CRUD

**`GET /api/projects/:projectId/template-assets`** — 列出项目模板库
```json
// Response
{ "assets": [
  { "id": "...", "image_url": "/files/...", "thumb_url": "/files/...",
    "analysis_status": "completed", "analysis_json": {...}, "analysis_notes": "...",
    "user_label": "封面图", "source": "upload", "sort_order": 0,
    "referenced_page_ids": ["p1", "p2"] }
]}
```

**`POST /api/projects/:projectId/template-assets`** — 上传单张模板图片
```
Content-Type: multipart/form-data
Form: image=@file.png, user_label=封面图(可选)
```
- 同步:保存原图 + 缩略图 + 写 `project_template_assets` 行(`analysis_status='pending'`)
- 异步:立即触发 `analyze_template_task`(决策 4),不阻塞响应
- Response:`{ "asset": {...}, "analyze_task_id": "..." }`
- 可选 query 参数 `bind_to_page=:pageId`(对应 PRD §10.3 "弹层上传时自动绑定当前页")

**`POST /api/projects/:projectId/template-assets/upload-pdf`** — 上传 PDF 拆页(决策 3)
```
Content-Type: multipart/form-data
Form: pdf=@file.pdf
```
- 同步:保存 PDF 到 `uploads/:projectId/template-pdf/:taskId.pdf`,创建 `Task(task_type='SPLIT_TEMPLATE_PDF')`
- 异步:`process_pdf_to_template_images_task` 拆页 → 每页生成一条 `project_template_assets`(`source='pdf_split'`, `source_pdf_id` / `source_page_index` 填充)→ 每条触发独立解析任务
- Response:`{ "task_id": "..." }`,前端轮询 `GET /api/tasks/:taskId` 拿进度(progress 含 `total/completed/failed`)
- 上限:页数 ≤ 50,超过返回 `bad_request`

**`PATCH /api/projects/:projectId/template-assets/:assetId`** — 编辑资产(用户标记 / 修正解析)
```json
// Request
{ "user_label": "对比页",
  "analysis_json": { ...用户编辑后的 9 字段... },
  "analysis_notes": "..." }
```
- 任一字段可选;`analysis_json` 一旦被改,自动设 `user_edited_analysis=true`
- 不允许通过此端点改 `analysis_status`(状态由任务驱动)

**`DELETE /api/projects/:projectId/template-assets/:assetId`** — 删除资产
- 删文件(原图 + 缩略图)
- DB 层 `ON DELETE SET NULL` 自动清空所有引用页的 `template_asset_id`
- 应用层把被清空的页 `template_selection_source` 也置 `NULL`,符合 PRD §11"进入未确认状态"
- Response:`{ "deleted": true, "cleared_page_ids": ["p1", "p2"] }`(让前端 toast 提示)

**`POST /api/projects/:projectId/template-assets/:assetId/reanalyze`** — 手动重新解析(决策 2)
- 触发 `analyze_template_task`,把 `analysis_status` 置 `pending`
- Response:`{ "analyze_task_id": "..." }`

### 3.3 页级模板 + 模式切换

**`PATCH /api/projects/:projectId/pages/:pageId/template`** — 单页设置模板
```json
// Request
{ "template_asset_id": "..." | null,
  "template_style_text": "..." | null,
  "selection_source": "manual" }  // 默认 manual
```
- 任一字段可选;同时为 null 即"清空模板"
- 校验:`pageId` 必须属于 `projectId`;`template_asset_id` 必须属于同项目
- 多模板模式下不校验"至少一个非空"(让用户暂存空状态),但 SlidePreview 前端按 PRD §4 做门禁
- Response:`{ "page": { ...page.to_dict()... } }`

**`PATCH /api/projects/:projectId/template-mode`** — 切换模板模式(决策 7,JSON 路径)
```json
// Request — 单 → 多
{ "mode": "multi" }

// Request — 多 → 单(选择已有 asset / 仅文字模板)
{ "mode": "single",
  "unified_asset_id": "..." | null,    // 至少 asset_id 或 style_text 之一非空
  "unified_style_text": "..." | null }
```
- 单→多:仅改 `projects.template_mode='multi'`,不动页级字段
- 多→单:把 `unified_asset_id` / `unified_style_text` **批量覆盖**到所有页,然后改 `template_mode='single'`;事务内完成(单条 `update().where(Page.project_id==pid)`)
- 校验:`unified_asset_id` 必须属于同项目;两字段同时为空返回 `bad_request`

**`POST /api/projects/:projectId/template-mode/single-with-upload`** — 多→单 + 新上传统一模板(multipart 路径)
```
Content-Type: multipart/form-data
Form: image=@file.png, unified_style_text=...(可选)
```
- 服务端先创建 asset(同 §3.2 上传),再批量覆盖所有页,再切 `template_mode='single'`,全程一个事务
- Response:`{ "asset": {...}, "project": {...} }`

**`POST /api/projects/:projectId/template-assets/auto-match`** — 全项目自动匹配(决策 5)
```json
// Request
{ "overwrite_existing": true,        // 默认 true,与 PRD §8.4 一致
  "preserve_non_empty": false }      // 勾选"保留已有模板选择"时为 true
```
- 前置校验:所有页都有描述(PRD §8.3),不满足返回 `{ "error": "missing_descriptions", "missing_page_ids": [...] }`
- 触发 `auto_match_templates_task`,Response:`{ "task_id": "..." }`
- 任务内部:决策 5 阈值——页 ≤ 50 且模板 ≤ 20 一次调用,否则按 30 页分批
- 任务完成后,把每页的 `template_asset_id` / `template_match_reason` / `template_match_confidence` / `template_selection_source='auto'` 写入

**`POST /api/projects/:projectId/pages/:pageId/template/auto-match`** — 单页自动匹配(PRD §9)
- 前置:仅校验当前页有描述;若项目模板库中无 `analysis_status='completed'` 的 asset 则返回 `{ "error": "no_analyzed_templates" }`
- 异步任务,Response:`{ "task_id": "..." }`(与全项目自动匹配口径一致,便于前端复用进度组件)

### 3.4 进度查询

复用现有 `GET /api/tasks/:taskId`(`task_manager.py`),3 种新任务类型(`SPLIT_TEMPLATE_PDF` / `ANALYZE_TEMPLATE` / `AUTO_MATCH_TEMPLATES`)的 `progress` JSON 形态:
```json
// SPLIT_TEMPLATE_PDF — 多页累计型
{ "total": 12, "completed": 8, "failed": 0, "created_asset_ids": ["..."] }
// ANALYZE_TEMPLATE — 单 asset 阶段型(无 total/completed,仅阶段标记)
{ "asset_id": "...", "stage": "calling_ai" | "parsing_json" | "done" | "failed" }
// AUTO_MATCH_TEMPLATES — 多页累计 + 分批
{ "total_pages": 30, "matched": 25, "undecided": 5, "batch_index": 1, "batch_total": 1 }
```
前端展示约定:`SPLIT_TEMPLATE_PDF` / `AUTO_MATCH_TEMPLATES` 走进度条;`ANALYZE_TEMPLATE` 走 chip 状态(pending/processing/completed/failed)。

---

## 4. 文件存储

### 4.1 目录布局

复用现有 `UPLOAD_FOLDER`(由 `FileService` 管理):

```
uploads/
  :projectId/
    template/                    # 旧:项目级单模板(决策 7 兼容层保留)
      template.png
    template-assets/             # 新:项目模板库
      :assetId/
        original.png             # 原图(扩展名按上传保留)
        thumb.jpg                # 缩略图,宽 480px,JPEG q85
    template-pdf/                # PDF 拆页临时与原始 PDF
      :taskId.pdf                # 用户原始 PDF,任务结束后保留 7 天供重试
      :taskId/                   # 拆出的临时 PNG,拆完导入 template-assets/ 后删除
        page_1.png ...
    pages/...                    # 现有结构
    materials/...                # 现有结构
```

URL 生成沿用现有路由 `/files/:projectId/...`,见 `file_controller.py:14-47`。新增 `template-assets/:assetId/original.png` 和 `thumb.jpg` 的访问需要在 `file_controller` 加路径放行(逻辑同 `template/`)。

### 4.2 FileService 新增方法

写到 `backend/services/file_service.py`(沿用 `save_user_template_thumbnail` 的 Pillow 缩略图模式,见 file_service.py:209-243):

```python
def save_template_asset(self, file, project_id: str, asset_id: str) -> tuple[str, str]:
    """保存原图 + 缩略图,返回 (image_path, thumb_path)。包含 PIL verify 防御。"""

def save_template_asset_from_path(self, src_path: str, project_id: str, asset_id: str) -> tuple[str, str]:
    """从已有本地文件复制(PDF 拆页用),返回 (image_path, thumb_path)。"""

def delete_template_asset(self, project_id: str, asset_id: str) -> None:
    """删除 template-assets/:assetId/ 目录。"""

def save_template_pdf(self, file, project_id: str, task_id: str) -> str:
    """保存上传的 PDF,返回路径。"""

def cleanup_template_pdf_temp(self, project_id: str, task_id: str) -> None:
    """删除 PDF 拆页的中间 PNG 目录(不删原 PDF)。"""
```

### 4.3 清理策略

- 删除 asset:同步删文件
- 删除 project:cascade 已通过 ORM 实现,文件由 `cleanup_project_files()`(已存在)兜底
- PDF 拆页中间文件:任务结束立即清理 `:taskId/` 目录;原始 PDF 保留 7 天(后续做"重新拆页"用),用定时任务扫描清理(留接口,本期不实现,加 TODO 注释)
- 缩略图缺失:`thumb_url` 为 null 时前端 fallback 到 `image_url`(已在前端 store 处理)

---

## 5. AI 服务与异步任务

### 5.1 PDF 拆页服务(决策 3)

**新建 `backend/services/pdf_image_service.py`:**

```python
import fitz
from pathlib import Path

def pdf_to_page_images(pdf_path: str, output_dir: str, dpi: int = 150,
                       max_pages: int = 50) -> list[dict]:
    """
    渲染 PDF 每页为 PNG,返回 [{"index": 1, "path": "..."}],失败页 path=None 但保留 index。
    超过 max_pages 抛 ValueError(由 controller 转 bad_request)。
    """
    doc = fitz.open(pdf_path)
    if len(doc) > max_pages:
        raise ValueError(f"PDF too long: {len(doc)} pages, max {max_pages}")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    results = []
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        out_path = Path(output_dir) / f"page_{i+1}.png"
        try:
            pix = page.get_pixmap(matrix=matrix)
            pix.save(str(out_path))
            results.append({"index": i + 1, "path": str(out_path)})
        except Exception as e:
            logger.warning(f"PDF page {i+1} render failed: {e}")
            results.append({"index": i + 1, "path": None, "error": str(e)})
    doc.close()
    return results
```

参考代码:`backend/controllers/project_controller.py` 中已有的 `fitz.open() + page.get_pixmap()` 调用。

### 5.2 Prompt 模板(决策 4 / 决策 5)

**新增到 `backend/services/prompts.py`:**

#### 5.2.1 `get_template_analysis_prompt(language: str = 'zh') -> str`

按现有 prompts.py 风格(函数返回字符串),输出格式与 `get_outline_generation_prompt`(L280)一致——markdown JSON 块,3 次软重试由 `generate_json()` 兜底。

要点:
- 嵌入 2-3 个真实模板的解析样本(few-shot),覆盖"封面图 / 双栏正文 / 时间线"三种典型 layout
- 9 字段 schema 显式列出(PRD §5.3),`text_regions[]` / `image_regions[]` 用 array of objects
- `notes` 字段说明"AI 主观观察",鼓励填充
- 失败标志:若图片无法识别为 slide,要求返回 `{"error": "not_a_slide"}`,任务侧据此把 `analysis_status='failed'`

#### 5.2.2 `get_template_auto_match_prompt(templates: list[dict], pages: list[dict], language: str) -> str`

输入裁剪(决策 5 实现要点):
- 每页:`{ page_id, order_index, title, summary[≤100字], content_density: 'low'|'medium'|'high' }`
  - `content_density` 在 controller 层派生,不入库:按 `len(page.description)` 估算——`<200` 字 low、200-600 medium、`>600` high(阈值后续可调)
- 每模板:`{ asset_id, user_label, layout_structure, content_capacity, visual_density, style_keywords[≤5], notes[≤200字] }`
- 输出 schema 严格遵循 PRD §8.2(数组,每元素含 `page_id / template_asset_id / status / confidence / reason`)
- prompt 显式禁止"未在候选模板里出现的 asset_id"
- `status` enum: `matched | undecided`(`undecided` 时 `template_asset_id=null`,符合 PRD §8.4)

### 5.3 AIService 新增方法

**`backend/services/ai_service.py`:**

```python
def analyze_template(self, image_path: str, language: str = 'zh') -> dict:
    """
    调用 generate_with_image + JSON 解析。
    复用 self.generate_json 的 3 次重试(L202-232),失败抛异常由任务捕获。
    返回 9 字段 dict(PRD §5.3 schema)或 {"error": "not_a_slide"}。
    """

def auto_match_templates(self, project_id: str, language: str = 'zh',
                         overwrite_existing: bool = True,
                         preserve_non_empty: bool = False) -> list[dict]:
    """
    自动匹配:决策 5 的阈值与分批逻辑在此实现。
    - 取项目所有 ProjectTemplateAsset(过滤 analysis_status != 'completed' 的不进候选,决策 2)
    - 取项目所有 Page(只保留有描述的,前置校验在 controller)
    - 若 len(pages)<=50 and len(templates)<=20:一次调用
    - 否则:按 30 页分批,batch 间合并
    返回 [{"page_id", "template_asset_id"|None, "status", "confidence", "reason"}]
    """
```

### 5.4 task_manager 新任务

**`backend/services/task_manager.py` 新增 3 个 task type 常量与处理函数:**

| Task Type | 触发处 | 资源池 | 说明 |
|-----------|--------|--------|------|
| `SPLIT_TEMPLATE_PDF` | `POST .../template-assets/upload-pdf` | `image_resource_limiter` | 调 `pdf_to_page_images` → 每页 `save_template_asset_from_path` → 创建 asset 行 → 触发子 `ANALYZE_TEMPLATE` 任务 |
| `ANALYZE_TEMPLATE` | 上传/拆页/手动 reanalyze | `text_resource_limiter` | 调 `ai_service.analyze_template`,写 `analysis_json` / `analysis_notes` / `analysis_status` |
| `AUTO_MATCH_TEMPLATES` | `POST .../template-assets/auto-match` | `text_resource_limiter` | 调 `ai_service.auto_match_templates`,事务批量更新 pages |

事务规范:沿用 `_commit_with_retry`(`task_manager.py:261-273`),失败时进度 JSON 把 failed +1 但不阻塞其他任务。

并发约定:
- 单 PDF 拆页内的 N 个 `ANALYZE_TEMPLATE` 子任务通过 `text_resource_limiter` 限流(沿用 `generate_descriptions_task` 模式)
- `AUTO_MATCH_TEMPLATES` 项目内串行(同一项目同一时刻只允许一个,controller 层用 `Task.query.filter_by(project_id, task_type, status='PROCESSING').first()` 防重)

---

## 6. 图片生成链路改造

### 6.1 改造点定位

主路径:`backend/services/task_manager.py:645-668`(现有 `use_template` 分支),配合 `prompts.py:815-860` 的 `generate_image_prompt`。

### 6.2 优先级链(PRD §13)

替换现有的 `use_template = bool(project.template_image_path)` 单一判断,改为按页查询:

```python
# 伪代码
def resolve_page_template(page: Page, project: Project) -> tuple[str | None, str | None]:
    """返回 (image_path_for_ref, style_text)"""
    image_path = None
    style_text = None

    # 优先级 1:页级图片模板
    if page.template_asset_id:
        asset = page.template_asset  # relationship
        if asset:
            image_path = file_service.resolve_template_asset_path(asset)

    # 优先级 2:页级文字模板
    if page.template_style_text:
        style_text = page.template_style_text

    # 优先级 3 / 4:项目级 fallback(兼容旧项目和决策 7 单模板模式)
    # 注意:单模板模式下 backfill 已把项目级值同步到页级,此处主要为
    # "存量项目未跑 backfill" 和"单模板模式下用户跳过模板选择"兜底
    if image_path is None and project.template_image_path:
        image_path = file_service.get_template_path(project.id)
    if style_text is None and project.template_style:
        style_text = project.template_style

    return image_path, style_text
```

### 6.3 prompt 拼接

`generate_image_prompt` 当前签名 `has_template: bool`,扩展为:
```python
def generate_image_prompt(..., has_template_image: bool, page_style_text: str | None, ...) -> str:
    # has_template_image: True 时加"配色和设计语言和模板图片严格相似"(prompts.py:836)
    # page_style_text: 非空时拼入风格段(替代原 project.template_style 的项目级拼接)
```

调用处:`task_manager.py` 在 `generate_image_prompt` 调用前先 `resolve_page_template(page, project)` 取出本页的 (image_path, style_text),分别透传。

### 6.4 单页重生成入口

`generate_single_page_image_task`(已存在)同步改造,确保用户在多模板模式下"重新生成单页"时真用本页的 `template_asset_id` 对应图片。这是决策 7 "已生成图片不受切换影响"的反向保证——一旦用户点重生成,新模板生效。

### 6.5 兼容性

- 旧项目:migration backfill 已把项目级模板写入页级,改造后路径无差别
- 模式切换中产生的页级模板覆盖:由 `PATCH .../template-mode` 在事务内同步完成,保证图片生成读到的是切换后的值
- 图生失败的重试沿用现有 `task_manager.py` 重试链,无需改

---

## 7. 前端架构

### 7.1 路由

`frontend/src/App.tsx` 路由序列扩展为(决策 1 + 决策 6):

```
/                                     Home
/project/:projectId/outline           OutlineEditor
/project/:projectId/detail            DetailEditor
/project/:projectId/template-setup    TemplateSetupPage(新页面,多模板必经)
/project/:projectId/preview           SlidePreview
```

**`Home.initializeProject` 完成后**:无论 `templateMode` 是 single 还是 multi,统一 `navigate(/project/:id/outline)`——模板配置发生在 outline / detail 之后(PRD §2 流程)。

**`DetailEditor` 完成态"下一步"按钮**(决策 1 / 决策 6 在此分支):
```ts
project.template_mode === 'multi'
  ? navigate(`/project/${id}/template-setup`)
  : navigate(`/project/${id}/preview`)
```

**`TemplateSetupPage` 路由守卫**(决策 6 配套):若 `project.template_mode === 'single'`,组件 mount 时 `navigate('/preview', { replace: true })`,防止用户手动输 URL 误入空页面。

### 7.2 Store(`frontend/src/store/useProjectStore.ts`)

#### 7.2.1 替换的 localStorage key

旧原型用的 4 个 key(交接文档 §4.3)全部废弃,改为 API:

| 旧 key | 新数据源 |
|--------|---------|
| `template_mode_${projectId}` | `project.template_mode`(后端字段) |
| `template_assets_${projectId}` | `GET /api/projects/:id/template-assets` |
| `page_template_assign_${projectId}` | `page.template_asset_id` / `template_style_text`(已在 page.to_dict) |
| `page_fine_tune_drawer_width` | 保留 localStorage(纯 UI 偏好,与数据无关) |

清理动作:Store 初始化时若检测到旧 localStorage key,直接删除(`removeItem`),不做迁移——交接文档 §3 已声明"旧 demo 数据不迁移"。

#### 7.2.2 新增 actions

```ts
// 模板资产
loadTemplateAssets(projectId): Promise<TemplateAsset[]>
uploadTemplateAsset(projectId, file, opts?: { bindToPageId?: string }): Promise<TemplateAsset>
uploadTemplatePdf(projectId, file): Promise<{ taskId: string }>
updateTemplateAsset(projectId, assetId, patch): Promise<TemplateAsset>
deleteTemplateAsset(projectId, assetId): Promise<{ clearedPageIds: string[] }>
reanalyzeTemplateAsset(projectId, assetId): Promise<{ taskId: string }>

// 页级模板
updatePageTemplate(projectId, pageId, patch): Promise<Page>

// 模式切换
switchTemplateMode(projectId, payload: SwitchModePayload): Promise<Project>
// SwitchModePayload:
//   { mode: 'multi' }
//   | { mode: 'single', unifiedAssetId?: string, unifiedStyleText?: string }
//   | { mode: 'single', uploadFile: File }  // 走 multipart 子端点

// 自动匹配
autoMatchAll(projectId, opts): Promise<{ taskId: string }>
autoMatchPage(projectId, pageId): Promise<{ taskId: string }>
```

#### 7.2.3 状态同步

- 解析任务:轮询 `/api/tasks/:taskId`,完成后局部刷新该 asset(`loadTemplateAssets` 全量刷或 in-place 替换)
- 自动匹配:任务完成后调一次 `loadProject(projectId)` 刷新所有 page
- 删除资产:乐观更新,把 `clearedPageIds` 对应的 page 字段在本地置空

### 7.3 类型(`frontend/src/types/index.ts`)

`feat/per-page-template` 已预留的类型沿用,补全:

```ts
export interface TemplateAsset {
  id: string;
  image_url: string;
  thumb_url: string | null;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  analysis_json: TemplateAnalysis | null;
  analysis_notes: string | null;
  analysis_error: string | null;
  user_label: string | null;
  user_edited_analysis: boolean;
  source: 'upload' | 'pdf_split' | 'system_preset';
  sort_order: number;
  referenced_page_ids: string[];
}

export interface TemplateAnalysis {
  summary: string;
  template_type: string;
  layout_structure: string;
  content_capacity: 'low' | 'medium' | 'high';
  text_regions: Array<{ role: string; count: number }>;
  image_regions: Array<{ role: string; count: number }>;
  visual_density: 'low' | 'medium' | 'high';
  style_keywords: string[];
  notes: string;
}

// Project 加
template_mode: 'single' | 'multi';

// Page 加
template_asset_id: string | null;
template_style_text: string | null;
template_selection_source: 'manual' | 'auto' | 'batch_apply' | null;
template_match_reason: string | null;
template_match_confidence: number | null;
```

### 7.4 组件改造与新建

#### 7.4.1 新建 `TemplateSetupPage.tsx`(PRD §7)

主要区块:
- 顶部:模板模式控制条(`转为单模板` 按钮,对称于 DetailEditor 的"转为多模板")+ `一键自动匹配` 按钮
- 左栏:**项目模板库**——网格展示所有 TemplateAsset 卡片
  - 缩略图 / 用户标记输入框(inline 编辑)/ 解析状态徽标 / 解析摘要(可展开编辑 9 字段)
  - 卡片底部:`删除` / `重新解析`(失败时显眼)
  - 顶部:`上传图片` + `上传 PDF` 双按钮,PDF 上传后进度条显示
- 右栏:**页面列表**——每页一行,显示
  - 序号 + 标题 + 内容密度 chip
  - 当前模板缩略图(若有)/ 当前文字模板预览(若有)/ 未确认 chip
  - 按钮:`选择模板`(开手动选择弹层)/ `单页自动匹配` / `编辑文字模板`
- 自动匹配前置校验:缺描述时按钮 disabled + tooltip(PRD §8.3)

#### 7.4.2 改造 `Home.tsx`(决策 7)

沿用 `feat/per-page-template` 分支的"单/多模板按钮"原型,但 `initializeProject` 改调真实 API:
- 单模板:先创建项目(`POST /api/projects` 带 `template_mode='single'` + `template_image_path` / `template_style`)→ 后端在创建项目时把上传的模板写入一条 `project_template_assets`,但**此时 pages 尚未生成**——同步动作发生在两个时间点:
  1. **大纲生成创建 pages 时**:后端 `task_manager` 在 outline 任务里 commit pages 时,根据 `project.template_mode='single'` 把统一 asset 和 style_text 同步写入每页
  2. **后续单模板模式下用户改模板**:任何修改项目级模板的操作触发 `PATCH /template-mode`(模式不变,语义为"重新统一"),后端批量覆盖所有页
- 多模板:先创建项目(`template_mode='multi'`,无模板字段)→ 直接进 outline,模板留到 TemplateSetupPage 处理

#### 7.4.3 改造 `DetailEditor.tsx`

顶部加"模板模式控制区":
- 当前 `single`:显示 `转为多模板` 按钮,点击 `switchTemplateMode({ mode: 'multi' })` → `template-setup`
- 当前 `multi`:显示"当前为多模板模式,前往模板配置"链接

#### 7.4.4 改造 `SlidePreview.tsx`

保留 `feat/per-page-template` 原型的右侧"页面精调"抽屉(`PageFineTuneDrawer.tsx`),但:
- 数据源从 localStorage 切到 store
- 单模板模式:隐藏抽屉里的"项目模板库"区块,只保留页面描述编辑(决策 6 配套)
- 多模板模式:抽屉里完整展示模板库 + 当前页模板选择 + 单页自动匹配按钮
- 顶部模板控制条根据 `project.template_mode` 二选一显示一个按钮:
  - `single` 时显示 `转为多模板`,点击 `switchTemplateMode({ mode: 'multi' })` → 留在 SlidePreview(用户也可手动跳 template-setup)
  - `multi` 时显示 `转为单模板`,点击打开 `SwitchToSingleModeDialog`
- 多→单切换走"选择统一模板弹层":列出当前模板库 + `上传新模板` + 文字风格 textarea,提交时:
  - 选已有 asset / 仅文字 → `PATCH /template-mode`(JSON 路径)
  - 上传新图 → `POST /template-mode/single-with-upload`(multipart 路径)

#### 7.4.5 新建组件

- `TemplatePickerModal.tsx`:带缩略图的模板选择弹层(PRD §10.2),含"上传新模板"内嵌入口,选中即调 `updatePageTemplate`
- `TemplateAnalysisEditor.tsx`:9 字段表单组件,在 TemplateSetupPage 卡片展开时使用;失败状态下变红框 + 重新解析按钮
- `SwitchToSingleModeDialog.tsx`:多→单切换时的统一模板选择弹层
- `TemplateMatchProgress.tsx`:自动匹配任务的进度条与结果摘要

### 7.5 i18n

按项目惯例(CLAUDE.md "Component-level `useT()` hook with inline zh/en translations"),所有新文案在组件内 inline,不进全局 i18n 文件。

---

## 8. 测试与验收

### 8.1 后端单元/集成测试(`backend/tests/`)

按现有 pytest 结构,新增:

**`test_template_assets_api.py`**
- POST/GET/PATCH/DELETE asset 全 CRUD
- 上传后 `analysis_status='pending'`,模拟任务完成后变 `completed`
- DELETE 后引用页字段被置 NULL(`SET NULL` 约束验证)
- 跨项目访问拒绝(asset belongs to other project)

**`test_template_pdf_split.py`**
- 真实 PDF 上传(测试 fixture 放 3 页样本 PDF)
- 验证 N 张 asset 创建 + 子解析任务触发
- 超 50 页返回 400
- 单页渲染失败时其他页仍成功(`failed` 计数正确)

**`test_template_analysis.py`**
- Mock `ai_service.analyze_template` 返回固定 9 字段,验证写库
- AI 返回 `{"error": "not_a_slide"}` 时 `analysis_status='failed'` + `analysis_error` 填充
- 重新解析端点把 status 重置回 pending

**`test_template_auto_match.py`**
- Mock LLM 返回固定匹配数组,验证页字段写入
- `preserve_non_empty=true` 时跳过已有 asset_id 的页
- `undecided` 状态把页字段置 NULL(PRD §8.4)
- 缺描述时返回 missing_descriptions 错误
- 阈值切换:51 页项目走分批路径,验证调用次数

**`test_template_mode_switch.py`**
- 单→多:仅 mode 改,页级字段不动
- 多→单 + `unified_asset_id`:所有页被批量覆盖,事务原子性(中途异常回滚)
- 多→单 + `unified_upload`:multipart 端点先建 asset 再覆盖
- 切换后 `generated_image_url` 保留不变(决策 7)

**`test_image_generation_template_priority.py`**(关键真实测试)
- 创建 3 页项目,page1 设页级 asset,page2 只设 style_text,page3 全空(走项目级 fallback)
- 触发图片生成,**用真实 AI provider**(沿 CLAUDE.md "不在意测试成本"要求)
- 验证三页生成时 prompt 与 ref_image 各自来源正确(用 task_manager 的 log 校验或在 provider mock 一层抓 prompt)

### 8.2 前端单元测试(Vitest)

- `TemplatePickerModal`:渲染所有 asset、选中触发回调、"上传新模板"打开 input、上传成功自动选中
- `TemplateAnalysisEditor`:9 字段编辑、保存调 `updateTemplateAsset`、失败态展示
- `SwitchToSingleModeDialog`:列出模板、文字风格、上传三选项校验
- `useProjectStore`:模式切换 / asset 增删 / 解析任务轮询的 action 单测

### 8.3 E2E(Playwright,`frontend/e2e/`)

复用现有 `e2e/helpers/seed-project.ts` 的快速种子工具,新增:

**`template-mode-creation.spec.ts`(mock + 集成两层,见 CLAUDE.md)**
- Home 选单模板上传 → outline → detail → preview,验证 preview 所有页使用同一模板
- Home 选多模板 → outline → detail → template-setup → 上传 2 张图 → 给页面分别绑定 → preview,验证刷新后绑定仍在

**`template-pdf-split.spec.ts`**
- 上传 3 页样本 PDF → 等任务完成 → 模板库出现 3 张 → 每张 analysis 状态推进到 completed

**`template-auto-match.spec.ts`**
- 多模板项目,模板库 ≥2 张 → 点一键自动匹配 → 等任务完成 → 每页都有 asset_id 或 undecided 标记 → 验证 reason/confidence 写入

**`template-delete-cascade.spec.ts`**
- 多模板项目,模板库 1 张被 N 页引用 → 删除模板 → 引用页全部变"未确认" → toast 显示影响页数 → 刷新后仍清空

**`template-mode-switch.spec.ts`(决策 7 关键)**
- 单→多:DetailEditor 点"转为多模板" → 路由跳 template-setup → 模板库已有创建项目时的那张
- 多→单:SlidePreview 顶部点"转为单模板" → 弹层选模板 → 所有页统一 → 刷新后仍统一
- 多→单切换不影响已生成图片:先生成 page1 图,再切换,page1 图保留

**`template-fine-tune-drawer.spec.ts`(继承原 `fine-tune-drawer.spec.ts`)**
- 单模板模式下抽屉无模板库区
- 多模板模式下抽屉完整功能,上传/绑定/删除全跑

**`template-route-guard.spec.ts`(决策 6 守卫)**
- 单模板项目手动访问 `/project/:id/template-setup`,验证 `replace` 跳转到 `/preview`,浏览器历史栈中无 `template-setup` 条目(按浏览器后退应回到 detail,而非 template-setup)
- 多模板项目访问 `/template-setup` 正常渲染,不跳转

### 8.4 真实生成链路验证(CLAUDE.md 强制要求)

至少一次端到端真实 AI 调用(成本由项目接受):
1. 创建 3 页多模板项目
2. 上传 2 张模板图(等真实解析完成)
3. 一键自动匹配(等真实 LLM 完成)
4. 生成所有页图片(等真实图生 API 完成)
5. 人工检查:每页生成图片的风格与该页绑定模板一致

---

## 9. 实施顺序与里程碑

按依赖拓扑排,每步内部可并行,步与步之间串行:

### 阶段 A:基础数据层(预计 1 天)
1. 新建分支 `feat/per-page-template-v2`(从最新 `main`,不复用旧 `feat/per-page-template`)
2. 写 SQLAlchemy model:`ProjectTemplateAsset` + `Project.template_mode` + `Page` 5 列
3. 写 Alembic migration 含 backfill
4. 后端 model 单测(空对象到 to_dict、relationship 级联)

### 阶段 B:文件与 PDF(预计 1 天)
5. `FileService` 新方法 + `file_controller` 路径放行
6. 新建 `pdf_image_service.py`
7. `test_template_pdf_split.py` 通过(不含 AI)

### 阶段 C:Asset CRUD + 模式切换 API(预计 1.5 天)
8. `template_controller.py` 新 endpoints(本节 §3.2 / §3.3 全部)
9. `task_manager` 加 `SPLIT_TEMPLATE_PDF` task type
10. `test_template_assets_api.py` + `test_template_mode_switch.py` 通过

### 阶段 D:AI 解析与自动匹配(预计 1.5 天)
11. `prompts.py` 加两个新 prompt
12. `ai_service.py` 加 `analyze_template` / `auto_match_templates`
13. `task_manager` 加 `ANALYZE_TEMPLATE` / `AUTO_MATCH_TEMPLATES` task type
14. `test_template_analysis.py` + `test_template_auto_match.py` 通过(LLM 部分 mock)

### 阶段 E:图片生成链路(预计 1 天)
15. `resolve_page_template` 抽函数 + `task_manager:645-668` 改造
16. `generate_image_prompt` 签名扩展
17. `test_image_generation_template_priority.py` 通过(**真实 AI**)

### 阶段 F:前端(预计 3 天)
18. 路由 + 类型 + store 全量替换
19. 新建 `TemplateSetupPage` + 4 个新组件
20. 改造 `Home` / `DetailEditor` / `SlidePreview`
21. 抽屉接 store
22. 前端 Vitest 通过

### 阶段 G:E2E + 真实链路(预计 1 天)
23. 6 个 Playwright 用例
24. 真实生成链路验证一次
25. 文档更新(`docs/zh/` + README 模板模块)

### 阶段 H:PR(预计 0.5 天)
26. 拆 commit:数据层 / 文件 / Asset API / AI / 图生 / 前端 / E2E / 文档
27. 推 PR,等 Gemini review,处理 inline comments
28. 合并、删 worktree(若用)、删旧 `feat/per-page-template` 分支

**合计预估:9.5 个工作日**

### 9.1 风险点提示

- PDF 拆页 OOM:DPI 默认 150,实测后视情况调
- LLM 解析失败率:决策 2 已兜底,但若 >30% 失败需复盘 prompt(`prompts.py` 加日志)
- 模式切换事务:多→单批量更新页可能 N+1,用 `update().where(Page.project_id == ...)` 单条 SQL
- 旧 `feat/per-page-template` 分支不动,合并后单独删,避免回流到本分支

### 9.2 不做(显式排除)

- 系统预设模板池(留 `GET /api/templates` 接口空跑)
- 模板版本/历史(`analysis_json` 用 JSON 字段已支撑 schema 演进)
- Embedding 模板预过滤(决策 5 已排除,N>20 模板时再评估)
- 跨项目模板复用(`UserTemplate` 已存在但不接入页级模板系统,后续若做合并)
- 自动匹配的"逐页单独 LLM 调用"模式(决策 5 排除)




