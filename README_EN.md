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
  <a href="#-项目缘起"><b>简体中文</b></a>
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
  <b>A native AI PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious layout, modify via conversation, and move towards a true "Vibe PPT"</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If this project is helpful to you, feel free to <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## 🔥 Latest Updates

- **[2026-04-25]**: Asset Toolbox launched — Added three modes: full-image editing, selection editing (overlay/replace), and smart erase to the existing asset generation, providing a unified entry for one-stop operations.
- **[2026-04-25]**: Added support for account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on the official OpenAI OAuth PKCE authorization flow, non-reverse engineered).
- **[2026-04-25]**: Support for saving custom text style description templates. They can be named, color-coded, and reused persistently, eliminating the need for repetitive input.
- **[2026-04-23]**: Added support for the gpt-image-2 model. Exportable editable background effects have also been improved due to model capability upgrades (Select "Generative Retrieval" in Settings -> Export Options -> Background Retrieval).
- **[2026-04-11]**: Added [CLI support and Agent Skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields and multi-aspect ratio settings.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Paste and instantly identify images on the home page, outline, and description cards, with an improved interaction experience.
    * Manual outline chapter editing: Support for manually adjusting the chapter (part) a page belongs to.
    * Docker Multi-arch: Image support for amd64 / arm64 builds.
    * Internationalization (i18n) + Dark Mode: Added Chinese/English switching; support for Light / Dark / Follow System themes; all components adapted for Dark Mode.
  * Fixes and UX Optimizations
    * Fixed export-related 500 errors, reference file association timing, outline/page data misalignment, task polling errors, infinite polling in description generation, image preview memory leaks, and partial failure handling in batch deletion.
    * Optimized format example prompts, HTTP error message copy, modal closing experience, cleanup of old project localStorage, and removal of redundant prompts for first-time project creation.
    * Various other optimizations and fixes.

## ✨ Project Origins

Have you ever found yourself in this dilemma: you have a presentation tomorrow, but your slides are still blank; your mind is full of brilliant ideas, but your passion is drained by tedious layout and design?

We long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the need for "speed," they still suffer from the following issues:

- 1️⃣ Limited to preset templates with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making it difficult to perform multiple rounds of revisions 
- 3️⃣ Similar visual output with heavy homogenization
- 4️⃣ Low-quality assets that lack relevance
- 5️⃣ Disjointed text and image layouts with poor design aesthetics

These flaws make it hard for traditional AI PPT generators to simultaneously satisfy our two core requirements: "speed" and "beauty." Even those claiming to be "Vibe PPT" are, in my eyes, far from being "vibe" enough.

However, the emergence of the nano banana🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were exceptional in terms of quality, aesthetics, and consistency. Furthermore, it can precisely render almost all text requested in the prompts and faithfully follow the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Use Cases

1. **Beginners**: Quickly generate beautiful PPTs with zero barrier to entry—no design experience required, eliminating the hassle of choosing templates.
2. **PPT Professionals**: Quickly gain design inspiration by referencing AI-generated layouts and combinations of text and visual elements.
3. **Educators**: Rapidly convert teaching materials into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Complete presentation assignments quickly, allowing focus on content rather than formatting and aesthetics.
5. **Business Professionals**: Quickly visualize business proposals and product introductions with fast adaptation across multiple scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly produce beautiful and professional presentations.</b>
</p>

## 🎨 Results Showcase

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Best Practices for Software Development** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Dishes** | **The Evolution of Money: A Journey from Shells to Paper Currency** |

</div>

See more in <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creation Paths

Supports three starting modes: **Ideas**, **Outlines**, and **Page Descriptions**, catering to different creative habits.
- **One-Sentence Generation**: Enter a topic, and the AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying outlines or descriptions via Vibe prompts (e.g., "Change the third page to a case study"), with the AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual fine-tuning of details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capability

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other file formats, and the system will automatically parse the content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information from the text, providing rich materials for generation.
- **Automatic Image Archiving**: Images parsed from documents are automatically added to the project asset library once the reference files are linked to the project, allowing for direct reuse later.
- **Style Reference**: Supports uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="File Parsing and Asset Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer restricted by complex menu buttons, issue modification commands directly through **natural language**.
- **Partial Inpainting**: Perform verbal modifications on unsatisfactory areas (e.g., "change this chart to a pie chart").
- **Full-Page Optimization**: Generate high-definition pages with a consistent style based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting PPTX. Supports classic effects such as Fade, Push, Wipe, Split, Blinds, Checkerboard, Clock, and more, with the option to multi-select for random application.
- **Export File Management**: The preview page lists files already exported on the server, allowing you to directly download or delete files no longer needed. Export task history is isolated by project for clearing, preventing accidental deletion of records from other projects.
- **Perfect Fit**: Default 16:9 aspect ratio; layout requires no secondary adjustments and is ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully Editable PPTX Export (Beta)

- **Export images as high-fidelity, clean-background PPT pages with freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export for Explainer Videos

- **One-click conversion of slides into explanatory videos (MP4) with AI voiceovers and subtitles**
- AI automatically generates colloquial narrations based on page descriptions and content
- Supports configuring multiple expression styles, languages, and voice tones

<br>

**🌟 Comparison with NotebookLM Slide Deck**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Post-editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Freely add after generation** |
| Export Formats | Supports PDF, (non-editable image) PPTX | **Export as PDF, (Image or Editable) PPTX, Explanatory Video** |
| Watermark | Watermarked in free version | **No watermark, freely add/remove elements** |

> Note: This comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT from three paths: ideas, outlines, and page descriptions |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Vibe verbal editing for selected areas on a single PPT slide |
| ✅ Completed | Asset module: asset generation, upload, etc. |
| ✅ Completed | Support for uploading and parsing multiple file types |
| ✅ Completed | Support Vibe verbal adjustments for outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable PPTX files |
| 🔄 In Progress | Support editable PPTX export with multi-layering and precise subject extraction |
| 🔄 In Progress | Web search |
| 🔄 In Progress | Agent mode |
| ✅ Completed | Export TTS narration videos (Multi-voice in CN/EN/JP, subtitles) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 In Planning | Online playback feature |
| 🧭 In Planning | Simple animations and slide transitions |
| 🚍 Partial | Multi-language support |
| | |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest method, requiring no Docker installation or project downloading. You can access the application directly after creation.


1. Deploy and start this application with one click via RainYun (High bandwidth, suitable for HD image generation and downloading. Free trial available for new users)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on RainYun with one click](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming Soon

### Using Docker Compose🐳

Quickly start frontend and backend services using Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure Docker is running (check the system tray icon on Windows; check the menu bar icon on macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also ensure that ports **3011** and **5011** are not occupied.

</details>

0. **Clone the repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Configure environment variables**

Create the `.env` file (refer to `.env.example`):
```bash
cp .env.example .env
```

**(Optional, can also be configured in the UI after starting; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file and configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM interfaces in the project are based on the AIHubMix platform format. It is recommended to use [AIHubMix (click here to access)](https://aihubmix.com/?aff=17EC) to obtain API keys to minimize migration costs.**<br>
> **Friendly Reminder: The interface costs for Google nano banana pro models are high. Please be mindful of usage costs.**
```env

# AI Provider Configuration Format (gemini / openai / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://aihubmix.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://aihubmix.com/v1

# Vertex AI Configuration (AI_PROVIDER_FORMAT=vertex)

# Requires GCP Project and Service Account Key

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Selecting Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# API Keys for Various Providers (Only configure the providers you intend to use)

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


**Use the new editable export configuration method to get better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter), and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is an ample free usage quota). See the instructions in https://github.com/Anionex/banana-slides/issues/121 for details.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP Users)</summary>

Google Cloud Vertex AI allows calling Gemini models via a GCP service account, and new users can use trial credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant sections in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`

</details>

2. **Start Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch), allowing you to skip local build steps for rapid deployment:

```bash

# Start with Pre-built Images (No Build from Scratch Required)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can go to **Settings → About → Check for Updates** within the application. The app will determine if there is an update available based on the current version SHA; the current Git SHA will also be used for determination when running from source code.

**Build images from scratch**

```bash
docker compose up -d
```


> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use mirrors in China
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```


3. **Accessing the Application**

- Frontend: http://localhost:3011
- Backend API: http://localhost:5011

4. **Viewing Logs**

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

**Using pre-built images (docker-compose.prod.yml)**

Alternatively, you can go to **Settings → About → Check for Updates** within the application to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using local build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable. You need to revert the code to the pulled version first.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Special thanks to our talented developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). Designed specifically for beginners with no server deployment experience, you can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Desktop Installation and Local Packaging

The desktop app is packaged with Electron + PyInstaller. It starts the bundled backend locally, which is useful when you do not want to run Docker or source-mode frontend/backend services manually. See the full [Desktop documentation](https://docs.bananaslides.online/features/desktop).

**Install a released build**

1. Go to [GitHub Releases](https://github.com/Anionex/banana-slides/releases) and download the installer for your platform.
2. On Windows, run `BananaSlides-<version>-Setup.exe`; on macOS, open `BananaSlides-<version>.dmg` and drag the app into Applications.
3. On first launch, open **Settings** and configure your model provider. The local database, uploads, and exports are stored in a user-writable app data directory, not inside the installation directory.

<details>
  <summary>📒 Signing and system security notes</summary>

The current desktop package does not claim completed commercial code signing or Apple notarization. Windows may show a SmartScreen prompt; macOS may show an "unidentified developer" warning and require manual approval. Before formal distribution, add Windows code signing, Apple Developer ID signing, and notarization.

</details>

**Local packaging**

Build the frontend static files and PyInstaller backend first. The `prebuild:*` scripts in `desktop/` copy those artifacts and generate build metadata.

```bash
# 1. Build frontend
cd frontend
npm ci
npm run build

# 2. Package backend
cd ../backend
uv sync
uv pip install pyinstaller
uv run pyinstaller banana-slides.spec --noconfirm

# 3. Package desktop app
cd ../desktop
npm ci
npm run build:mac   # macOS arm64 DMG
npm run build:win   # Windows x64 NSIS Setup
```

For macOS/Linux packaging, the `desktop` npm dependencies provide platform FFmpeg/FFprobe binaries by default; you can also point `FFMPEG_BIN` / `FFPROBE_BIN` at trusted local binaries, or provide fallback commands in `PATH`. Windows packaging downloads a pinned static FFmpeg archive and verifies its SHA256 by default, or you can point `FFMPEG_BIN` / `FFPROBE_BIN` at trusted local binaries.

**Release flow**

Pushing a `v*` tag triggers `.github/workflows/release-desktop.yml`, builds desktop artifacts on Windows, macOS, and Linux runners, and uploads them to a GitHub draft Release. Before publishing, verify at minimum:

- Windows: install `BananaSlides-<version>-Setup.exe`, launch the app, create a project, open Settings, and exercise one export or download path.
- macOS: mount `BananaSlides-<version>.dmg`, drag the app into Applications, launch it, confirm the bundled backend `/health` path is healthy, and confirm desktop requests use the actual backend port.
- Update checks: **Check for Updates** should only report a GitHub Release newer than the current build, not an older release.

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for explanation video export; must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required for converting PPTX to PDF when using the "PPT Revamp" feature. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: LibreOffice may cause layout issues during server-side rendering due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. LibreOffice is not required for uploading PDF files. Docker users who still need to support PPTX uploads within the container can run:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed via this method will be lost after container reconstruction and will need to be reinstalled.

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

Run in the project root directory:
```bash
```

# macOS (Homebrew)

brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full

# Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg libass9
```

# Then install Python dependencies

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure environment variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, following the aforementioned method, open and edit the `.env` file to configure your API key.

# Project Title

A brief description of the project.

## Features

- **Efficient**: High-speed performance.
- **Reliable**: Robust and stable architecture.
- **Easy to Use**: Simple and intuitive interface.

## Installation

```bash
git clone https://github.com/example/project.git
cd project
npm install
```

## Usage

```bash
npm start
```

## Configuration

You can modify the configuration in `config.json`.

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| `port`    | Number | Server port |
| `debug`   | Boolean| Debug mode  |

## License

This project is licensed under the [MIT License](LICENSE).

#### Frontend Installation

1. **Enter the frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure API address**

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`) via Vite proxy. If you need to modify this, please set `BACKEND_PORT` in the `.env` file in the project root directory.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and final products are all stored in the `uploads/` folder.

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

Open your browser to access and use the application.

## 🛠️ Technical Architecture

### Frontend Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Communication Group

Feel free to suggest new features or provide feedback, and I will also answer questions in a ~~relaxed~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/e5e48e68-8ed8-4889-9fed-60ffbb7523f9" />

Feel free to follow my social media, where I share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.xiaohongshu.com/user/profile/62e8f580000000001902fc9d"><img src="https://img.shields.io/badge/小红书-Anion-FF2442?style=flat-square&logo=xiaohongshu&logoColor=white" alt="Xiaohongshu"></a>
  <a href="https://space.bilibili.com/477162339"><img src="https://img.shields.io/badge/Bilibili-Anion-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Bilibili"></a>
</p>

## **🔧 Frequently Asked Questions**

See the [Official Documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project via
[Issue](https://github.com/Anionex/banana-slides/issues)
and
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. It is free for non-commercial use, such as personal study, research, experimentation, education, or non-profit scientific research activities;

For inquiries or cooperation interests, please contact: davidyang042@gmail.com

<h2>🚀 Sponsor</h2>
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
      Ark Agent Plan limited-time 75% off subscription, <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">click the link to purchase</a></p>
</a>
</div>

<!-- Note, use this version for the English README: -->
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

Thanks to ChatFire for sponsoring this project
 
</div>

## Acknowledgements

- Project contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Appreciation

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their selfless sponsorship and support of the project:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon, @刘星宇&小陀螺AIGC
> If you have any questions regarding the sponsorship list, please feel free to <a href="mailto:davidyang042@gmail.com">contact the author</a>

## 📈 Project Statistics

<a href="https://www.star-history.com/#Anionex/banana-slides&type=Timeline&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

 </picture>

</a>

<br>
