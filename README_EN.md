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
  <a href="#-项目缘起"><b>简体中文</b></a>
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
  <b>Go from ideas to presentations in minutes—no tedious formatting, edit through conversation, and move towards real "Vibe PPT"</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2"><b>💻 Desktop RC2</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If this project is helpful to you, feel free to <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## 🔥 Latest News

- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser caches, preserving valid presets and preventing abnormal caching from blocking the editing page.
- **[2026-07-11]**: Release Candidate 2 for version 0.9.0 is now available, including all features of RC1. It fixes MinerU directory inconsistency for editable PPTX on Windows desktop and FFprobe path errors for narration videos; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Page-by-page templates launched — supports single/multiple template modes. Users can upload images or PDFs to build project template libraries. AI automatically analyzes template styles and provides one-click smart matching for each page, or manual binding page by page; seamless two-way switching between modes at any time ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — adds three new modes: full-image editing, box-selection editing (overlay/replace), and smart erasing to the original asset generation, providing a unified one-stop entry.
- **[2026-04-25]**: Supports binding accounts via official OpenAI OAuth. Once bound, Codex can be used directly as the text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images in five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, non-reverse engineered).
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and reused persistently, eliminating the need to re-enter each time.
- **[2026-04-23]**: Added support for the gpt-image-2 model. Editable background export effects have also improved due to model capability upgrades (select "Generative Acquisition" in Settings - Export Options - Background Acquisition).
- **[2026-04-11]**: Added support for [CLI operations and integrated Agent Skills](https://docs.bananaslides.online/cli)
- **[2026-03]**: Added several features and optimizations, such as additional fields, multi-aspect ratio settings, etc.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Support for pasting images in the homepage, outline, and description cards for immediate recognition with an improved interactive experience.
    * Manual Outline Chapter Editing: Support for manually adjusting the chapter (part) a page belongs to.
    * Docker Multi-architecture: Image support for amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese-English switching; support for Light/Dark/System theme; all components adapted for Dark Mode.
  * Fixes & Experience Optimizations
    * Fixed 500 errors related to export, reference file association timing, outline/page data misalignment, incorrect project task polling, infinite polling for description generation, image preview memory leaks, and partial failure handling for batch deletions.
    * Optimized format example prompts, HTTP error message copy, modal closing experience, cleaning up legacy project localStorage, and removing redundant prompts when creating a project for the first time.
    * Several other optimizations and fixes.

> **Desktop Version Configuration, Storage, and Export Tips**: The desktop installation package does not have a `.env` in the project root directory; please save API configurations directly in "Settings." For the first installation on Windows, you can choose the "Data Storage Location"; all desktop platforms can also modify this in "Settings → Data Storage Location," which takes effect after a restart. The application will not automatically migrate or delete old data; before manual migration, you must completely exit the application from the system tray and copy the `data`, `uploads`, and `exports` directories in full. The desktop version completes OpenAI OAuth in the system browser and automatically shows as connected upon a successful callback without needing to refresh the app. Desktop exports will trigger a system save dialog and will only be considered complete after the file is successfully written to the selected location; if writing fails, the target path and error message will be displayed, or you can re-download from the "Export Tasks" panel.

## ✨ Project Origin

Have you ever found yourself in this dilemma: a presentation is due tomorrow, but your PPT is still a blank canvas; you have countless brilliant ideas, but your passion is drained by tedious layout and design?

We long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the demand for "speed," they still suffer from the following issues:

- 1️⃣ Only preset templates can be selected, with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making multi-round modifications difficult 
- 3️⃣ Visual outputs look similar, leading to severe homogenization
- 4️⃣ Low-quality assets that lack specificity
- 5️⃣ Disjointed text and image layouts with poor design sense

These flaws make it difficult for traditional AI PPT generators to simultaneously satisfy our two core needs: "speed" and "aesthetics." Even those claiming to be "Vibe PPTs" are, in my eyes, still far from being truly "Vibe."

However, the emergence of the nano banana 🍌 model has changed everything. I tried using 🍌pro for PPT page generation and found that the results were exceptional in terms of quality, aesthetics, and consistency. It can accurately render almost all text requested in the prompts and strictly follows the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Use Cases

1. **Beginners**: Quickly generate beautiful PPTs with zero barrier; no design experience required, reducing the hassle of choosing templates.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of visual elements to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing effort on content rather than formatting and beautification.
5. **Business Professionals**: Rapidly visualize business proposals and product introductions with quick adaptation across multiple scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly create aesthetic and professional presentations.</b>
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

See more at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Ideas**, **Outlines**, and **Page Descriptions**—to cater to different creative habits.
- **One-Sentence Generation**: Enter a topic, and AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying outlines or descriptions via Vibe prompts (e.g., "Change page three to a case study"), with AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual adjustment of details.
- **More Reliable Markdown Import**: The import popup provides a preview of recognized pages before execution and appends pages all at once according to the file order, avoiding formatting issues or uncertain ordering after multi-page imports.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other files; the system automatically parses the content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information within the text to provide rich source material for generation.
- **Automatic Image Archiving**: Images parsed from documents are automatically added to the project asset library once the reference files are associated with the project, allowing for direct reuse in the future.
- **Style Reference**: Supports uploading reference images or templates to customize the PPT style.
- **Multi-image Joint Reference**: When using GPT Image, both the image template and the asset images in the page description are sent to the model together, instead of using only the first reference image.

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer limited by complex menus and buttons, issue editing commands directly using **natural language**.
- **Inpainting**: Perform conversational edits on unsatisfactory areas (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.
- **Quality Control Mode**: Can be enabled in system settings or on the preview page. After generation, it automatically checks for garbled text, low-quality visuals, and prompt deviation; only images that pass the check are saved as a new version.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable page transition animations before exporting PPTX. Supports classic effects such as Fade, Push, Wipe, Split, Blinds, Checkerboard, Clock, etc., with support for multi-selection and random application.
- **Export File Management**: The preview page lists files already exported on the server, allowing direct download or deletion of unnecessary files. Export task history is isolated by project to prevent accidental deletion of other project records. If a backend task is no longer available after refreshing, the task panel clearly displays a failure status and prompts for re-export.
- **Video Export Configuration Pre-check**: Displays the settings loading status before opening the explanation video panel. If the output language or ElevenLabs configuration fails to load, it will clearly prompt to retry rather than continuing with uncertain default values.
- **Clearer Selective Export**: Selective page export now prompts missing image status based on the currently selected range. Unselected draft pages will not cause the export entry for selected completed pages to be grayed out. Explanation videos require the placeholder frame option to be explicitly checked to include pages without images.
- **Perfect Fit**: Default 16:9 ratio, no secondary layout adjustments required; ready for direct presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Editable PPTX Export (Beta Iteration)

- **Export images as high-fidelity, clean-background PPT pages with freely editable images and text**
- See related updates at https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explanation Videos

- **One-click conversion of slides into explainer videos (MP4) with AI voiceovers and subtitles**
- AI automatically generates colloquial narrations based on page descriptions and content
- Supports configuration of multiple expression styles, languages, and voices

<br>

**🌟 Comparison with notebooklm slide deck features**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Max Pages | 15 pages | **Unlimited** | 
| Secondary Editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Adding Assets | Cannot add after generation | **Freely add after generation** |
| Export Formats | Supports PDF, (non-editable image) pptx | **Export to PDF, (image or editable) pptx, explainer video** |
| Watermark | Free version has watermark | **No watermark, freely add/remove elements** |

> Note: This comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT via three paths: ideas, outlines, and page descriptions |
| ✅ Completed | Parse Markdown-formatted images within text |
| ✅ Completed | Add more assets to individual PPT slides |
| ✅ Completed | Voice-based "Vibe" editing for selected areas on a single slide |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of various file types |
| ✅ Completed | Support voice-based "Vibe" adjustment for outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support for exporting editable .pptx with multi-layering and precise cutouts |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narration video export (Chinese/English/Japanese voices, subtitles) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 Planned | Online playback functionality |
| 🧭 Planned | Simple animations and slide transitions |
| 🚍 Partial | Multi-language support |
| |

## 📦 Usage

### (New) One-click deployment with application templates

This is the simplest method—no need to install Docker or download the project. You can access the application directly after creation.


1. One-click deploy and start this application via Rainyun (High bandwidth, suitable for HD image generation and downloading. Free trial available for new users.)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy via Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose 🐳

Quickly start frontend and backend services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure that Docker is running (check the system tray icon for Windows or the menu bar icon for macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter any issues, Windows users should enable the **WSL 2 backend** in the Docker Desktop settings (recommended); also, ensure that ports **3011** and **5011** are not occupied.

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

**(Optional, can also be configured in the user interface after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **Large model interfaces in this project follow the AIHubMix platform format as standard. It is recommended to use [AIHubMix (click here to access directly)](https://api.inferera.com/?aff=17EC) to obtain an API key and reduce migration costs.**<br>
> **Friendly tip: The interface fees for the Google nano banana pro model are relatively high; please be mindful of usage costs.**
```env

# AI Provider Configuration Formats (gemini / openai / volcengine / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://api.inferera.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://api.inferera.com/v1

# Volcengine Ark AgentPlans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/v3

# Vertex AI Configuration (AI_PROVIDER_FORMAT=vertex)

# GCP Project and Service Account Key Required

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Select Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Provider API Keys (Only configure the providers you want to use)

```env
DOUBAO_API_KEY=your-doubao-api-key            # Volcengine / Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud / Tongyi Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseNova
MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
...
```

> Banana Slides explicitly packages the LazyLLM online provider SDKs used by domestic vendors:
> `volcengine-python-sdk[ark]` for Doubao, `dashscope` for Qwen/Wanxiang, and `zhipuai` for GLM/Zhipu.
> LazyLLM also exposes `lazyllm install online-advanced`, but the PyPI wheel may not publish that group as a standard install extra, so Docker/prebuilt images rely on these explicit dependencies instead.
  
</details>


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter), and fill it into the `BAIDU_API_KEY` field in the `.env` file (there is a sufficient free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via a GCP service account, and new users can use their free trial credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant lines in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Start Services**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch). You can skip the local build steps to achieve rapid deployment:

```bash

# Start with Pre-built Images (No Need to Build from Scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After starting, you can go to **Settings → About → Check for Updates** within the application. The app will determine if updates are available based on the current version SHA; when running from source, the current Git SHA will also be used for judgment.

**Build images from scratch**

```bash
docker compose up -d
```


> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configuration in the `.env` file and rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use Chinese mirror sources
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
docker compose logs -f
```

# View Backend Logs (Last 200 Lines)

docker logs --tail 200 banana-slides-backend

# View Backend Logs in Real-time (Last 100 Lines)

docker logs -f --tail 100 banana-slides-backend

# View Frontend Logs (Last 100 Lines)

```bash
docker logs --tail 100 banana-slides-frontend
```

5. **Stop Services**

```bash
docker compose down
```

6. **Update Project**

**Using Pre-built Images (docker-compose.prod.yml)**

You can also go to **Settings → About → Check for Updates** within the app first to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable; you need to revert the code to the version at the time of the pull first.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing a [Deployment Tutorial for Beginners](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). It is specifically designed for novices with no server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting presentation videos, and must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Refurbishment" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: Server-side rendering with LibreOffice may cause layout misalignment due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. Uploading PDF files does not require LibreOffice. Docker users who still need to support PPTX uploads within the container can execute:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost after the container is rebuilt and will need to be reinstalled.

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

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, follow the previously mentioned method to open and edit the `.env` file and configure your API key

# <img src="https://github.com/Go-OOS/OOS/blob/main/docs/logo.png" width="30" height="30"> OOS
A simple, high-performance, and extensible object storage framework for Go.

[![Go Report Card](https://goreportcard.com/badge/github.com/Go-OOS/OOS)](https://goreportcard.com/report/github.com/Go-OOS/OOS)
[![Go Doc](https://godoc.org/github.com/Go-OOS/OOS?status.svg)](https://godoc.org/github.com/Go-OOS/OOS)
[![License](https://img.shields.io/github/license/Go-OOS/OOS.svg)](https://github.com/Go-OOS/OOS/blob/main/LICENSE)

## 📖 Introduction
OOS (Object Oriented Storage) is a framework designed to simplify object storage operations in Go applications. It provides a unified API and supports multiple storage backends (such as AWS S3, Alibaba Cloud OSS, Tencent Cloud COS, Local Storage, etc.), allowing developers to switch storage services easily without modifying business logic.

## ✨ Features
- **Unified API**: Consistent operational interface for different storage services.
- **High Performance**: Employs efficient concurrency processing and resource management.
- **Extensible**: Plugin-based architecture, making it easy to support new storage backends.
- **Type Safe**: Fully leverages Go's strong typing features.
- **Production Ready**: Includes comprehensive error handling and retry mechanisms.

## 🚀 Quick Start

### Installation
```bash
go get github.com/Go-OOS/OOS
```

### Basic Usage
```go
package main

import (
    "context"
    "fmt"
    "github.com/Go-OOS/OOS"
    "github.com/Go-OOS/OOS/providers/s3"
)

func main() {
    // Initialize configuration
    config := s3.Config{
        AccessKey: "your-access-key",
        SecretKey: "your-secret-key",
        Region:    "us-east-1",
        Bucket:    "my-bucket",
    }

    // Create storage client
    storage, err := s3.New(config)
    if err != nil {
        panic(err)
    }

    // Upload file
    err = storage.Put(context.Background(), "hello.txt", []byte("Hello OOS!"))
    if err != nil {
        fmt.Printf("Upload failed: %v\n", err)
        return
    }

    fmt.Println("File uploaded successfully!")
}
```

## 🛠 Supported Storage Backends
- [x] AWS S3
- [x] Alibaba Cloud OSS
- [x] Tencent Cloud COS
- [x] MinIO
- [x] Local Storage
- [ ] Huawei Cloud OBS (In development)
- [ ] Google Cloud Storage (Planned)

## 🤝 Contributing
Contributions of any kind are welcome! Whether it's submitting issues, fixing bugs, or adding new features. Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## 📄 License
This project is open-sourced under the [Apache License 2.0](LICENSE) agreement.

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

The frontend will automatically connect via Vite proxy to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`). To modify this, please set `BACKEND_PORT` in the `.env` file at the project root.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all located in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify that the service is running correctly.

#### Start Front-end Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access the application.

## 🛠️ Technical Architecture

### Frontend Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Community Group

Welcome to suggest new features or provide feedback. I will also answer questions in a ~~casual~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/8930a308-0631-4758-b662-921f176d411c" />

Welcome to follow the author's social media, where I will share information about this project and AI:

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

欢迎通过
[Issue](https://github.com/Anionex/banana-slides/issues)
和
[Pull Request](https://github.com/Anionex/banana-slides/pulls)
为本项目贡献力量！

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
It can be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research activities;

For any questions or cooperation intentions, please contact: davidyang042@gmail.com



<h2>🚀 Sponsor </h2>
<br>
<div align="center">
<a href="https://api.inferera.com/?aff=17EC">
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

Thanks to AI Huobao for sponsoring this project
 
</div>

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsorship

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their selfless sponsorship and support of the project:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon, @刘星宇&小陀螺AIGC
> If you have any questions about the sponsorship list, please <a href="mailto:davidyang042@gmail.com">contact the author</a>

## 📈 Project Statistics

<a href="https://www.star-history.com/#Anionex/banana-slides&type=Timeline&legend=top-left">

 <picture>

   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&theme=dark&legend=top-left" />

   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Anionex/banana-slides&type=Timeline&legend=top-left" />

 </picture>

</a>

<br>
