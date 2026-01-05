# Banana Slides Backend

蕉幻（Banana Slides）后端服务 - AI驱动的PPT生成系统

## 技术栈

- **框架**: Flask 3.0
- **数据库**: SQLite + SQLAlchemy ORM
- **AI服务**: Google Gemini API
- **PPT处理**: python-pptx
- **并发处理**: ThreadPoolExecutor
- **包管理**: uv

## 项目结构

```
backend/
├── app.py                    # Flask应用入口
├── config.py                 # 配置文件
├── models/                   # 数据库模型
│   ├── __init__.py
│   ├── project.py           # Project模型
│   ├── page.py              # Page模型
│   └── task.py              # Task模型
├── services/                 # 服务层
│   ├── __init__.py
│   ├── ai_service.py        # AI相关服务
│   ├── file_service.py      # 文件管理服务
│   ├── export_service.py    # 导出服务
│   └── task_manager.py      # 异步任务管理
├── controllers/              # 控制器层
│   ├── __init__.py
│   ├── project_controller.py
│   ├── page_controller.py
│   ├── template_controller.py
│   ├── export_controller.py
│   └── file_controller.py
├── utils/                    # 工具函数
│   ├── __init__.py
│   ├── response.py          # 统一响应格式
│   └── validators.py        # 数据验证
├── instance/                 # 数据库文件目录（自动创建）
├── uploads/                  # 文件上传目录（自动创建）
├── .env.example             # 环境变量示例
└── README.md                # 本文件
```

## 快速开始

### 1. 安装依赖

