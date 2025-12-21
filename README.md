<div align="center">

**🍌 Vibe提案 · 打工人也能稳出好 PPT**

基于原项目 [Anionex/banana-slides](https://github.com/Anionex/banana-slides)，
在此基础上做了一版更贴合「设计打工人」日常改稿节奏的定制版。

</div>


## 0. 这版和原版有什么不一样？

这一版是站在原作者的优秀实现之上，更多从「实际做方案的设计打工人」视角，把交互和流程往下沉了一步，让你在真实项目里更好落地：

- **产品定位改名为「Vibe方案(打工人版)」**
  - 保留香蕉 🍌 IP，但把整体语境改成「方案设计」,聚焦打工人；

- **首页更「干脆」：只保留一句话英雄输入**
  - 去掉了原版首页的风格模板和预设模板展示；

- **强化结果页,变成真正的「工作台(传统 PPT 的感觉)」**
  - 左侧：可拖拽的页面列表，支持：
    - 点击切换；
    - 「上移 / 下移」按钮；
    - 直接拖动缩略图调整顺序（同时保持与大纲页、描述页一致）。

  - 中间：单页「大图 + 文本上下文」
    - 上面是当前 PPT 页的大图；
    - 下面是这页的「大纲」和「页面描述/提示词」，可以直接编辑并保存；
    - 新增了「根据大纲重新生成描述」，支持你在预览页临时加一页，只写大纲就生成整页文案。(更加方便改动)

  - 右侧：不再是弹窗，而是固定的「高级编辑侧栏」
    - 区域选图（框选大图一块区域，自动裁成参考图加入上传列表）；
    - 修改指令输入框 + 「重新生成」/「根据指令生成」按钮。

  - **直接替换当前页图片（不走 AI）**
    - 点击大图，或在占位状态时点「上传本地图片作为此页」；
      
- **模板体验：更偏「资产管理」,强调单页匹配**
  - 预设模板图片增加了名称展示，并支持搜索；
  - 你的模板与预设模板放在同一个选择器里，但首页不再强迫你提前选；
  - 样例模板/封面图都可以在 `frontend/public/templates` 下直接扩展。

- **打工人友好的文本流**
  - 每页底部的大纲与描述区域，都明确提示「保存页面大纲」「保存页面描述」；
  - 描述区域下加了「根据大纲重新生成描述」，方便临时加页、重构某一页；
  - 整体是「先内容后视觉」，更贴近真实提案落地流程。


## 1. 示例 PPT（天津滨江项目 · 调整后版本）

仓库里自带了一份完整示例，方便给大家看到直观的效果：

实际导出的 14 页预览如下（来自 `example/` 目录，相对路径可直接在本仓库中打开）：

<div align="center">

| | |
|:---:|:---:|
| <img src="example/调整后 PDF_01.png" width="480" alt="示例第1页"> | <img src="example/调整后 PDF_02.png" width="480" alt="示例第2页"> |
| 第 1 页 | 第 2 页 |
| <img src="example/调整后 PDF_03.png" width="480" alt="示例第3页"> | <img src="example/调整后 PDF_04.png" width="480" alt="示例第4页"> |
| 第 3 页 | 第 4 页 |
| <img src="example/调整后 PDF_05.png" width="480" alt="示例第5页"> | <img src="example/调整后 PDF_06.png" width="480" alt="示例第6页"> |
| 第 5 页 | 第 6 页 |
| <img src="example/调整后 PDF_07.png" width="480" alt="示例第7页"> | <img src="example/调整后 PDF_08.png" width="480" alt="示例第8页"> |
| 第 7 页 | 第 8 页 |
| <img src="example/调整后 PDF_09.png" width="480" alt="示例第9页"> | <img src="example/调整后 PDF_10.png" width="480" alt="示例第10页"> |
| 第 9 页 | 第 10 页 |
| <img src="example/调整后 PDF_11.png" width="480" alt="示例第11页"> | <img src="example/调整后 PDF_12.png" width="480" alt="示例第12页"> |
| 第 11 页 | 第 12 页 |
| <img src="example/调整后 PDF_13.png" width="480" alt="示例第13页"> | <img src="example/调整后 PDF_14.png" width="480" alt="示例第14页"> |
| 第 13 页 | 第 14 页 |

</div>


## 2. 基本功能概览（保留原版核心能力）

在原作者的基础上，这一版完全保留了 banana-slides 的核心能力：

- **三种起步方式**
  - 一句话 Idea：直接从主题生成完整大纲 + 每页描述；
  - 直接贴大纲：用你自己的结构文本，解析成多页；
  - 直接贴页面描述：从已有文案反推结构。

- **多源素材理解**
  - 支持上传 PDF / DOCX / Markdown / TXT；
  - 自动抽取文本、图片、图表信息作为生成依据；
  - 模板图片 / 参考图可以参与图片生成。

- **自然语言修改**
  - 编辑大纲页时，用一句话描述需要的结构改动；
  - 编辑页面描述时，用一句话描述你想补充/删改的点；
  - 结果页，用一句话描述图像修改：如「把右侧图片换成夜景、整体风格更 Cyber」。

- **导出**
  - 一键导出 PPTX；
  - 一键导出 PDF（示例就来自这里）。


## 3. 打工人视角的使用流程

从零开始到能交付的一份提案，大致是这样一条链路：

1. **首页 · 说清楚你要做的事**
   - 在首页输入「项目背景 / 需求 / 目标」，比如：
     - 「天津滨江商业街区更新方案，面向甲方汇报」；
   - 选择「一句话生成 PPT」即可进入大纲页。

2. **大纲页 · 把内容结构理顺**
   - 逐页查看 AI 给的初稿大纲；
   - 不满意的页，用自然语言直接修改：
     - 「在第二部分前面插入一页讲历史沿革」
     - 「把第四页拆成两页，分别讲客群和场景」
   - 确认 OK 后点击进入「编辑页面描述」。

3. **页面描述页 · 让每一页话术成型**
   - 每个卡片里是一个页面的标题 + 文案 + 其他提示；
   - 你可以直接改词、补充要点，再点「重新生成」让 AI 重新组织；
   - 当所有页面都「生成描述」完成后，跳转到预览页。

4. **预览页 · 真正的「做方案工作台」**
   - 左侧：拖拽调整顺序 / 新增页面 / 删除页面；
   - 中间：
     - 上面看图（可直接点图上传替换）；
     - 下面改文字（大纲 + 描述），必要时「根据大纲重新生成描述」；
     - 新需求随时增页
   - 右侧：
     - 区域选图截取局部做参考修改；
     - 也可以上传现场照片 / 招商素材 / 场景图；
     - 填写修改指令，用「根据指令生成」做细调。

5. **最后导出 PPTX / PDF**
   - 导出后你可以在WPS 里转成 PPT,这样就可以调整文字了；


## 4. 快速上手部署

本仓库仍沿用原项目的技术架构和部署方式，只在前端做了交互层改造，后端接口兼容原版文档。下面是最简部署路径。

### 4.1 Docker Compose（一键启动，推荐）

0）克隆仓库：
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1）复制环境变量：
```bash
cp .env.example .env
```

2）填写 `.env` 中的模型相关配置（可用 Gemini / OpenAI / 代理等，参考原项目说明）。
需要 API 的也可以联系作者:Jo8888s

3）启动：
```bash
docker compose up -d
```

4）访问：
- 前端：http://localhost:3000
- 后端：http://localhost:5000

5）停止：
```bash
docker compose down
```


### 4.2 从源码运行（前后端分离开发）

#### 后端

```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides

cp .env.example .env   # 配好模型 key

uv sync                # 安装后端依赖

cd backend
uv run alembic upgrade head
uv run python app.py   # 默认 5000 端口
```

#### 前端

```bash
cd frontend
npm install
npm run dev   # 默认 http://localhost:3000
```

如需修改后端地址，可在 `frontend/src/api/client.ts` 中调整。


## 5. 技术栈概览

和原项目保持一致：

- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + @dnd-kit
- 后端：Flask 3 + SQLite + SQLAlchemy + uv
- AI：通过 Gemini / OpenAI 兼容格式调用大模型
- PPT：`python-pptx`，图片生成由 banana 模型负责


## 6. 项目结构（保持与原版一致）
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

编辑 `.env` 文件，配置你的 API 密钥：
> **项目中大模型接口以AIHubMix平台格式为标准，推荐使用 [AIHubMix](https://aihubmix.com/?aff=17EC) 获取API密钥，减小迁移成本** 
```env
# AI Provider格式配置 (gemini / openai)
AI_PROVIDER_FORMAT=gemini

# Gemini 格式配置（当 AI_PROVIDER_FORMAT=gemini时使用）
GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
# 代理示例: https://aihubmix.com/gemini

# OpenAI 格式配置（当 AI_PROVIDER_FORMAT=openai 时使用）
OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
# 代理示例: https://aihubmix.com/v1
PORT=5000
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


## 7. 许可证与原项目

- 本项目基于 [Anionex/banana-slides](https://github.com/Anionex/banana-slides) 进行二次开发；
- 原项目采用 **CC BY-NC-SA 4.0** 协议，仅限非商业使用；
- 本仓库沿用相同协议，任何商业使用需要单独获得授权。

如果你也是打工人、也在做提案，欢迎基于这版继续改——
可以按你的行业（地产、品牌、公关、咨询…）做一套更贴合自己团队的版本。
