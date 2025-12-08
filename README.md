<div align="center">

<img width="256" src="https://github.com/user-attachments/assets/6f9e4cf9-912d-4faa-9d37-54fb676f547e">

*Vibe your PPT like vibing code.*

<p>

[![Version](https://img.shields.io/badge/version-v0.1.0-4CAF50.svg)](#)
![Docker](https://img.shields.io/badge/Docker-Build-2496ED?logo=docker&logoColor=white)
[![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
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
| ✅ 已完成 | PPT 单页框选区域进行编辑 |
| ✅ 已完成 | 素材模块: 素材生成、上传等 |
| ✅ 已完成 | 支持多种文件的上传+解析 |
| 🔄 进行中 | 支持Vibe调整大纲和描述 |
| 🔄 进行中 | 支持已生成图片的元素分割和进一步编辑（segment + inpaint） |
| 🔄 进行中 | 网络搜索 |
| 🔄 进行中 | Agent 模式 |
| 🧭 规划中 | 优化前端加载速度 |
| 🧭 规划中 | 在线播放功能 |
| 🧭 规划中 | 简单的动画和页面切换效果 |
| ✅ 已完成 | 多语种支持 |
| ✅ 已完成 | 暗黑/明亮模式切换 |
| 🔄 进行中 | 用户系统 |


## 🎯 功能介绍

### Banana-slides🍌 (aka. MaynorAI) 的亮点

- 🚀 **一句话生成 PPT**：从一个简单的想法快速得到大纲、页面描述和最终的 PPT 文稿
- 🔄 **三种生成路径**：支持从「想法 / 大纲 / 页面描述」三种方式起步，适配不同创作习惯
- 🔍 **文本与链接自动提取**：支持从一段文本中自动抽取要点、图片链接等信息
- 🔗 **文件上传自动解析**: 支持导入docx/pdf/md/txt等格式的文件，后台自动解析，为图片内容生成描述，为后续生成提供素材。
- 🧾 **上传任意素材**：可上传参考图片、示例 PPT图（后续支持ppt文件） 等作为风格和内容参考
- 🧙‍♀️ **AI 辅助编排**：由 LLM 生成结构清晰的大纲和逐页内容描述
- 🖼️ **高质量页面生成**：基于 nano banana pro🍌 生成高清、风格统一的页面设计
- 🗣️ **自然语言修改**：支持对单页、单页局部（已支持）或整套（未来支持）PPT 进行「口头」式自然语言修改与重生成
- 🌍 **多语种支持**：支持中英文界面切换，AI 生成内容语言自适应
- 🌓 **暗黑/明亮模式**：支持亮色/暗色主题切换，自动跟随系统设置
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

### 6. 多语种支持 🌍

- **界面语言切换**：支持中英文界面实时切换，无需刷新页面
- **智能语言检测**：自动根据用户浏览器语言偏好设置初始语言
- **AI 内容语言控制**：根据用户界面语言自动生成对应语言的 PPT 内容

### 7. 暗黑/明亮模式 🌓

- **主题切换**：支持明亮模式、暗黑模式和跟随系统三种主题设置
- **智能适配**：暗色模式下所有 UI 元素自动适配，提供舒适的视觉体验
- **持久化存储**：主题偏好自动保存到本地，下次访问时自动应用
- **平滑过渡**：主题切换时采用流畅的过渡动画，提升用户体验


## 🌐 API配置说明

### 🚀 推荐使用中转API（前端配置）

**本项目采用前端配置优先的设计，无需修改后端环境变量，直接在前端界面配置即可！**

🔗 **推荐中转API**: https://apipro.maynor1024.live/

#### ⚡ 快速配置（3步完成）

1. **访问前端页面**：打开应用后，点击右上角的 "⚙️ 设置" 按钮
2. **选择预设**：在弹出的配置窗口中，选择 "🚀 中转API（推荐）" 预设
3. **输入密钥**：填入你的 API Key（格式：`sk-xxx`），点击保存

✨ **配置完成！** 系统会自动使用中转API进行文本生成和图片生成。

#### 📋 可选配置方式

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 文本API Base | `https://apipro.maynor1024.live` | 用于大纲和页面描述生成 |
| 图片API Base | `https://apipro.maynor1024.live` | 用于PPT页面图片生成 |
| API Key | `sk-xxx` | 统一使用同一个Key |

> **💡 为什么推荐中转API？**
> - ✅ 解决网络访问限制问题
> - ✅ 提升生成速度和稳定性
> - ✅ 统一的API Key管理
> - ✅ 无需修改后端配置

#### 🔧 高级配置（可选）

如果你需要使用其他API或自定义配置，也可以在前端设置中选择：
- **官方 Google API**：直连Google官方接口
- **混合模式**：文本使用官方API，图片使用中转API
- **自定义配置**：手动输入任意API地址

---

## 📦 使用方法

### 🌟 云端部署（推荐用于生产环境）

**前端（Vercel） + 后端（Render）免费部署**

- ✅ 完全免费
- ✅ 一键部署
- ✅ 自动HTTPS
- ✅ 全球CDN加速

**📚 [查看详细部署教程](./docs/DEPLOYMENT.md)**

**快速开始**：
1. Fork本项目到你的GitHub
2. 在Render部署后端（5分钟）
3. 在Vercel部署前端（3分钟）
4. 完成！🎉

---

### 使用 Docker Compose🐳（推荐用于本地开发）
这是最简单的本地部署方式，可以一键启动前后端服务。

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

编辑 `.env` 文件，配置必要的环境变量（推荐使用中转API）：
```env
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_API_BASE=https://apipro.maynor1024.live/v1beta
...
```

2. **启动服务**

```bash
docker compose up -d
```

3. **访问应用**

- 前端：http://localhost:3000
- 后端 API：http://localhost:5000


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

编辑 `.env` 文件，配置你的 API 密钥（推荐使用中转API）：
```env
GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://apipro.maynor1024.live/v1beta
PORT=5000
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

```bash
cd backend
uv run python app.py
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
- **国际化**：react-i18next (支持多语种)
- **拖拽功能**：@dnd-kit
- **图标**：Lucide React
- **HTTP客户端**：Axios

### 后端技术栈
- **语言**：Python 3.10+
- **框架**：Flask 3.0
- **包管理**：uv
- **数据库**：SQLite + Flask-SQLAlchemy
- **国际化**：Flask-Babel (支持多语种)
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
│   │   │   │   └── LanguageSwitcher.tsx    # 语言切换组件
│   │   │   └── ...
│   │   ├── layout/         # 布局组件
│   │   └── history/        # 历史版本组件
│   │   ├── store/              # Zustand状态管理
│   │   │   └── useProjectStore.ts
│   │   ├── i18n/               # 国际化配置
│   │   │   ├── config.ts       # i18n 配置
│   │   │   └── locales/        # 语言包文件
│   │   ├── api/                # API接口
│   │   │   ├── client.ts       # Axios客户端配置
│   │   │   ├── endpoints.ts    # API端点定义
│   │   │   └── i18n.ts         # 语言API客户端
│   │   ├── types/              # TypeScript类型定义
│   │   ├── utils/              # 工具函数
│   │   ├── constants/          # 常量定义
│   │   └── styles/             # 样式文件
│   ├── public/                 # 静态资源
│   │   └── locales/            # HTTP 加载的语言包
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
│   │   ├── i18n_controller.py         # 国际化语言管理
│   │   └── file_controller.py         # 文件上传
│   ├── utils/                  # 工具函数
│   │   ├── response.py         # 统一响应格式（支持国际化）
│   │   ├── i18n.py             # 国际化工具函数
│   │   ├── validators.py       # 数据验证
│   │   └── path_utils.py       # 路径处理
│   ├── translations/           # 翻译文件（Flask-Babel）
│   │   ├── zh/LC_MESSAGES/     # 中文翻译
│   │   └── en/LC_MESSAGES/     # 英文翻译
│   ├── instance/               # SQLite数据库（自动生��）
│   ├── exports/                # 导出文件目录
│   ├── Dockerfile
│   └── README.md
│
├── tests/                      # 测试文件目录
├── v0_demo/                    # 早期演示版本
├── output/                     # 输出文件目录
│
├── I18N_TEST_SUMMARY.md        # 多语种功能实现总结
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

### 多语种贡献 🌍

如果您想为项目贡献新的语言支持：

1. **前端语言包**：
   - 复制 `frontend/src/i18n/locales/zh-CN.json` 为新语言文件
   - 翻译所有文本内容
   - 在 `frontend/src/i18n/config.ts` 中添加新语言支持

2. **后端翻译**：
   ```bash
   cd backend
   # 提取新的翻译字符串
   python extract_messages.py

   # 初始化新语言（例如日语）
   pybabel init -i messages.pot -d translations -l ja

   # 编辑翻译文件后编译
   pybabel compile -d translations
   ```

3. **更新语言切换组件**：
   - 在 `frontend/src/components/LanguageSwitcher.tsx` 中添加新语言选项
   - 在后端 `controllers/i18n_controller.py` 中添加语言支持

详细的多语种开发指南请参考 `I18N_TEST_SUMMARY.md`。

## 📄 开源协议

### 个人使用 - CC BY-NC-SA 4.0

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议进行开源

**你可以自由地：**

- ✅ **个人使用** - 用于学习、研究、个人项目
- ✅ **分享** - 在任何媒介以任何形式复制、发行本作品
- ✅ **修改** - 修改、转换或以本作品为基础进行创作

**但需要遵守以下条款：**

- 📝 **署名** - 必须给出适当的署名，提供指向本协议的链接，同时标明是否对原始作品作了修改
- 🚫 **非商业性使用** - 不得将本作品用于商业目的
- 🔄 **相同方式共享** - 如果你修改、转换或以本作品为基础进行创作，你必须以相同的协议分发你的作品

### 商业授权

如果你希望将本项目用于**商业目的**（包括但不限于）：

- 提供付费服务
- 集成到商业产品
- 作为 SaaS 服务运营
- 其他盈利性用途

**请联系作者获取商业授权：**

💬 微信: coder-maynor（请注明"商业授权咨询"）

客服会根据你的具体使用场景提供灵活的商业授权方案。

### 免责声明

本软件按"原样"提供，不提供任何形式的明示或暗示担保，包括但不限于适销性、特定用途的适用性和非侵权性的担保。在任何情况下，作者或版权持有人均不对任何索赔、损害或其他责任负责。

## 🙏 致谢

特别感谢 [Anionex](https://github.com/Anionex) 开发的原版 [banana-slides](https://github.com/Anionex/banana-slides) 项目！

本项目基于原作者的出色工作进行优化和改进，为用户提供更便捷的部署和使用体验。

## 📈 项目统计

<a href="https://www.star-history.com/#Anionex/banana-slides&type=date&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=date&legend=top-left" />

 </picture>

</a>

<br>


