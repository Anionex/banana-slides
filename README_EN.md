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
  <a href="https://github.com/Anionex/banana-slides"><img src="https://img.shields.io/badge/version-v0.4.0-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious formatting, just natural language edits. Step into the era of "Vibe PPT".</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If you find this project helpful, please <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## 🔥 Latest Updates

- **[2026-04-25]**: Asset Toolbox launched — added three new modes on top of existing asset generation: full-image editing, selection editing (overlay/replace), and smart erase, providing a unified entry point for one-stop operations.
- **[2026-04-25]**: Support for account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, non-reverse engineered).
- **[2026-04-25]**: Support for saving custom text style description templates, which can be named, color-coded, and persistently reused, eliminating the need for repetitive input.
- **[2026-04-23]**: Added support for the gpt-image-2 model. The quality of exportable editable background effects has also been improved due to model capability upgrades (Select **Generative Acquisition** in **Settings - Export Options - Background Acquisition**).
- **[2026-04-11]**: Support for [CLI operations and added agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as additional fields and multi-aspect ratio settings.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Support for pasting and immediate recognition of images in the home page, outline, and description cards, providing an improved interaction experience.
    * Manual editing of outline sections: Support for manually adjusting the section (part) a page belongs to.
    * Docker Multi-architecture: Image support for amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese/English switching; support for Light / Dark / Follow System themes; full component adaptation for dark mode.
  * Fixes and Experience Optimizations
    * Fixed issues related to export 500 errors, reference file association timing, outline/page data misalignment, incorrect project task polling, infinite polling for description generation, image preview memory leaks, and partial failure handling for batch deletion.
    * Optimized format example prompts, HTTP error message wording, Modal closing experience, cleaned up localStorage for old projects, and removed redundant prompts during initial project creation.
    * Various other optimizations and fixes.

## ✨ Project Origins

Have you ever found yourself in this predicament: your presentation is due tomorrow, but the slides are still blank; your mind is full of brilliant ideas, but your enthusiasm is drained by tedious layout and design?

We long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally satisfy the need for "speed," they still suffer from the following issues:

- 1️⃣ Only preset templates are available, making it impossible to flexibly adjust the style
- 2️⃣ Low degree of freedom, making multi-round revisions difficult
- 3️⃣ Final products look similar, with severe homogenization
- 4️⃣ Low-quality assets that lack specificity
- 5️⃣ Disjointed text-image layouts with poor design aesthetics

These flaws make it difficult for traditional AI PPT generators to simultaneously meet our two major needs: "speed" and "aesthetics." Even those claiming to be "Vibe PPTs" are far from being "Vibe" in my eyes.

However, the emergence of the nano banana🍌 model has changed everything. I tried using 🍌pro for PPT page generation and found that the results were excellent in terms of quality, aesthetics, and consistency. It could almost accurately render all the text required by the prompt while following the style of the reference image. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Generate aesthetic PPTs with zero threshold and no design experience, reducing the hassle of template selection.
2. **PPT Professionals**: Reference AI-generated layouts and text-image combinations to quickly gain design inspiration.
3. **Educators**: Rapidly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing energy on content rather than layout and beautification.
5. **Professionals**: Rapidly visualize business proposals and product introductions with quick adaptation to various scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, enabling everyone to quickly produce aesthetic and professional presentations.</b>
</p>

## 🎨 Result Showcase

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Best Practices for Software Development** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Dishes** | **The Evolution of Money: A Journey from Shells to Paper Currency** |

</div>

See more at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creation Paths

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to suit different creative habits.
- **Single-Sentence Generation**: Enter a topic, and AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying outlines or descriptions via Vibe-style prompts (e.g., "Change page three to a case study"), with real-time AI adjustments.
- **Outline/Description Mode**: Allows for both one-click batch generation and manual detail refinement.
- **Reliable Markdown Import**: The import dialog previews the number of recognized pages before execution, preventing confusion caused by formatting errors.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Media Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other files, and the system automatically parses the content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information from the text to provide rich materials for generation.
- **Automatic Image Archiving**: Images parsed from documents are automatically added to the project asset library once the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Support for uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="File Parsing and Asset Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer restricted by complex menu buttons—issue modification commands directly through **natural language**.
- **Partial Redraw**: Make verbal-style modifications to unsatisfactory areas (e.g., "change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition pages with a unified style based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box format export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX. Supports classic effects such as Fade, Push, Wipe, Split, Blinds, Checkerboard, Clock, etc., with the option to select multiple effects for random application.
- **Export File Management**: The preview page lists files already exported on the server, allowing you to directly download or delete files that are no longer needed. Export task history is isolated by project to prevent accidental deletion of records from other projects. If a backend task becomes unavailable after a refresh, the task panel will clearly display a failure status and prompt for a re-export.
- **Clearer Page Selection Export**: The page selection export now indicates missing image status based on the current selection. Unselected draft pages will no longer disable the export entry for selected completed pages. For narration videos, unillustrated pages will only be included if the placeholder frame option is explicitly checked.
- **Perfect Fit**: Default 16:9 aspect ratio with no layout adjustments required—ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT and PDF Export" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Editable PPTX Export (Beta Iteration)

- **Export images into high-fidelity, clean-background PPT pages with freely editable images and text**
- See related updates at https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-Click Export for Explainer Videos

- **One-click conversion of slides into presentation videos (MP4) with AI voice narration and subtitles**
- AI automatically generates spoken-style narration based on page descriptions and content
- Supports various expression styles, multiple languages, and diverse voice options

<br>

**🌟 Comparison with NotebookLM Slide Deck features**
| Feature | NotebookLM | This Project |
| --- | --- | --- |
| Max Pages | 15 pages | **Unlimited** |
| Re-editing | Prompt modification | **Selection Editing + Voice Editing** |
| Adding Materials | Cannot add after generation | **Add freely after generation** |
| Export Formats | Supports exporting to PDF, (non-editable image) pptx | **Export to PDF, (Image or Editable) pptx, presentation video** |
| Watermark | Free version has watermark | **No watermark, freedom to add/delete elements** |

> Note: Comparison may become outdated as new features are added

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT via three paths: Idea, Outline, and Page Description |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Area selection and Vibe-based verbal editing for single PPT slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support for uploading and parsing various file types |
| ✅ Completed | Support for adjusting outlines and descriptions via Vibe verbal commands |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support for exporting editable .pptx with multi-layering and precise background removal |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narrated video export (Multi-voice in CH/EN/JP, with subtitles) |
| 🚍 Partial | Optimize frontend loading speed |
| 🧭 Planned | Online playback feature |
| 🧭 Planned | Simple animations and page transition effects |
| 🚍 Partial | Multilingual support |
| | |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest method, requiring no Docker installation or project downloading. You can access the application immediately after creation.

1. Deploy and launch this application with one click via Rainyun (High bandwidth, ideal for HD image generation and downloading. Free trials are available for new users)
- [Step-by-step Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![通过雨云一键部署](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose 🐳

Quickly start frontend and backend services via Docker Compose.

<details>
  <summary>📒 Notes for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please first [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) and ensure Docker is running (check the system tray icon on Windows; check the menu bar icon on macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also ensure that ports **3011** and **5011** are not occupied.

</details>

0. **Clone the code repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Configure environment variables**

Create a `.env` file (refer to `.env.example`):
```bash
cp .env.example .env
```

**(Optional, can also be configured in the UI after startup; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink))** Edit the `.env` file and configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM API in this project follows the AIHubMix platform format standard. It is recommended to use [AIHubMix (click here for direct access)](https://aihubmix.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly reminder: The Google nano banana pro model API costs are relatively high; please be mindful of usage costs.**
```env

# AI Provider Configuration Format (gemini / openai / volcengine / vertex)

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

# Select providers for text and image generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Provider API Keys (Only configure the ones you want to use)

```env
DOUBAO_API_KEY=your-doubao-api-key            # Volcengine/Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud/Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime SenseNova
MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
...
```

> Banana Slides explicitly packages the LazyLLM online provider SDKs used by domestic vendors:
> `volcengine-python-sdk[ark]` for Doubao, `dashscope` for Qwen/Wanxiang, and `zhipuai` for GLM/Zhipu.
> LazyLLM also exposes `lazyllm install online-advanced`, but the PyPI wheel may not publish that group as a standard install extra, so Docker/prebuilt images rely on these explicit dependencies instead.
  
</details>

**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu Intelligent Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is sufficient free usage quota). See the instructions in https://github.com/Anionex/banana-slides/issues/121 for details.

<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via a GCP service account, and new users can use free credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment relevant lines in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> `gemini-3-*` series models require `VERTEX_LOCATION=global`

</details>

2. **Start Service**

**⚡ Using Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synchronized with the latest version of the main branch), allowing you to skip local build steps for rapid deployment:

```bash

# Launch with Pre-built Images (No need to build from scratch)

docker compose -f docker-compose.prod.yml up -d
```

Image Names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can navigate to **Settings → About → Check for Updates** within the application. The application will determine if updates are available based on the current version SHA; when running from source code, the current Git SHA will also be used for determination.

**Build Images from Scratch**

```bash
docker compose up -d
```

> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use mirror sources in China
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```

3. **Access Application**

- Frontend: http://localhost:3011
- Backend API: http://localhost:5011

4. **View Logs**

```bash
```

# View Backend Logs (Last 200 Lines)

docker logs --tail 200 banana-slides-backend

# Real-time Viewing of Backend Logs (Last 100 Lines)

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

You can also check if a new version is available within the app by going to **Settings → About → Check for Updates**.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable. You need to revert the code to the original version before pulling.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), which is specifically designed for beginners without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting narration videos, and must include `libass` / `ass` subtitle filter support
- Valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Renovation" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading**. Reason: LibreOffice may cause layout displacement during server-side rendering due to missing fonts (e.g., Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. LibreOffice is not required if uploading PDF files. For Docker users who still need PPTX upload support within the container, run:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost after the container is rebuilt and must be reinstalled.

#### Backend Installation

0. **Clone the code repository**
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

# macOS (Homebrew)

```bash
brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full
```

# Ubuntu / Debian

sudo apt-get update
sudo apt-get install -y ffmpeg libass9

# Then install Python dependencies

```bash
uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, follow the previously mentioned method to open and edit the `.env` file and configure your API key

(No content was provided for translation. Please provide the Chinese Markdown content you would like translated.)

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

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`) via Vite proxy. If you need to modify it, please set `BACKEND_PORT` in the `.env` file at the project root directory.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all located in the uploads/ folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify if the service is running correctly.

#### Start frontend development server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access and use the application.

## 🛠️ Technical Architecture

### Frontend Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Communication Group

Welcome to suggest new features or provide feedback; I will also answer your questions in a ~~laid-back~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/e5e48e68-8ed8-4889-9fed-60ffbb7523f9" />

Welcome to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.xiaohongshu.com/user/profile/62e8f580000000001902fc9d"><img src="https://img.shields.io/badge/小红书-Anion-FF2442?style=flat-square&logo=xiaohongshu&logoColor=white" alt="Xiaohongshu"></a>
  <a href="https://space.bilibili.com/477162339"><img src="https://img.shields.io/badge/Bilibili-Anion-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Bilibili"></a>
</p>

## **🔧 Frequently Asked Questions**

See the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Contributions to this project are welcome via
[Issue](https://github.com/Anionex/banana-slides/issues)
and
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and can be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research activities;

For any questions or cooperation inquiries, please contact: davidyang042@gmail.com



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
    <p>Thanks to <strong>Volcengine </strong> for sponsoring this project<br>
      Ark Agent Plan limited-time 75% off subscription, <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">click here to buy now</a></p>
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

Thanks to AI Hubao for sponsoring this project
 
</div>

## Acknowledgements

- Project contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Appreciation

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their generous support and sponsorship:
> @雅俗共赏、@曹峥、@以年观日、@John、@胡yun星Ethan, @azazo1、@刘聪NLP、@🍟、@苍何、@万瑾、@biubiu、@law、@方源、@寒松Falcon、@刘星宇&小陀螺AIGC
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
