# Banana Slides Backend

这个目录是 Banana Slides SaaS 的后端服务。它不是单一的“AI 生成接口”，而是一个包含认证、项目管理、积分、支付、系统配置、参考文件解析、异步任务和导出能力的 Flask SaaS API。

## 当前后端定位

后端负责四类核心职责：

- 提供项目生成与编辑 API
- 维护用户、积分、支付、邀请码、系统设置等 SaaS 数据模型
- 调度耗时任务，例如批量描述生成、图片生成、可编辑 PPTX 导出
- 抽象 AI provider、任务队列、存储后端、支付提供商，降低后续扩展成本

## 技术栈

- Flask 3
- Flask-SQLAlchemy
- Flask-Migrate / Alembic
- SQLite（默认）+ `DATABASE_URL` 可覆盖
- Google GenAI SDK / OpenAI SDK
- python-pptx
- Pillow
- Thread-based task queue abstraction
- uv

## 后端架构

### 1. 应用入口

入口是 `app.py`，采用应用工厂模式：

- 从项目根目录 `.env` 加载环境变量
- 初始化 Flask 配置、数据库、CORS、迁移
- 创建 `backend/instance/` 与根目录 `uploads/`
- 注册所有蓝图
- 启动时把数据库中的 `Settings` 同步回 `app.config`
- 自动补默认管理员

同时会启用 SQLite WAL 和超时参数，以减轻多线程任务下的锁竞争问题。

### 2. 控制器层

控制器位于 `controllers/`，当前主要蓝图包括：

- `auth_controller.py`
  - 注册、登录、刷新 token、邮箱验证、密码重置
- `project_controller.py`
  - 创建项目、获取项目、更新项目、删除项目
  - 生成大纲
  - 从描述直接生成大纲和描述
  - refine 大纲 / refine 描述
- `page_controller.py`
  - 单页更新、描述更新、图片生成与编辑相关接口
- `template_controller.py`
  - 项目模板图
  - 用户模板图库 `user_template_bp`
- `material_controller.py`
  - 项目素材中心与全局素材接口
- `reference_file_controller.py`
  - 参考文件上传、解析、关联、解除关联
- `export_controller.py`
  - PPTX、PDF、可编辑 PPTX 导出
- `settings_controller.py`
  - 用户侧设置读取与更新
- `payment_controller.py`
  - 下单、支付回调、支付状态
- `invitation_controller.py`
  - 邀请码兑换
- `admin_controller.py`
  - 后台统计、用户、订单、交易等管理接口
- `admin_config_controller.py`
  - 系统级配置、用户可编辑字段策略、积分成本
- `file_controller.py`
  - 统一文件访问接口

### 3. 服务层

`services/` 是后端的核心业务层。

#### AI 服务

- `ai_service.py`
  - 面向业务流程的统一 AI 调用入口
- `ai_service_manager.py`
  - AIService 单例与 provider 缓存，避免每次请求重新初始化模型客户端
- `services/ai_providers/text/`
  - 文本模型 provider
- `services/ai_providers/image/`
  - 图片生成与修复 provider
- `services/ai_providers/ocr/`
  - OCR provider

当前代码已支持多 provider 格式，而不是只绑定单一 Gemini：

- `gemini`
- `openai`
- `vertex`

#### 任务与队列

- `task_manager.py`
  - 后台任务兼容层
  - 当前默认队列是线程池抽象
- `services/queue/`
  - 队列抽象接口与 `thread_pool` 实现

这层主要承担：

- 批量生成描述
- 批量生成图片
- 导出任务
- 可编辑 PPTX 递归分析导出

#### 导出能力

- `export_service.py`
  - 普通 PPTX 导出
  - PDF 导出
  - 可编辑 PPTX 导出
- `utils/pptx_builder.py`
  - 将识别出的文本、表格、图像元素写入 PPTX
- `services/image_editability/`
  - 递归元素提取、文本属性分析、背景修复、元素重建

可编辑 PPTX 导出是当前私有版的重要能力，不应再在文档中简化成“仅导出图片型 PPT”。

#### 文件与解析

- `file_service.py`
  - 上传、模板、生成图、缓存图、用户模板等文件管理
- `file_parser_service.py`
  - 参考文件解析
- `storage/`
  - 存储抽象，当前默认 `local`

#### 商业化与账号能力

- `auth_service.py`
  - token、用户认证等核心逻辑
- `credits_service.py`
  - 积分扣减、消耗类型定义
- `payment/`
  - 支付提供商抽象
  - 已实现 `xunhupay` 和 `lemon_squeezy`
- `email_service.py`
  - 邮件验证码与通知
