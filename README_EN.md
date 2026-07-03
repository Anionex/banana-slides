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
  <a href="https://github.com/Anionex/banana-slides"><img src="https://img.shields.io/badge/version-v0.9.0-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from ideas to presentations in minutes—no tedious formatting, just conversational editing. Step into the era of true "Vibe PPT"</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If this project is helpful to you, please <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## 🔥 Latest Updates

- **[2026-06-23]**: Page-by-page templates launched — supports both Single and Multi-template modes. You can upload images or PDFs to build project template libraries. AI automatically parses template styles and intelligently matches them to each page with one click, or you can manually bind them page by page. Seamless two-way switching between modes is supported at any time ([Docs](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — adds three new modes: Full Image Editing, Selection Editing (overlay/replace), and Smart Erase to the existing asset generation, providing a one-stop operation with a unified entry point
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth login. Once bound, Codex can be used directly as the text/image generation provider without manually entering API Keys. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on the official OpenAI OAuth PKCE authorization flow, non-reverse engineered)
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and persistently reused, eliminating the need for repetitive input
- **[2026-04-23]**: Added support for the gpt-image-2 model. The quality of editable background effects during export has also been enhanced due to model capability upgrades (Select "Generative Acquisition" under Settings - Export Options - Background Acquisition)
- **[2026-04-11]**: Added support for [CLI operations and integrated agent skills](https://docs.bananaslides.online/cli)
- **[2026-03]**: Added several features and optimizations, such as extra fields, multi-aspect ratio settings, etc.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Supports pasting images directly into the homepage, outline, and description cards for instant recognition, providing a better interactive experience.
    * Manual Outline Chapter Editing: Supports manual adjustment of the chapter (part) a page belongs to.
    * Multi-architecture Docker: Image supports amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese/English switching; supports Light/Dark/System theme settings; full component adaptation for Dark Mode.
  * Fixes and Experience Optimizations
    * Fixed export-related 500 errors, reference file association timing, outline/page data misalignment, task polling errors for incorrect projects, infinite polling in description generation, image preview memory leaks, and partial failure handling in batch deletions.
    * Optimized format example prompts, HTTP error message copy, Modal closing experience, cleaned up localStorage for old projects, and removed redundant prompts during initial project creation.
    * Various other optimizations and fixes.

## ✨ Project Origin

Have you ever found yourself in this predicament: your presentation is due tomorrow, but your slides are still blank? You have countless brilliant ideas in your head, but your passion is drained by the tedious tasks of layout and design.

We all long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the need for "speed," they still suffer from the following issues:

- 1️⃣ Limited to preset templates with no flexibility to adjust styles.
- 2️⃣ Low degree of freedom, making multi-round revisions difficult.
- 3️⃣ Similar visual outcomes with heavy homogenization.
- 4️⃣ Low-quality assets that lack relevance to the specific topic.
- 5️⃣ Disjointed text-and-image layout with poor design aesthetic.

These deficiencies make it difficult for traditional AI PPT generators to simultaneously satisfy our dual requirements for "speed" and "aesthetics." Even those claiming to be "Vibe PPTs" are, in my eyes, still far from being truly "Vibe."

However, the emergence of the nano banana 🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were exceptional in terms of quality, aesthetics, and consistency. It can accurately render almost all the text requested in the prompts while strictly following the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Use Cases

1. **Beginners**: Quickly generate aesthetic PPTs with zero threshold and no design experience required, reducing the hassle of choosing templates.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of text and graphic elements to quickly gain design inspiration.
3. **Educators**: Rapidly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing energy on content rather than typesetting and beautification.
5. **Professionals**: Quickly visualize business proposals and product introductions, with rapid adaptation to multiple scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, enabling everyone to quickly produce beautiful and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Meals** | **The Evolution of Money: A Journey from Shells to Banknotes** |

</div>

See more <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creation Paths

Supports three starting modes: **Ideas**, **Outlines**, and **Page Descriptions**, catering to different creative habits.
- **One-Sentence Generation**: Enter a topic, and AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying outlines or descriptions via natural language prompts (e.g., "Change page three to a case study"), with AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual detail adjustments.
- **Reliable Markdown Import**: The import pop-up previews the number of identifiable pages before execution, preventing confusion about successful additions if formatting issues occur.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Resource Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other files for automatic background content parsing.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information from the text, providing rich materials for generation.
- **Automatic Image Storage**: Images extracted from documents will be automatically added to the project material library once the reference file is associated with the project, allowing for direct reuse in the future.
- **Style Reference**: Supports uploading reference images or templates to customize PPT styles.

<img width="1920" height="1080" alt="Document Parsing and Material Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe" Style Natural Language Modification

No longer limited by complex menus and buttons, directly issue editing commands through **natural language**.
- **Local Edit**: Perform verbal modifications on unsatisfactory areas (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.
- **Quality Control Mode**: Enable it from Settings or the preview page to automatically check generated images for garbled text, low-quality visuals, and prompt mismatch. Only images that pass are saved as new versions.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transitions before exporting to PPTX. Supports classic effects such as Fade, Push, Pan, Wipe, Split, Blinds, Checkerboard, and Clock, with the ability to multi-select for random application.
- **Export File Management**: The preview page lists all files exported on the server, allowing you to download them directly or delete those no longer needed. Export task history is isolated by project to prevent accidental deletion of records from other projects. If a backend task is no longer available after a refresh, the task panel will clearly display a failure and prompt a re-export.
- **Clearer Page-Selective Export**: The page-selective export now indicates the status of missing images within the current selection range. Unselected draft pages will no longer cause the export entry for selected completed pages to be greyed out. Explainer videos will only include pages without images if the placeholder frame option is explicitly checked.
- **Perfect Fit**: Default 16:9 aspect ratio; layout requires no manual adjustments and is ready for direct presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully Editable pptx Export (Beta in Progress)

- **Export images to high-fidelity, clean-background PPT pages with freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explainer Videos

- **One-click conversion of slides into presentation videos (MP4) with AI voiceover and subtitles**
- AI automatically generates colloquial narrations based on page descriptions and content
- Supports configuration of various expression styles, multiple languages, and diverse voice personas

<br>

**🌟 Comparison with NotebookLM Slide Deck features**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Secondary Editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Freely add after generation** |
| Export Format | Supports exporting to PDF, (non-editable image) pptx | **Export as PDF, (image or editable) pptx, presentation video** |
| Watermark | Watermarked in free version | **No watermark, freely add/remove elements** |

> Note: As new features are added, this comparison may become outdated.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT via three paths: idea, outline, and page description |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Vibe oral editing for selected areas on a single PPT slide |
| ✅ Completed | Asset module: asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of multiple file types |
| ✅ Completed | Support Vibe oral adjustment of outlines and descriptions |
| ✅ Completed | Initial support for exporting editable PPTX files |
| 🔄 In Progress | Support editable PPTX export with multi-layering and precise background removal |
| 🔄 In Progress | Web search |
| 🔄 In Progress | Agent mode |
| ✅ Completed | TTS narrated video export (multi-voice in CN/EN/JP, subtitles) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 In Planning | Online playback functionality |
| 🧭 In Planning | Simple animations and page transition effects |
| 🚍 Partial | Multi-language support |
| |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest method, requiring no Docker installation or project downloads. You can access the application directly after creation.


1. One-click deployment and startup of this application via Rainyun (High bandwidth, suitable for HD image generation and downloads. Free trials available for new users).
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun with one click](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming Soon

### Using Docker Compose🐳

Quickly start frontend and backend services using Docker Compose.

<details>
  <summary>📒 Windows/Mac User Instructions</summary>

If you are using **Windows or macOS**, please first [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) and ensure Docker is running (Windows users can check the system tray icon; macOS users can check the menu bar icon), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also, ensure that ports **3011** and **5011** are not occupied.

</details>

0. **Clone the Repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Configure Environment Variables**

Create the `.env` file (refer to `.env.example`):
```bash
cp .env.example .env
```

**(Optional, can also be configured in the user interface after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM interface in this project follows the AIHubMix platform format standard. It is recommended to use [AIHubMix (click here for direct access)](https://aihubmix.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Kind Reminder: The API cost for the Google nano banana pro model is high; please be mindful of usage costs.**
```env
```

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

# GCP Project and Service Account Key Required

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Choose Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Provider API Keys (Only configure the ones you intend to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine / Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud / Tongyi Qwen
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


**Use the new editable export configuration method to get better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is a sufficient free quota). See the instructions in https://github.com/Anionex/banana-slides/issues/121 for details.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via GCP service accounts; new users can use free credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account and download the key file in JSON format.
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

2. **Start the Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch), allowing you to skip local build steps for fast deployment:

```bash

# Start with Pre-built Image (No need to build from scratch)

docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After starting, you can go to **Settings → About → Check for Updates** within the application. The app will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for this check.

**Build Images from Scratch**

```bash
docker compose up -d
```

> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use domestic mirror sources
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```

3. **Accessing the Application**

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

Note: If you have manually modified the code, this method is not applicable. You must first revert the code to the version at the time of the last pull.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). Designed specifically for beginners with no server deployment experience, you can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for explanation video export, and must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Remake" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: LibreOffice may cause layout displacement during server-side rendering due to missing fonts (e.g., Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. Uploading PDF files does not require LibreOffice. Docker users who still need PPTX upload support within the container can execute:
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

Run in the project root directory:
```bash

# macOS (Homebrew)

brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full

# Ubuntu / Debian

sudo apt-get update
sudo apt-get install -y ffmpeg libass9

# Then install Python dependencies

```bash
uv sync
```

This will automatically install all dependencies according to `pyproject.toml`.

3. **Configure environment variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, follow the previously mentioned method to open and edit the `.env` file and configure your API key.

# This is a Level 2 Heading

This is a paragraph.

### List
- Item A
- Item B

## Code Example

```python
def hello_world():
    print("Hello, world")
```

## Features

- **Fast**: High performance.
- **Easy**: Simple to use.

[Link to Example](https://example.com)

![Image Description](https://example.com/image.png)

<div align="center">
  <p>This is an HTML paragraph.</p>
</div>

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

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` via Vite proxy (default `http://localhost:5011`). To modify this, please set `BACKEND_PORT` in the `.env` file at the project root.

#### Start the Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and outputs are all located in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify if the service is running correctly.

#### Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access and use the application.

## 🛠️ Technical Architecture

### Front-end Technology Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Community Group

Suggestions for new features or feedback are welcome, and I will also answer your questions in a ~~laid-back~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/e5e48e68-8ed8-4889-9fed-60ffbb7523f9" />

Feel free to follow the author on social media, where I share updates about this project and AI-related information:

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

Welcome to contribute to this project through [Issue](https://github.com/Anionex/banana-slides/issues) and [Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and can be freely used for non-commercial purposes such as personal learning, research, testing, education, or non-profit scientific research activities;

For any questions or cooperation intentions, please contact: davidyang042@gmail.com



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
      Ark Agent Plan limited-time 75% off subscription, <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">click the link to purchase</a></p>
</a>
</div>

<!-- Note: The English README uses this version: -->
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

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): The new ideal community

## Donation

Open source is not easy 🙏 If you find this project valuable, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Special thanks to the following friends for their generous sponsorship and support:
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
