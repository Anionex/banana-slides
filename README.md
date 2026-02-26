<div align="center">

<img width="256" src="https://github.com/user-attachments/assets/6f9e4cf9-912d-4faa-9d37-54fb676f547e">

*Vibe your PPT like vibing code.*

**中文 | [English](README_EN.md)**

<p>

[![GitHub Stars](https://img.shields.io/github/stars/Anionex/banana-slides?style=square&color=FFD700)](https://github.com/Anionex/banana-slides/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Anionex/banana-slides?style=square&color=FFD700)](https://github.com/Anionex/banana-slides/network)
[![GitHub Watchers](https://img.shields.io/github/watchers/Anionex/banana-slides?style=square&color=FFD700)](https://github.com/Anionex/banana-slides/watchers)


[![Version](https://img.shields.io/badge/version-v0.4.0-44cc11)](https://github.com/Anionex/banana-slides)
![Docker](https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white)
[![License](https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa)](https://github.com/Anionex/banana-slides/blob/main/LICENSE)





</p> 

<b>一个基于nano banana pro🍌的原生AI PPT生成应用，支持想法/大纲/页面描述生成完整PPT演示文稿，<br></b>
<b> 自动提取附件图表、上传任意素材、口头提出修改，迈向真正的"Vibe PPT" </b>

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
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **软件开发最佳实践** | **DeepSeek-V3.2技术展示** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **预制菜智能产线装备研发和产业化** | **钱的演变：从贝壳到纸币的旅程** |

</div>

更多可见<a href="https://github.com/Anionex/banana-slides/issues/2" > 使用案例 </a>


## 🎯 功能介绍

### 1. 灵活多样的创作路径
支持**想法**、**大纲**、**页面描述**三种起步方式，满足不同创作习惯。
- **一句话生成**：输入一个主题，AI 自动生成结构清晰的大纲和逐页内容描述。
- **自然语言编辑**：支持以 Vibe 形式口头修改大纲或描述（如"把第三页改成案例分析"），AI 实时响应调整。
- **大纲/描述模式**：既可一键批量生成，也可手动调整细节。

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />


### 2. 强大的素材解析能力
- **多格式支持**：上传 PDF/Docx/MD/Txt 等文件，后台自动解析内容。
- **智能提取**：自动识别文本中的关键点、图片链接和图表信息，为生成提供丰富素材。
- **风格参考**：支持上传参考图片或模板，定制 PPT 风格。

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe" 式自然语言修改
不再受限于复杂的菜单按钮，直接通过**自然语言**下达修改指令。
- **局部重绘**：对不满意的区域进行口头式修改（如"把这个图换成饼图"）。
- **整页优化**：基于 nano banana pro🍌 生成高清、风格统一的页面。

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />


### 4. 开箱即用的格式导出
- **多格式支持**：一键导出标准 **PPTX** 或 **PDF** 文件。
- **完美适配**：默认 16:9 比例，排版无需二次调整，直接演示。

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. 可自由编辑的pptx导出（Beta迭代中）
- **导出图像为高还原度、背景干净的、可自由编辑图像和文字的PPT页面**
- 相关更新见 https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

<br>

**🌟和notebooklm slide deck功能对比**
| 功能 | notebooklm | 本项目 | 
| --- | --- | --- |
| 页数上限 | 15页 | **无限制** | 
| 二次编辑 | 不支持 | **框选编辑+口头编辑** |
| 素材添加 | 生成后无法添加 | **生成后自由添加** |
| 导出格式 | 仅支持导出为 PDF | **导出为PDF、(可编辑)pptx** |
| 水印 | 免费版有水印 | **无水印，自由增删元素** |

> 注：随着新功能添加,对比可能过时



## 🔥 近期更新
- 【2-9】：
  * 新功能
    * 支持在首页、大纲、描述卡片里面粘贴图片并立即识别，并提供更好的交互体验
    * 大纲章节手动编辑：支持手动调整页面所属章节（part）。
    * Docker 多架构：镜像支持 amd64 / arm64 构建。
    * 国际化 + 暗黑模式：新增中英文切换；支持亮色/暗色/跟随系统主题；全组件适配暗黑模式。
  * 修复与体验优化
    * 修复导出相关 500、参考文件关联时序、outline/page 数据错位、任务轮询错误项目、描述生成无限轮询、图片预览内存泄漏、批量删除部分失败处理。
    * 优化格式示例提示、HTTP 错误提示文案、Modal 关闭体验、清理旧项目 localStorage、移除首次创建项目冗余提示。
    * 若干其他优化和修复
- 【1-4】 : v0.4.0发布：可编辑pptx导出全面升级：
  * 支持最大程度还原图片中文字的字号、颜色、加粗等样式；
  * 支持了识别表格中的文字内容；
  * 更精确的文字大小和文字位置还原逻辑
  * 优化导出工作流，大大减少了导出后背景图残留文字的现象；
  * 支持页面多选逻辑，灵活选择需要生成和导出的具体页面。
  * **详细效果和使用方法见 https://github.com/Anionex/banana-slides/issues/121**

- 【12-27】: 加入了对无图片模板模式的支持和较高质量的文字预设，现在可以通过纯文字描述的方式来控制ppt页面风格


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
| ✅ 已完成 | 初步支持可编辑版本pptx文件导出 |
| 🔄 进行中 | 支持多层次、精确抠图的可编辑pptx导出 |
| 🔄 进行中 | 网络搜索 |
| 🔄 进行中 | Agent 模式 |
| 🚍 部分 | 优化前端加载速度 |
| 🧭 规划中 | 在线播放功能 |
| 🧭 规划中 | 简单的动画和页面切换效果 |
| 🚍 部分 | 多语种支持 |
| 🏢商业版功能 | 用户系统 |

## 📦 使用方法

### 使用 Docker Compose🐳（推荐）
这是最简单的部署方式，可以一键启动前后端服务。

<details>
  <summary>📒Windows用户说明</summary>

如果你使用 Windows, 请先安装 Windows Docker Desktop，检查系统托盘中的 Docker 图标，确保 Docker 正在运行，然后使用相同的步骤操作。

> **提示**：如果遇到问题，确保在 Docker Desktop 设置中启用了 WSL 2 后端（推荐），并确保端口 3000 和 5000 未被占用。

</details>

0. **克隆代码仓库**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **配置环境变量**

创建 `.env` 文件（参考 `.env.example`）：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：
> **项目中大模型接口以AIHubMix平台格式为标准，推荐使用 [AIHubMix](https://aihubmix.com/?aff=17EC) 获取API密钥，减小迁移成本**<br>
> **友情提示：谷歌nano banana pro模型接口费用较高，请注意调用成本**
```env
# AI Provider格式配置 (gemini / openai / vertex)
AI_PROVIDER_FORMAT=gemini

# Gemini 格式配置（当 AI_PROVIDER_FORMAT=gemini 时使用）
GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
# 代理示例: https://aihubmix.com/gemini

# OpenAI 格式配置（当 AI_PROVIDER_FORMAT=openai 时使用）
OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
# 代理示例: https://aihubmix.com/v1

# Vertex AI 配置（AI_PROVIDER_FORMAT=vertex）
# 需要 GCP 项目和服务账户密钥
# VERTEX_PROJECT_ID=your-gcp-project-id
# VERTEX_LOCATION=global
# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm 格式配置（当 AI_PROVIDER_FORMAT=lazyllm 时使用）
# 选择文本生成和图片生成使用的厂商
TEXT_MODEL_SOURCE=deepseek        # 文本生成模型厂商
IMAGE_MODEL_SOURCE=doubao         # 图片编辑模型厂商
IMAGE_CAPTION_MODEL_SOURCE=qwen   # 图片描述模型厂商

# 各厂商 API Key（只需配置你要使用的厂商）
DOUBAO_API_KEY=your-doubao-api-key            # 火山引擎/豆包
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # 阿里云/通义千问
GLM_API_KEY=your-glm-api-key                  # 智谱 GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # 硅基流动
SENSENOVA_API_KEY=your-sensenova-api-key      # 商汤日日新
MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
...
```

**使用新版可编辑导出配置方法，获得更好的可编辑导出效果**: 需在[百度智能云平台](https://console.bce.baidu.com/iam/#/iam/apikey/list)（点击此处进入）中获取API KEY，填写在.env文件中的BAIDU_API_KEY字段（有充足的免费使用额度）。详见https://github.com/Anionex/banana-slides/issues/121 中的说明


<details>
  <summary>📒 Vertex AI 配置指南（适用于 GCP 用户）</summary>

Google Cloud Vertex AI 允许通过 GCP 服务账户调用 Gemini 模型，新用户可使用赠金额度。配置步骤：

1. 前往 [GCP Console](https://console.cloud.google.com/)，创建一个服务账户并下载 JSON 格式的密钥文件
2. 将密钥文件保存为项目根目录下的 `gcp-service-account.json`
3. 在 `.env` 中设置：
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. 如果使用 Docker 部署，还需要在 `docker-compose.yml` 中取消相关注释，将密钥文件挂载到容器内并设置 `GOOGLE_APPLICATION_CREDENTIALS` 环境变量。

> `gemini-3-*` 系列模型要求 `VERTEX_LOCATION=global`

</details>

2. **启动服务**

**⚡ 使用预构建镜像（推荐）**

项目在 Docker Hub 提供了构建好的前端和后端镜像（同步主分支最新版本），可以跳过本地构建步骤，实现快速部署：

```bash
# 使用预构建镜像启动（无需从头构建）
docker compose -f docker-compose.prod.yml up -d
```

镜像名称：
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

**从头构建镜像**

```bash
docker compose up -d
```


> [!TIP]
> 如遇网络问题，可在 `.env` 文件中取消镜像源配置的注释, 再重新运行启动命令：
> ```env
> # 在 .env 文件中取消以下注释即可使用国内镜像源
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```


3. **访问应用**

- 前端：http://localhost:3000
- 后端 API：http://localhost:5000

4. **查看日志**

```bash
# 查看后端日志（最后 200 行）
docker logs --tail 200 banana-slides-backend

# 实时查看后端日志（最后 100 行）
docker logs -f --tail 100 banana-slides-backend

# 查看前端日志（最后 100 行）
docker logs --tail 100 banana-slides-frontend
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

**注：感谢优秀开发者朋友 [@ShellMonster](https://github.com/ShellMonster/) 提供了[新人部署教程](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md)，专为没有任何服务器部署经验的新手设计，可[点击链接](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md)查看。**

### 从源码部署

#### 环境要求
- Python 3.10 或更高版本
- [uv](https://github.com/astral-sh/uv) - Python 包管理器
- Node.js 16+ 和 npm
- 有效的 Google Gemini API 密钥
- （可选）[LibreOffice](https://www.libreoffice.org/) - 使用「PPT 翻新」功能上传 PPTX 文件时需要，用于将 PPTX 转换为 PDF。**推荐先在本地将 PPTX 转为 PDF 后再上传**，原因：LibreOffice 在服务端渲染时可能因缺少字体（如微软雅黑、Calibri 等）导致排版错位，且无法完整还原部分特效。上传 PDF 文件则不需要 LibreOffice。Docker 用户如仍需在容器内支持 PPTX 上传，可执行：
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > 注意：此方式安装的 LibreOffice 在容器重建后会丢失，需重新安装。

#### 后端安装

0. **克隆代码仓库**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **安装 uv（如果尚未安装）**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. **安装依赖**

在项目根目录下运行：
```bash
uv sync
```

这将根据 `pyproject.toml` 自动安装所有依赖。

3. **配置环境变量**

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你的 API 密钥：
> **项目中大模型接口以AIHubMix平台格式为标准，推荐使用 [AIHubMix](https://aihubmix.com/?aff=17EC) 获取API密钥，减小迁移成本** 
```env
# AI Provider格式配置 (gemini / openai / vertex)
AI_PROVIDER_FORMAT=gemini

# Gemini 格式配置（当 AI_PROVIDER_FORMAT=gemini 时使用）
GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
# 代理示例: https://aihubmix.com/gemini

# OpenAI 格式配置（当 AI_PROVIDER_FORMAT=openai 时使用）
OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
# 代理示例: https://aihubmix.com/v1

# Vertex AI 配置（AI_PROVIDER_FORMAT=vertex）
# 需要 GCP 项目和服务账户密钥
# VERTEX_PROJECT_ID=your-gcp-project-id
# VERTEX_LOCATION=global
# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# 可修改此变量来控制后端服务端口
BACKEND_PORT=5000
...
```

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
> （可选）如果本地已有重要数据，升级前建议先备份数据库：  
> `cp backend/instance/database.db backend/instance/database.db.bak`

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

后端服务将在 `http://localhost:5000` 启动。

访问 `http://localhost:5000/health` 验证服务是否正常运行。

#### 启动前端开发服务器

```bash
cd frontend
npm run dev
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
│   │   ├── page_image_version.py # PageImageVersion模型（页面版本）
│   ├── services/               # 服务层
│   │   ├── ai_service.py       # AI生成服务（Gemini集成）
│   │   ├── file_service.py     # 文件管理服务
│   │   ├── file_parser_service.py # 文件解析服务
│   │   ├── export_service.py   # PPTX/PDF导出服务
│   │   ├── task_manager.py     # 异步任务管理
│   │   ├── prompts.py          # AI提示词模板
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
├── LICENSE                     # 许可证
└── README.md                   # 本文件
```

## 交流群
为了方便大家沟通互助，建此微信交流群.

欢迎提出新功能建议或反馈，本人也会~~佛系~~回答大家问题

<img width="312" alt="image" src="https://github.com/user-attachments/assets/3e0f9fd9-7613-46bc-a37b-17211d40f5fc" />










## **🔧 常见问题**

1. **生成页面文字有乱码，文字不清晰**
    - 可选择更高分辨率的输出（openai 格式可能不支持调高分辨率，建议使用gemini格式）。根据测试，生成页面前将 1k 分辨率调整至 2k 后，文字渲染质量会显著提升。
    - 请确保在页面描述中包含具体要渲染的文字内容。

2. **导出可编辑 ppt 效果不佳，如文字重叠、无样式等**
    - 90% 情况为 API 配置出现问题。可以参考 [issue 121](https://github.com/Anionex/banana-slides/issues/121) 中的排查与解决方案。

3. **支持免费层级的 Gemini API Key 吗？**
    - 免费层级只支持文本生成，不支持图片生成。

4. **生成内容时提示 503 错误或 Retry Error**
    - 可以根据 README 中的命令查看 Docker 后端日志，定位 503 问题的详细报错，一般是模型配置不正确导致。

5. **.env 中设置了 API Key 之后，为什么不生效？**
    - 运行时编辑 `.env` 后需要重启 Docker 容器以应用更改。
    - 如果曾在网页设置页中配置参数，会覆盖 `.env` 中的参数，可通过"还原默认设置"恢复为 `.env` 设置。


## 🤝 贡献指南

欢迎通过
[Issue](https://github.com/Anionex/banana-slides/issues)
和
[Pull Request](https://github.com/Anionex/banana-slides/pulls)
为本项目贡献力量！

## 📄 许可证

本项目采用 **GNU Affero General Public License v3.0（AGPL-3.0）** 开源，
可自由用于个人学习、研究、试验、教育或非营利科研活动等非商业用途；
<details> 
<summary> 详情 </summary>
需要商业许可证（Commercial License）（例如：希望闭源使用、私有化部署交付、将本项目集成进闭源产品，或在不公开对应源代码的前提下提供服务），请联系作者：anionex@qq.com
- 联系方式：anionex@qq.com
</details>



<h2>🚀 Sponsor / 赞助 </h2>
<br>
<div align="center">
<a href="https://aihubmix.com/?aff=17EC">
  <img src="./assets/logo_aihubmix.png" alt="AIHubMix" style="height:48px;">
</a>
<p>感谢AIHubMix对本项目的赞助</p>
</div>


<div align="center">

 <br>

<a href="https://api.chatfire.site/login?inviteCode=A15CD6A0"><img width="200" alt="image" src="https://github.com/user-attachments/assets/d6bd255f-ba2c-4ea3-bd90-fef292fc3397" />
</a>


<details>
  <summary>感谢<a href="https://api.chatfire.site/login?inviteCode=A15CD6A0">AI火宝</a>对本项目的赞助</summary>
  “聚合全球多模型API服务商。更低价格享受安全、稳定且72小时链接全球最新模型的服务。”
</details>


<a href="https://www.rainyun.com/anionex_">
 <img width="150" alt="image" src="https://github.com/user-attachments/assets/9c1ab6d5-2b67-42ad-b4c4-d1c172a0068a" />

</a>

感谢雨云为本项目赞助云服务器，支持项目开发部署~
 
</div>



## 致谢

- 项目贡献者们：

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): 新的理想型社区
  
## 赞赏

开源不易🙏如果本项目对你有价值，欢迎请开发者喝杯咖啡☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

感谢以下朋友对项目的无偿赞助支持：
> @雅俗共赏、@曹峥、@以年观日、@John、@胡yun星Ethan, @azazo1、@刘聪NLP、@🍟、@苍何、@万瑾、@biubiu、@law、@方源、@寒松Falcon
> 如对赞助列表有疑问，可<a href="mailto:anionex@qq.com">联系作者</a>
 
## 📈 项目统计

<a href="https://www.star-history.com/#Anionex/banana-slides&type=Timeline&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

 </picture>

</a>

<br>
