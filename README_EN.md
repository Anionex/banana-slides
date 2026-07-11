[//]: # "Banana Slides is an AI-native PPT generation app for creating editable presentations from ideas, outlines, documents, images, and custom templates. Features: prompt-to-slide generation, template control, material parsing, conversational editing, PPTX export, project history, and reproducible workflows. Quick Start / Install / Usage / Demo / API / Deploy / Architecture / Test / Screenshot guides are provided for local Docker deployment and online use."
<div align="center">

<p>
  <img src="https://github.com/user-attachments/assets/81fe6816-44cc-4c61-97c7-f3c099650966" alt="Banana Slides" width="860">
</p>
<p>
  <a href="https://trendshift.io/repositories/22056" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/22056" alt="Anionex%2Fbanana-slides | Trendshift" width="265" height="58">
  </a>
  <br>
  <a href="https://hellogithub.com/repository/Anionex/banana-slides" target="_blank">
    <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&claim_uid=CtDTm2jbUHhVGBr&theme=neutral" alt="Featured｜HelloGitHub" width="265" height="58">
  </a>
</p>
<p>
  <a href="#-项目缘起"><b>Simplified Chinese</b></a>
  &nbsp;•&nbsp;
  <a href="README_EN.md"><b>English</b></a>
</p>
<p>
  <a href="https://github.com/Anionex/banana-slides/stargazers"><img src="https://img.shields.io/github/stars/Anionex/banana-slides?style=flat-square&color=FFD700" alt="GitHub Stars"></a>
  <a href="https://github.com/Anionex/banana-slides/network"><img src="https://img.shields.io/github/forks/Anionex/banana-slides?style=flat-square&color=FFD700" alt="GitHub Forks"></a>
  <a href="https://github.com/Anionex/banana-slides/watchers"><img src="https://img.shields.io/github/watchers/Anionex/banana-slides?style=flat-square&color=FFD700" alt="GitHub Watchers"></a>
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2"><img src="https://img.shields.io/badge/version-v0.9.0--rc.2-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes without tedious formatting. Request changes via conversation and move towards true "Vibe PPT".</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2"><b>💻 Desktop RC2</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment Guide</b></a>
</p>
<p>
  If this project is helpful to you, please <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## 🔥 Latest News

- **[2026-07-11]**: Release Candidate 2 for version 0.9.0 is out. It includes everything in RC1 and fixes the Windows desktop MinerU directory mismatch for editable PPTX export and the FFprobe path error in explainer video export; [Download and Install Now](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Page-by-page templates are live — Support for single/multiple template modes. Upload images or PDFs to build your project template library. AI automatically analyzes template styles and provides one-click smart matching for each page, or you can manually bind them page by page. Seamlessly switch between the two modes at any time ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox is live — Added three new modes: full-image editing, selection editing (overlay/replace), and smart erase, built upon existing asset generation. Unified entry for one-stop operations.
- **[2026-04-25]**: Support for account linking via official OpenAI OAuth. Once linked, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2k images in five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, non-reverse engineered)
- **[2026-04-25]**: Support for saving custom text style description templates. Can be named, color-coded, and reused persistently without re-entering every time.
- **[2026-04-23]**: Support for gpt-image-2 model. Exportable editable background effects have also been improved due to enhanced model capabilities (Select "Generative Acquisition" in Settings - Export Options - Background Acquisition)
- **[2026-04-11]**: Support for [CLI operations and added agent skills](https://docs.bananaslides.online/cli)
- **[2026-03]**: Added several features and optimizations, such as extra fields, multiple aspect ratio settings, etc.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Support for pasting and immediate recognition of images in the homepage, outline, and description cards, with an improved interactive experience.
    * Manual editing of outline chapters: Support for manually adjusting the section (part) a page belongs to.
    * Docker Multi-arch: Image support for amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese/English switching; support for Light/Dark/System themes; all components adapted for Dark Mode.
  * Fixes and Experience Optimizations
    * Fixed export-related 500 errors, reference file correlation timing, outline/page data misalignment, task polling errors for specific projects, infinite polling for description generation, image preview memory leaks, and partial failure handling for batch deletions.
    * Optimized format example prompts, HTTP error message copy, Modal closing experience, cleaning of old project localStorage, and removed redundant prompts for first-time project creation.
    * Several other optimizations and fixes.

## ✨ Project Origin

Have you ever found yourself in this dilemma: a presentation due tomorrow, but the PPT is still a blank slate; countless brilliant ideas in your head, but your enthusiasm is drained by tedious layout and design?

We long to quickly create professional and aesthetically pleasing presentations. While traditional AI PPT generation apps generally meet the need for "speed," they still suffer from the following issues:

- 1️⃣ Limited to preset templates, unable to flexibly adjust styles
- 2️⃣ Low degree of freedom, making iterative changes difficult 
- 3️⃣ Similar-looking outputs with severe homogenization
- 4️⃣ Low-quality assets that lack relevance
- 5️⃣ Disjointed text-image layouts with poor design aesthetics

These flaws make it difficult for traditional AI PPT generators to satisfy our dual demands for both "speed" and "beauty." Even those claiming to be "Vibe PPT" are, in my view, far from being "Vibe" enough.

However, the emergence of the nano banana 🍌 model has changed everything. I experimented with 🍌 pro for PPT page generation and found that the quality, aesthetics, and consistency of the results were exceptional. It can accurately render almost all text requested in the prompts while strictly following the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌 pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Quickly generate beautiful PPTs with zero barrier and no design experience, reducing the hassle of selecting templates.
2. **PPT Professionals**: Reference AI-generated layouts and graphic-text combinations to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments and focus energy on content rather than formatting and aesthetics.
5. **Professionals**: Quickly visualize business proposals and product introductions with rapid adaptation to various scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly create beautiful and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Meals** | **The Evolution of Money: A Journey from Shells to Banknotes** |

</div>

More available at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to suit different creative habits.
- **One-sentence generation**: Enter a topic, and the AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural language editing**: Supports modifying the outline or description via "Vibe" style natural language commands (e.g., "Change the third page to a case study"), with real-time AI response and adjustment.
- **Outline/Description mode**: Supports both one-click batch generation and manual adjustment of details.
- **Reliable Markdown Import**: The import dialog previews the number of recognizable pages before execution and appends pages sequentially based on the file order, avoiding formatting errors or uncertain sequencing after multi-page imports.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capability

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other files for automatic backend content parsing.
- **Intelligent Extraction**: Automatically identifies key points, image links, and chart information from the text, providing rich source material for generation.
- **Automatic Image Storage**: Images extracted from documents are automatically added to the project asset library once the reference files are associated with the project, allowing for direct reuse later.
- **Style Reference**: Supports uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="File Parsing and Asset Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe" Style Natural Language Modification

No longer limited by complex menus; issue modification commands directly using **natural language**.
- **Inpainting**: Make verbal-style modifications to specific areas (e.g., "change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition pages with a unified style based on nano banana pro🍌.
- **Quality Control Mode**: Can be enabled in system settings or on the preview page. After generation, it automatically checks for garbled text, low-quality visuals, and prompt deviation; only images that pass the check are saved as new versions.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transitions before exporting PPTX. Supports classic effects such as Fade, Push, Pan, Wipe, Split, Blinds, Checkerboard, and Clock, with the option to select multiple for random application.
- **Export File Management**: The preview page lists files already exported on the server, allowing you to directly download or delete unnecessary files. Export task history is isolated by project to avoid accidental deletion of other project records. If a backend task becomes unavailable after refreshing, the task panel will clearly display a failure and prompt for a re-export.
- **Clearer Selective Page Export**: The selective page export now indicates missing image status based on the current selection range. Unselected draft pages will not cause the export entry for completed pages to be grayed out. Explainer videos will only include pages without visuals if the placeholder frame option is explicitly checked.
- **Perfect Adaptation**: Default 16:9 aspect ratio. No secondary layout adjustments required; ready for direct presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully Editable PPTX Export (Beta)

- **Export images to high-fidelity PPT pages with clean backgrounds and freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export Explanatory Video

- **One-click conversion of slides into presentation videos (MP4) with AI voiceover and subtitles**
- AI automatically generates colloquial narrations based on page descriptions and content
- Supports multiple expression styles, languages, and voice personas

<br>

**🌟 Feature Comparison with NotebookLM Slide Deck**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **No limit** | 
| Secondary Editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Freely add after generation** |
| Export Format | Supports PDF, (non-editable image) PPTX | **Export as PDF, (Image or editable) PPTX, Presentation video** |
| Watermark | Watermark on free version | **No watermark, freely add/delete elements** |

> Note: Comparisons may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestones |
| --- | --- |
| ✅ Completed | Create PPTs via three paths: Idea, Outline, and Page Description |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to single PPT slides |
| ✅ Completed | Area selection "Vibe" voice editing for single slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support for uploading and parsing multiple file types |
| ✅ Completed | Support for adjusting outlines and descriptions via "Vibe" voice commands |
| ✅ Completed | Initial support for exporting editable .pptx files |
| 🔄 In Progress | Support for exporting editable .pptx with multi-layering and precise background removal |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narration video export (Multi-voice in Chinese/English/Japanese, subtitles) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 Planned | Online playback feature |
| 🧭 Planned | Simple animations and slide transition effects |
| 🚍 Partial | Multi-language support |
| | |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest way, with no need to install Docker or download the project. You can access the application directly after creation.

1. One-click deploy and start this application via Rainyun (High bandwidth, suitable for HD image generation and downloading. Free trials available for new users)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Stay tuned

### Using Docker Compose 🐳

Quickly start front-end and back-end services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first, and ensure Docker is running (Windows users check the system tray icon; macOS users check the menu bar icon), then follow the same steps as in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also ensure that ports **3011** and **5011** are not occupied.

</details>

0. **Clone the repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Configure environment variables**

Create a `.env` file (refer to `.env.example`):
```bash
cp .env.example .env
```

**(Optional, you can also configure it in the user interface after starting, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM interface in this project follows the AIHubMix platform format standards. It is recommended to use [AIHubMix (click here to visit)](https://aihubmix.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly Reminder: The interface costs for Google nano banana pro models are high, please be mindful of the invocation costs.**
```env

# AI Provider Format Configuration (gemini / openai / volcengine / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://aihubmix.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://aihubmix.com/v1

# Volcengine Ark AgentPlans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/v3

# Vertex AI Configuration (AI_PROVIDER_FORMAT=vertex)

# Requires GCP Project and Service Account Key

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Choose Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Vendor API Keys (Only configure the ones you want to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine/Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud/Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseNova (SenseTime)
MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
...
```

> Banana Slides explicitly packages the LazyLLM online provider SDKs used by domestic vendors:
> `volcengine-python-sdk[ark]` for Doubao, `dashscope` for Qwen/Wanxiang, and `zhipuai` for GLM/Zhipu.
> LazyLLM also exposes `lazyllm install online-advanced`, but the PyPI wheel may not publish that group as a standard install extra, so Docker/prebuilt images rely on these explicit dependencies instead.
  
</details>


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is a sufficient free quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via GCP service accounts, and new users can use free credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account and download the JSON key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant sections in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> `gemini-3-*` series models require `VERTEX_LOCATION=global`

</details>

2. **Start Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch). You can skip the local build steps to achieve fast deployment:

```bash

# Launch with Pre-built Images (No Need to Build from Scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can navigate to **Settings → About → Check for Updates** within the application. The app will determine if there are available updates based on the current version SHA; the current Git SHA is also used for this check when running from source code.

**Build images from scratch**

```bash
docker compose up -d
```

> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then re-run the startup command:
> ```env
> # Uncomment the following in the .env file to use domestic mirror sources
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```

3. **Access the Application**

- Frontend: http://localhost:3011
- Backend API: http://localhost:5011

4. **View Logs**

```bash
```

# View Backend Logs (Last 200 Lines)

docker logs --tail 200 banana-slides-backend

# View Backend Logs in Real-time (Last 100 Lines)

docker logs -f --tail 100 banana-slides-backend

# View Frontend Logs (Last 100 Lines)

docker logs --tail 100 banana-slides-frontend
```

5. **Stop Services**

```bash
docker compose down
```

6. **Update Project**

**Using Pre-built Images (docker-compose.prod.yml)**

Alternatively, you can go to **Settings → About → Check for Updates** within the application to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable. You must first revert the code to the version as it was when pulled.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). Specifically designed for beginners without any server deployment experience, you can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos, and must include support for `libass` / `ass` subtitle filters
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Renovation" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: Server-side rendering via LibreOffice may cause layout issues due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully reproduce some special effects. LibreOffice is not required if you upload PDF files directly. Docker users who still need PPTX upload support within the container can execute:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost after the container is rebuilt and will need to be reinstalled.

#### Backend Installation

0. **Clone the repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Install uv (if not already installed)**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. **Install dependencies**

Run the following in the project root directory:
```bash
uv sync
```

# macOS (Homebrew)

```bash
brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full
```

# Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg libass9
```

# Then Install Python Dependencies

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, following the method mentioned above, open and edit the `.env` file to configure your API key

Please provide the Chinese Markdown content you would like me to translate. I am ready to follow all your requirements, including keeping the formatting, HTML tags, and URLs unchanged.

#### Frontend Installation

1. **Navigate to the frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure API address**

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`) via Vite proxy. If you need to modify it, please set `BACKEND_PORT` in the `.env` file at the project root.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all stored in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify that the service is running correctly.

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser and visit the URL to use the application.

## 🛠️ Technical Architecture

### Frontend Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Community Group

Suggestions for new features or feedback are welcome, and I will answer your questions in a ~~laid-back~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/675f9129-d4f5-462b-a253-4665778cd5a7" />

Welcome to follow the author's social media, where I share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.xiaohongshu.com/user/profile/62e8f580000000001902fc9d"><img src="https://img.shields.io/badge/小红书-Anion-FF2442?style=flat-square&logo=xiaohongshu&logoColor=white" alt="小红书"></a>
  <a href="https://space.bilibili.com/477162339"><img src="https://img.shields.io/badge/Bilibili-Anion-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Bilibili"></a>
</p>

## **🔧 Frequently Asked Questions**

Refer to the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project through
[Issue](https://github.com/Anionex/banana-slides/issues)
and
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. It can be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research activities;

If you have any questions or cooperation intentions, please contact: davidyang042@gmail.com



<h2>🚀 Sponsor </h2>
<br>
<div align="center">
<a href="https://aihubmix.com/?aff=17EC">
  <img src="./assets/logo_aihubmix.png" alt="AIHubMix" style="height:48px;">
</a>
<p>Thanks to AIHubMix for sponsoring this project</p>
</div>


<div align="center">
<a href="中文链接">
    <img src="./assets/huoshan.png" alt="Volcengine" width="150"/ >
    <p>Thanks to <strong>Volcengine</strong> for sponsoring this project<br>
      Ark Agent Plan limited-time 75% off subscription, <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">click the link to buy now</a></p>
</a>
</div>

<!-- Note: Use this version for the English README: -->
<!--
<div align="center">
<a href="英文链接">
    <img src="./assets/byteplus.png" alt="BytePlus" width="150"/ >
    <p> Thanks to Dola seed for sponsoring this project! Register via <a href="https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=banana-slides&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">this link</a> to get 500,000 tokens of free inference quota per model. </p>
</a>
</div>
-->


<div align="center">

 <br>

<a href="https://api.chatfire.site/login?inviteCode=A15CD6A0"><img width="200" alt="image" src="https://github.com/user-attachments/assets/d6bd255f-ba2c-4ea3-bd90-fef292fc3397" />
</a>

Thanks to AI Fire for sponsoring this project
 
</div>

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsorship

Maintaining open source is not easy 🙏 If you find this project valuable, you are welcome to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their generous sponsorship and support of the project:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon, @刘星宇&小陀螺AIGC
> If you have any questions regarding the sponsorship list, please <a href="mailto:davidyang042@gmail.com">contact the author</a>

## 📈 Project Statistics

<a href="https://www.star-history.com/#Anionex/banana-slides&type=Timeline&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

 </picture>

</a>

<br>