本项目使用 [uv](https://github.com/astral-sh/uv) 管理 Python 依赖。所有依赖定义在项目根目录的 `pyproject.toml` 文件中。

在项目根目录下运行：
```bash
uv sync
```

这将自动安装所有必需的依赖包。

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
GOOGLE_API_KEY=your-google-api-key
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# 火山引擎配置（可选，用于 Inpainting 图像消除功能）
VOLCENGINE_ACCESS_KEY=your-volcengine-access-key
VOLCENGINE_SECRET_KEY=your-volcengine-secret-key
VOLCENGINE_INPAINTING_TIMEOUT=60
VOLCENGINE_INPAINTING_MAX_RETRIES=3
```

### 3. 初始化 / 升级数据库结构（Alembic 迁移）

从当前版本开始，后端使用 Alembic 管理数据库结构变更。

```bash
cd backend
uv run alembic upgrade head
```

> 注意：  
> - 首次运行时会自动创建 `alembic_version` 表并将数据库迁移到最新结构；  
> - 后续新增模型字段时，只需要更新 `models/`，然后使用 `alembic revision --autogenerate` 生成迁移，再执行 `alembic upgrade head`。

### 4. 运行服务

使用 uv 运行：
```bash
cd backend
uv run python app.py
```
服务将在 `http://localhost:5000` 启动。

## API文档

完整的API文档请参考项目根目录的 `API设计文档.md`。

### 主要端点

#### 项目管理
- `POST /api/projects` - 创建项目
- `GET /api/projects/{project_id}` - 获取项目详情
- `PUT /api/projects/{project_id}` - 更新项目
- `DELETE /api/projects/{project_id}` - 删除项目

#### 大纲生成
- `POST /api/projects/{project_id}/generate/outline` - 生成大纲

#### 描述生成
- `POST /api/projects/{project_id}/generate/descriptions` - 批量生成描述（异步）
- `POST /api/projects/{project_id}/pages/{page_id}/generate/description` - 单页生成

#### 图片生成
- `POST /api/projects/{project_id}/generate/images` - 批量生成图片（异步）
- `POST /api/projects/{project_id}/pages/{page_id}/generate/image` - 单页生成
- `POST /api/projects/{project_id}/pages/{page_id}/edit/image` - 编辑图片

#### 模板管理
- `POST /api/projects/{project_id}/template` - 上传模板
- `DELETE /api/projects/{project_id}/template` - 删除模板

#### 导出
- `GET /api/projects/{project_id}/export/pptx` - 导出PPTX
- `GET /api/projects/{project_id}/export/pdf` - 导出PDF

#### 静态文件
- `GET /files/{project_id}/{type}/{filename}` - 获取文件

## 核心功能

### 1. AI驱动的内容生成

基于 Google Gemini API，支持：
- 自动生成PPT大纲
- 并行生成页面描述
- 根据参考模板生成图片
- 自然语言编辑图片

### 2. 异步任务处理

使用 `ThreadPoolExecutor` 实现简单但高效的异步任务处理：
- 并行生成多个页面描述
- 并行生成多个页面图片
- 实时任务进度跟踪

### 3. 文件管理

完整的文件管理系统：
- 项目级文件隔离
- 模板图片管理
- 生成图片管理
- 自动清理机制

### 4. Inpainting 图像消除（可选）

基于火山引擎的 Inpainting 服务，支持：
- 根据边界框（bbox）精确消除图像区域
- 自动生成掩码图像
- 重新生成背景（保留前景，消除其他区域）
- 支持批量处理和重试机制

使用方法：
```python
from services.inpainting_service import InpaintingService, remove_regions
from PIL import Image

# 方式1：使用服务类
service = InpaintingService()
image = Image.open('original.png')
bboxes = [(100, 100, 200, 200), (300, 150, 400, 250)]  # 要消除的区域
result = service.remove_regions_by_bboxes(image, bboxes)

# 方式2：使用便捷函数
result = remove_regions(image, bboxes, expand_pixels=5)
```

### 5. 数据持久化

使用 SQLite + SQLAlchemy：
- 轻量级，无需额外配置
- 支持关系型数据操作
- 事务保证数据一致性

## 开发说明

### 数据模型

#### Project（项目）
- 项目基本信息
- 模板图片路径
- 项目状态
- 关联的页面和任务

#### Page（页面）
- 页面顺序
- 大纲内容（JSON）
- 描述内容（JSON）
- 生成的图片路径
- 页面状态

#### Task（任务）
- 任务类型（生成描述/生成图片）
- 任务状态
- 进度信息（JSON）
- 错误信息

### 状态机

#### 项目状态
```
DRAFT → OUTLINE_GENERATED → DESCRIPTIONS_GENERATED → GENERATING_IMAGES → COMPLETED
```

#### 页面状态
```
DRAFT → DESCRIPTION_GENERATED → GENERATING → COMPLETED | FAILED
```

#### 任务状态
```
PENDING → PROCESSING → COMPLETED | FAILED
```

### 扩展开发

#### 添加新的AI模型

在 `services/ai_service.py` 中添加新的模型支持：

```python
class AIService:
    def __init__(self, api_key: str, model_type: str = 'gemini'):
        if model_type == 'gemini':
            # Gemini implementation
        elif model_type == 'openai':
            # OpenAI implementation
        # ...
```

#### 自定义提示词模板

修改 `services/ai_service.py` 中的提示词生成逻辑：

```python
def generate_image_prompt(self, ...):
    prompt = dedent(f"""
        # 自定义提示词模板
        ...
    """)
    return prompt
```

#### 添加新的导出格式

在 `services/export_service.py` 中添加新的导出方法：

```python
class ExportService:
    @staticmethod
    def create_custom_format(image_paths, output_file):
        # 实现自定义格式导出
        pass
```


## 测试

### 健康检查

```bash
curl http://localhost:5000/health
```

### 创建项目

```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"creation_type":"idea","idea_prompt":"生成环保主题ppt"}'
```

### 上传模板

```bash
curl -X POST http://localhost:5000/api/projects/{project_id}/template \
  -F "template_image=@template.png"
```

### 生成大纲

```bash
curl -X POST http://localhost:5000/api/projects/{project_id}/generate/outline \
  -H "Content-Type: application/json" \
  -d '{"idea_prompt":"生成环保主题ppt"}'
```

## 常见问题

### Q: 数据库文件在哪里？
A: 在 `backend/instance/database.db`，会自动创建。

### Q: 上传的文件存在哪里？
A: 在 `uploads/{project_id}/` 目录下，按项目隔离。

### Q: 如何修改并发数？
A: 推荐通过前端设置页修改（会同步到数据库并覆盖 `.env` 值）；也可以在 `.env` 文件中修改 `MAX_DESCRIPTION_WORKERS` 和 `MAX_IMAGE_WORKERS` 作为默认值，然后在设置页点击“重置为默认值”同步到 DB。

### Q: 如何切换到其他AI模型 / 修改 MinerU 地址？
A: 从当前版本开始，推荐通过前端“系统设置”页面修改：  
- 大模型提供商格式 / API Base / API Key  
- 文本模型 (`TEXT_MODEL`) / 图片模型 (`IMAGE_MODEL`)  
- MinerU 地址 (`MINERU_API_BASE`) / 图片识别模型 (`IMAGE_CAPTION_MODEL`)  

这些值会保存到 `settings` 表并覆盖 `.env` 中对应配置，点击“重置为默认值”会回到 `.env` 的默认值。

### Q: 支持哪些图片格式？
A: PNG, JPG, JPEG, GIF, WEBP。在 `config.py` 中的 `ALLOWED_EXTENSIONS` 配置。


## 开源字体说明

本项目包含 **Noto Sans CJK SC**（思源黑体简体中文）字体文件，用于 PPT 导出时的精确文本测量。

- **字体文件**: `fonts/NotoSansSC-Regular.ttf`
- **来源**: [Google Noto CJK Fonts](https://github.com/googlefonts/noto-cjk)
- **许可证**: [SIL Open Font License 1.1 (OFL)](https://scripts.sil.org/OFL)

OFL 许可证允许自由使用、修改和分发该字体。

## 联系方式

如有问题或建议，请通过 GitHub Issues 反馈。