- `admin_service.py`
  - 后台统计与管理相关聚合逻辑

### 4. 数据模型

模型位于 `models/`，当前不止项目和页面，已经是完整 SaaS 数据层：

- `Project`
- `Page`
- `Task`
- `User`
- `UserSettings`
- `Settings`
- `SystemConfig`
- `CreditTransaction`
- `PaymentOrder`
- `InvitationCode`
- `Material`
- `ReferenceFile`
- `UserTemplate`
- `PageImageVersion`

其中：

- `Settings` 偏向系统生成配置
- `UserSettings` 是用户级稀疏覆盖表，只保存用户真正改过的字段
- `SystemConfig` 管理积分价格、用户可编辑字段等 SaaS 级策略
- `PageImageVersion` 支持页面图片历史版本切换

### 5. 中间件与工具层

- `middlewares/auth.py`
  - 登录鉴权
- `middlewares/credits.py`
  - 积分校验
- `utils/response.py`
  - 统一响应结构
- `utils/validators.py`
  - 输入校验
- `utils/security.py`
  - 安全相关辅助
- `utils/image_utils.py`
  - 图片尺寸与质量检测
- `utils/page_utils.py`
  - 页面筛选等通用逻辑

## 当前目录结构

```text
backend/
├── app.py
├── config.py
├── controllers/              # 路由与 HTTP 入口
├── middlewares/              # 鉴权与积分中间件
├── migrations/               # Alembic 迁移
├── models/                   # ORM 模型
├── services/
│   ├── ai_providers/         # 文本 / 图片 / OCR provider
│   ├── image_editability/    # 可编辑 PPTX 的图像理解能力
│   ├── payment/              # 支付提供商抽象
│   ├── queue/                # 队列抽象
│   ├── storage/              # 存储抽象
│   └── *.py                  # 业务服务
├── tests/
│   ├── integration/
│   └── unit/
├── utils/
├── Dockerfile
└── alembic.ini
```

## 关键配置

配置定义在 `config.py`。数据库连接优先使用 `DATABASE_URL`，其余运行期配置会在启动后被数据库中的设置覆盖一部分。

### 基础配置

- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`
- `LOG_LEVEL`
- `UPLOAD_FOLDER`

### AI 相关

- `AI_PROVIDER_FORMAT`
- `GOOGLE_API_KEY`
- `GOOGLE_API_BASE`
- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION`
- `TEXT_MODEL`
- `IMAGE_MODEL`
- `IMAGE_CAPTION_MODEL`

### 生成与并发

- `MAX_DESCRIPTION_WORKERS`
- `MAX_IMAGE_WORKERS`
- `DEFAULT_ASPECT_RATIO`
- `DEFAULT_RESOLUTION`
- `OUTPUT_LANGUAGE`

### 文件解析与图像处理

- `MINERU_TOKEN`
- `MINERU_API_BASE`
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `INPAINTING_PROVIDER`
- `BAIDU_OCR_API_KEY`

## 本地开发

### 1. 安装依赖

依赖由根目录 `pyproject.toml` 管理：

```bash
cd /home/aa/banana-slides-saas-89942e8-private
uv sync
```

### 2. 初始化数据库

```bash
cd backend
uv run alembic upgrade head
```

### 3. 启动后端

```bash
uv run python app.py
```

默认监听 `http://localhost:5000`。

## 典型 API 能力

当前后端提供的核心接口族包括：

- 认证：`/api/auth/*`
- 项目：`/api/projects/*`
- 页面生成与编辑：`/api/projects/:id/pages/*`
- 用户模板：`/api/user-templates`
- 参考文件：`/api/reference-files/*`
- 设置：`/api/settings`
- 支付：`/api/payments/*`
- 邀请码：`/api/invitations/*`
- 管理后台：`/api/admin/*`
- 系统配置：`/api/admin/config*`
- 文件访问：`/files/*`
- 健康检查：`/health`

## 测试

```bash
cd backend
uv run pytest
```

测试已经按层拆分：

- `tests/unit/`
- `tests/integration/`

前者覆盖接口、校验器、认证与积分逻辑，后者覆盖端到端业务流。

## 维护重点

- 新增 HTTP 能力，优先放入 `controllers/ + services/`
- 涉及模型配置切换，先检查 `config.py`、`settings_controller.py`、`ai_service_manager.py`
- 涉及异步任务，先检查 `task_manager.py` 与 `services/queue/`
- 涉及可编辑 PPTX，重点检查 `export_service.py`、`utils/pptx_builder.py`、`services/image_editability/`
- 涉及普通用户可改哪些设置，重点检查 `SystemConfig` 和 `admin_config_controller.py`
