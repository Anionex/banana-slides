<div align="center">

<img width="256" src="https://github.com/user-attachments/assets/6f9e4cf9-912d-4faa-9d37-54fb676f547e">

*Vibe your PPT like vibing code.*

<p>

[![GitHub Stars](https://img.shields.io/github/stars/Anionex/banana-slides?style=square)](https://github.com/Anionex/banana-slides/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Anionex/banana-slides?style=square)](https://github.com/Anionex/banana-slides/network)
[![GitHub Watchers](https://img.shields.io/github/watchers/Anionex/banana-slides?style=square)](https://github.com/Anionex/banana-slides/watchers)

[![Version](https://img.shields.io/badge/version-v0.1.0-4CAF50.svg)](https://github.com/Anionex/banana-slides)
![Docker](https://img.shields.io/badge/Docker-Build-2496ED?logo=docker&logoColor=white)
[![License](https://img.shields.io/github/license/Anionex/banana-slides?color=FFD54F)](https://github.com/Anionex/banana-slides/blob/main/LICENSE)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-42b883.svg)

</p>

<b>一个基于nano banana pro🍌的原生AI PPT生成应用，支持想法/大纲/页面描述生成完整PPT演示文稿、文本图片链接自动提取、上传任意素材、口头提出修改，迈向真正的"Vibe PPT"</b>

<b>🎯 降低PPT制作门槛，让每个人都能快速创作出美观专业的演示文稿</b>

<br>

*如果该项目对你有用, 欢迎star🌟 &  fork🍴*

<br>

</p>

</div>

## ✨ 项目缘起

你是否也曾陷入这样的困境：明天就要汇报，但PPT还是一片空白；脑中有无数精彩的想法，却被繁琐的排版和设计消磨掉所有热情？

我(们)渴望能快速创作出既专业又具设计感的演示文稿，传统的AI PPT生成app，虽然大体满足“快”这一需求，却还存在以下问题：

- 1️⃣只能选择预设模版，无法灵活调整风格
- 2️⃣自由度低，多轮改动难以进行
- 3️⃣成品观感相似，同质化严重
- 4️⃣素材质量较低，缺乏针对性
- 5️⃣图文排版割裂，设计感差

以上这些缺陷，让传统的AI ppt生成器难以同时满足我们“快”和“美”的两大PPT制作需求。即使自称Vibe PPT，但是在我的眼中还远不够“Vibe”。

但是，nano banana🍌模型的出现让一切有了转机。我尝试使用🍌pro进行ppt页面生成，发现生成的结果无论是质量、美感还是一致性，都做的非常好，且几乎能精确渲染prompt要求的所有文字+遵循参考图的风格。那为什么不基于🍌pro，做一个原生的"Vibe PPT"应用呢？

## 👨‍💻 适用场景

1. **小白**：零门槛快速生成美观PPT，无需设计经验，减少模板选择烦恼
2. **PPT专业人士**：参考AI生成的布局和图文元素组合，快速获取设计灵感
3. **教育工作者**：将教学内容快速转换为配图教案PPT，提升课堂效果
4. **学生**：快速完成作业Pre，把精力专注于内容而非排版美化
5. **职场人士**：商业提案、产品介绍快速可视化，多场景快速适配

## 🎨 结果案例

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **钱的演变：从贝壳到纸币的旅程** | **DeepSeek-V3.2技术展示** |
| <img src="https://github.com/user-attachments/assets/d1e15604-767c-42f8-bb41-a2568f18bc2b" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> |
| **人类对生态环境的影响** | **预制菜智能产线装备研发和产业化** |

</div>

更多可见<a href="https://github.com/Anionex/banana-slides/issues/2" > 使用案例 </a>

## 🗺️ 开发计划

| 状态 | 里程碑 |
| --- | --- |
| ✅ 已完成 | 从想法、大纲、页面描述三种路径创建 PPT |
| ✅ 已完成 | 解析文本中的 Markdown 格式图片 |
| ✅ 已完成 | PPT 单页添加更多素材 |
| ✅ 已完成 | PPT 单页框选区域Vibe口头编辑 |
| ✅ 已完成 | 素材模块: 素材生成、上传等 |
| ✅ 已完成 | 支持多种文件的上传+解析 |
| ✅ 已完成 | 支持Vibe口头调整大纲和描述 |
| 🔄 进行中 | 支持已生成图片的元素分割和进一步编辑（segment + inpaint） |
| 🔄 进行中 | 网络搜索 |
| 🔄 进行中 | Agent 模式 |
| 🧭 规划中 | 优化前端加载速度 |
| 🧭 规划中 | 在线播放功能 |
| 🧭 规划中 | 简单的动画和页面切换效果 |
| 🧭 规划中 | 多语种支持 |
| 🧭 规划中 | 用户系统 |

## 🎯 功能介绍

### Banana-slides🍌 (aka. 蕉幻) 的亮点

- 🚀 **一句话生成 PPT**：从一个简单的想法快速得到大纲、页面描述和最终的 PPT 文稿
- 🔄 **三种生成路径**：支持从「想法 / 大纲 / 页面描述」三种方式起步，适配不同创作习惯
- 🔍 **文本与链接自动提取**：支持从一段文本中自动抽取要点、图片链接等信息
- 🔗 **文件上传自动解析**: 支持导入docx/pdf/md/txt等格式的文件，后台自动解析，为图片内容生成描述，为后续生成提供素材。
- 🧾 **上传任意素材**：可上传参考图片、示例 PPT图（后续支持ppt文件） 等作为风格和内容参考
- 🧙‍♀️ **AI 辅助编排**：由 LLM 生成结构清晰的大纲和逐页内容描述
- 🖼️ **高质量页面生成**：基于 nano banana pro🍌 生成高清、风格统一的页面设计
- 🗣️ **自然语言修改**：支持对单页、单页局部（已支持）或整套（未来支持）PPT 进行「口头」式自然语言修改与重生成
- 📊 **一键导出**：自动组合为 PPTX / PDF，16:9 比例，开箱即用

### 1. 多种创建方式

- **从构想生成**：输入一句话 / 一段想法，自动生成完整大纲和页面内容
- **从大纲生成**：粘贴已有大纲，AI 帮你扩展为逐页详细描述
- **从描述生成**：直接提供每页描述，快速生成成品页面图片

### 2. 智能大纲与页面描述生成

- 根据用户输入主题自动生成 PPT 大纲与整套页面结构
- 以卡片形式呈现，支持删除、拖拽、调整顺序
- 既可以一次性批量生成，也可以单个编辑逐步补充和细化
- 内置并行处理能力，提升多页生成速度

### 3. 多格式文件自动智能解析

- 支持上传pdf/doc/docx/md/txt等格式文件
- 使用mineru+多模态llm并行解析文件文字+图片并进行分离，为后续生成提供文本、图表素材。

### 4. 文本与素材理解

- 支持对输入文本进行关键点抽取、结构化整理
- 自动识别并提取其中的图片、（markdown图片）链接等资源
- 支持上传参考图片、截图、旧 PPT 作为风格与内容线索

### 5. 多格式导出

- **PPTX 导出**：标准 PowerPoint 格式
- **PDF 导出**：适合快速分享和展示
- 默认 16:9 比例，保证在主流显示设备上的观感

## 📦 使用方法

### 克隆代码仓库

```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

### 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```shell
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```env
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
PORT=5000 # 如果使用非 docker 部署, 需要修改此端口以防止后端服务端口冲突.
...
```

### 使用 Docker Compose🐳（推荐）

这是最简单的部署方式，可以一键启动前后端服务。

<details>
  <summary>📒Windows用户说明</summary>

如果你使用 Windows, 请先安装 Windows Docker Desktop，检查系统托盘中的 Docker 图标，确保 Docker 正在运行，然后使用相同的步骤操作。

> **提示**：如果遇到问题，确保在 Docker Desktop 设置中启用了 WSL 2 后端（推荐），并确保端口 3000 未被占用。

</details>

1. **配置环境变量**: 见[上](#配置环境变量)

2. **启动服务**

```bash
docker compose up -d
```

3. **访问应用**: <http://localhost:3000>
<!-- - 后端 API：http://localhost:5000 -->

4. **查看日志**

```bash
# 查看后端日志（实时查看最后50行）
sudo docker compose logs -f --tail 50 backend

# 查看所有服务日志
sudo docker compose logs -f --tail 50

# 查看前端日志
sudo docker compose logs -f --tail 50 frontend
```

5. **停止服务**

```bash
docker compose down
```

6. **更新项目**

拉取最新代码并重新构建和启动服务：

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 从源码部署

#### 环境要求

- Python 3.10 或更高版本
- [uv](https://github.com/astral-sh/uv) - Python 包管理器
- Node.js 16+ 和 npm
- 有效的 Google Gemini API 密钥

#### just 工具 (可选)

just 安装方法: [just - 安装包](https://just.systems/man/zh/%E5%AE%89%E8%A3%85%E5%8C%85.html)

以下是几种很方便的直接安装 just 的方法:

```shell
brew install just # macos
npm install -g rust-just
cargo [b]install just # 需要 rust 环境
choco install just # windows
scoop install just # windows
# 或者直接下载二进制可执行文件 (参考官网安装教程):
# 创建 ~/bin
mkdir -p ~/bin
# 下载并解压 just 到 ~/bin/just
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/bin
# 在 Shell 搜索可执行文件的路径中添加`~/bin`
# 这一行应该被添加到你的 Shell 初始化文件中，e.g. `~/.bashrc` 或者 `~/.zshrc`：
export PATH="$PATH:$HOME/bin"
# 现在 just 应该就可以执行了
just --help
```

可以使用 just 工具快速启动, 无需手动安装前后端.

[配置环境变量](#配置环境变量)并安装 uv 和 npm 之后, 直接运行:

```shell
just install dev
# 或更简洁地
just
```

然后访问应用: <http://localhost:3000>

#### 后端安装

1. **配置环境变量**: 见[上](#配置环境变量)

2. **安装 uv（如果尚未安装）**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

3. **安装依赖**

在项目根目录下运行：

```bash
uv sync
```

这将根据 `pyproject.toml` 自动安装所有依赖。

#### 前端安装

1. **进入前端目录**

```bash
cd frontend
```

2. **安装依赖**

```bash
npm install
```

3. **配置API地址**

前端会自动连接到 `http://localhost:5000` 的后端服务。如需修改，请编辑 `src/api/client.ts`。

#### 启动后端服务

```bash
cd backend
uv run python app.py
```

后端服务将在 `http://localhost:5000` 启动。

访问 `http://localhost:5000/health` 验证服务是否正常运行。

#### 启动前端开发服务器

```bash
cd frontend
PORT=5000 npm run dev
```

前端开发服务器将在 `http://localhost:3000` 启动。

打开浏览器访问即可使用应用。

## 🛠️ 技术架构

### 前端技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **状态管理**：Zustand
- **路由**：React Router v6
- **UI组件**：Tailwind CSS
- **拖拽功能**：@dnd-kit
- **图标**：Lucide React
- **HTTP客户端**：Axios

### 后端技术栈

- **语言**：Python 3.10+
- **框架**：Flask 3.0
- **包管理**：uv
- **数据库**：SQLite + Flask-SQLAlchemy
- **AI能力**：Google Gemini API
- **PPT处理**：python-pptx
- **图片处理**：Pillow
- **并发处理**：ThreadPoolExecutor
- **跨域支持**：Flask-CORS

## 📁 项目结构

```
banana-slides/
├── frontend/                    # React前端应用
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   │   ├── Home.tsx        # 首页（创建项目）
│   │   │   ├── OutlineEditor.tsx    # 大纲编辑页
│   │   │   ├── DetailEditor.tsx     # 详细描述编辑页
│   │   │   ├── SlidePreview.tsx     # 幻灯片预览页
│   │   │   └── History.tsx          # 历史版本管理页
│   │   ├── components/         # UI组件
│   │   │   ├── outline/        # 大纲相关组件
│   │   │   │   └── OutlineCard.tsx
│   │   │   ├── preview/        # 预览相关组件
│   │   │   │   ├── SlideCard.tsx
│   │   │   │   └── DescriptionCard.tsx
│   │   │   ├── shared/         # 共享组件
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Textarea.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── Markdown.tsx
│   │   │   │   ├── MaterialSelector.tsx
│   │   │   │   ├── MaterialGeneratorModal.tsx
│   │   │   │   ├── TemplateSelector.tsx
│   │   │   │   ├── ReferenceFileSelector.tsx
│   │   │   │   └── ...
│   │   │   ├── layout/         # 布局组件
│   │   │   └── history/        # 历史版本组件
│   │   ├── store/              # Zustand状态管理
│   │   │   └── useProjectStore.ts
│   │   ├── api/                # API接口
│   │   │   ├── client.ts       # Axios客户端配置
│   │   │   └── endpoints.ts    # API端点定义
│   │   ├── types/              # TypeScript类型定义
│   │   ├── utils/              # 工具函数
│   │   ├── constants/          # 常量定义
│   │   └── styles/             # 样式文件
│   ├── public/                 # 静态资源
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js      # Tailwind CSS配置
│   ├── Dockerfile
│   └── nginx.conf              # Nginx配置
│
├── backend/                    # Flask后端应用
│   ├── app.py                  # Flask应用入口
│   ├── config.py               # 配置文件
│   ├── models/                 # 数据库模型
│   │   ├── project.py          # Project模型
│   │   ├── page.py             # Page模型（幻灯片页）
│   │   ├── task.py             # Task模型（异步任务）
│   │   ├── material.py         # Material模型（参考素材）
│   │   ├── user_template.py    # UserTemplate模型（用户模板）
│   │   ├── reference_file.py   # ReferenceFile模型（参考文件）
│   │   └── page_image_version.py # PageImageVersion模型（页面版本）
│   ├── services/               # 服务层
│   │   ├── ai_service.py       # AI生成服务（Gemini集成）
│   │   ├── file_service.py     # 文件管理服务
│   │   ├── file_parser_service.py # 文件解析服务
│   │   ├── export_service.py   # PPTX/PDF导出服务
│   │   ├── task_manager.py     # 异步任务管理
│   │   └── prompts.py          # AI提示词模板
│   ├── controllers/            # API控制器
│   │   ├── project_controller.py      # 项目管理
│   │   ├── page_controller.py         # 页面管理
│   │   ├── material_controller.py     # 素材管理
│   │   ├── template_controller.py     # 模板管理
│   │   ├── reference_file_controller.py # 参考文件管理
│   │   ├── export_controller.py       # 导出功能
│   │   └── file_controller.py         # 文件上传
│   ├── utils/                  # 工具函数
│   │   ├── response.py         # 统一响应格式
│   │   ├── validators.py       # 数据验证
│   │   └── path_utils.py       # 路径处理
│   ├── instance/               # SQLite数据库（自动生成）
│   ├── exports/                # 导出文件目录
│   ├── Dockerfile
│   └── README.md
│
├── tests/                      # 测试文件目录
├── v0_demo/                    # 早期演示版本
├── output/                     # 输出文件目录
│
├── pyproject.toml              # Python项目配置（uv管理）
├── uv.lock                     # uv依赖锁定文件
├── docker-compose.yml          # Docker Compose配置
├── .env.example                 # 环境变量示例
├── LICENSE                     # MIT许可证
└── README.md                   # 本文件
```

## 🤝 贡献指南

欢迎通过
[Issue](https://github.com/Anionex/banana-slides/issues)
和
[Pull Request](https://github.com/Anionex/banana-slides/pulls)
为本项目贡献力量！

## 📄 许可证

MIT

## 📈 项目统计

<a href="https://www.star-history.com/#Anionex/banana-slides&type=date&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&legend=top-left" />

 </picture>

</a>

<br>
