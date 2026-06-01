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
  <b>A native AI PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious typesetting, just natural language revisions, moving towards true "Vibe PPT"</b>
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

## 🔥 Latest News

- **[2026-04-25]**: Asset Toolbox launched — added three modes: Full Image Editing, Selection Editing (overlay/replace), and Smart Erase to the original asset generation features, providing a unified entry point for one-stop operations.
- **[2026-04-25]**: Support for linking accounts via OpenAI official OAuth. After linking, Codex can be used directly as a text/image generation provider without manually entering API keys. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)). (Based on the official OpenAI OAuth PKCE authorization flow, non-reverse engineered).
- **[2026-04-25]**: Support for saving custom text style description templates, which can be named, color-coded, and persistently reused, eliminating the need for repeated manual input.
- **[2026-04-23]**: Added support for the gpt-image-2 model. Editable background effects during export have also been improved due to upgraded model capabilities (Select "Generative Acquisition" in Settings -> Export Options -> Background Acquisition).
- **[2026-04-11]**: Added support for [CLI operations and integrated Agent Skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields and multi-aspect ratio settings.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Support for pasting images directly into the homepage, outline, and description cards for immediate recognition, with an improved interactive experience.
    * Manual Outline Chapter Editing: Supports manually adjusting the chapter (part) a page belongs to.
    * Docker Multi-architecture: Images now support amd64 / arm64 builds.
    * i18n + Dark Mode: Added Chinese/English toggle; supports Light/Dark/System theme settings; all components adapted for Dark Mode.
  * Fixes and UX Optimizations
    * Fixed export-related 500 errors, reference file association timing, outline/page data misalignment, incorrect project task polling, infinite polling for description generation, image preview memory leaks, and partial failure handling for batch deletions.
    * Optimized format example hints, HTTP error message copy, Modal closing experience, cleared old project localStorage, and removed redundant prompts during initial project creation.
    * Various other optimizations and fixes.

## ✨ Project Origin

Have you ever found yourself caught in this dilemma: the presentation is due tomorrow, but the slides are still a total blank; your mind is full of brilliant ideas, yet all your enthusiasm is drained by tedious layout and design?

We long for the ability to quickly create presentations that are both professional and visually stunning. While traditional AI PPT generation apps generally meet the "speed" requirement, they still suffer from the following issues:

- 1️⃣ Limited to preset templates with no flexibility to adjust styles.
- 2️⃣ Low degree of freedom, making multi-round revisions difficult.
- 3️⃣ Finished products look strikingly similar, with severe homogenization.
- 4️⃣ Low-quality assets that lack relevance and specificity.
- 5️⃣ Fragmented image-text layouts with poor design aesthetics.

These flaws make it difficult for traditional AI PPT generators to simultaneously satisfy our two core needs: "speed" and "beauty." Even those claiming to be "Vibe PPT" are, in my eyes, still far from being truly "Vibe."

However, the emergence of the nano banana🍌 model has changed everything. I experimented with 🍌pro for PPT page generation and found that the results were exceptional in terms of quality, aesthetics, and consistency. It can accurately render almost all text from the prompts and faithfully follow the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Quickly generate beautiful PPTs with zero threshold and no design experience required, reducing the hassle of template selection.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of text and image elements to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into lesson plan PPTs with illustrations to enhance classroom effectiveness.
4. **Students**: Quickly complete assignment presentations, focusing energy on content rather than layout and beautification.
5. **Professionals**: Rapidly visualize business proposals and product introductions, with quick adaptation to multiple scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly create beautiful and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technology Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Meals** | **The Evolution of Money: A Journey from Shells to Banknotes** |

</div>

For more, see <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Pathways

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to cater to different creative habits.
- **One-Sentence Generation**: Enter a topic, and the AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying the outline or descriptions via "Vibe" (e.g., "Change the third page to a case study"), with the AI adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual detail adjustment.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload files such as PDF, Docx, MD, Txt, etc., and the system will automatically parse the content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information within the text, providing rich materials for generation.
- **Style Reference**: Support uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="File Parsing and Material Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Editing

No longer limited by complex menus and buttons, issue modification commands directly using **natural language**.
- **Partial Modification**: Make verbal-style changes to areas you are unsatisfied with (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition pages with a consistent style based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-Box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX. Supports classic effects including Fade, Push, Pan, Wipe, Split, Blinds, Checkerboard, and Clock, with the ability to select multiple effects for random application.
- **Perfect Fit**: Default 16:9 aspect ratio. Layout requires no manual adjustments, ready for instant presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully editable PPTX export (Beta)

- **Export images as high-fidelity PPT pages with clean backgrounds and freely editable images and text**
- See related updates at https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explanation Videos

- **One-click conversion of slides into explainer videos (MP4) with AI voice narration and subtitles**
- AI automatically generates conversational narration based on page descriptions and content
- Supports configuration of multiple expression styles, languages, and voice tones

<br>

**🌟 Comparison with notebooklm slide deck**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Re-editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Freely add after generation** |
| Export Formats | Supports PDF, (non-editable image) pptx | **Export as PDF, (image or editable) pptx, explainer video** |
| Watermark | Watermark on free version | **No watermark, freely add/delete elements** |

> Note: This comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT via three paths: ideas, outlines, or page descriptions |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to individual PPT slides |
| ✅ Completed | Vibe verbal editing for selected areas on individual slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support for uploading and parsing multiple file formats |
| ✅ Completed | Support Vibe verbal adjustment for outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support for editable .pptx export with multi-layer and precise background removal |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narration video export (CN/EN/JP multi-voice support, subtitles, Ken Burns effect) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 Planned | Online playback functionality |
| 🧭 Planned | Simple animations and slide transition effects |
| 🚍 Partial | Multi-language support |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest way, with no need to install Docker or download the project. You can access the application directly after creation.

1. Deploy and start this application with one click via Rainyun (High bandwidth, suitable for HD image generation and downloading. New users get a 15-day free trial)
- [Image & Text Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose 🐳

Quickly start front-end and back-end services using Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure Docker is running (check the system tray icon for Windows or the menu bar icon for macOS), then follow the same steps as described in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also, ensure that ports **3000** and **5000** are not occupied.

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

**(Optional, can also be configured in the user interface after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink))** Edit the `.env` file to configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM interfaces in this project are based on the AIHubMix platform format. It is recommended to use [AIHubMix (click here for direct access)](https://aihubmix.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly Reminder: The Google nano banana pro model interface costs are high, please be mindful of your usage costs.**
```env

# AI Provider Format Configuration (gemini / openai / vertex)

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

# Select Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Provider API Keys (Only configure the providers you want to use)

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


**Use the new editable export configuration method for better results**: You need to obtain an API KEY from the [Baidu Intelligent Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter), and fill it into the `BAIDU_API_KEY` field in the `.env` file (it comes with a generous free usage quota). See the instructions in https://github.com/Anionex/banana-slides/issues/121 for details.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models through GCP service accounts, and new users can use the free credit quota. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant sections in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Starting the Service**

**⚡ Using Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch). You can skip the local build steps to achieve rapid deployment:

```bash

# Launch with Pre-built Images (No Need to Build from Scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, open **Settings → About → Check for Updates** in the app. The app compares the current version SHA with the latest available version; local source-code runs are checked with the current Git SHA as well.

**Build images from scratch**

```bash
docker compose up -d
```


> [!TIP]
> In case of network issues, you can uncomment the mirror source configurations in the `.env` file, and then rerun the startup command:
> ```env
> # Uncomment the following lines in the .env file to use domestic mirror sources
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```


3. **Accessing the Application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

4. **Viewing Logs**

```bash

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

You can also open **Settings → About → Check for Updates** first to see whether a newer version is available.

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

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing a [Deployment Tutorial for Newbies](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). It is specifically designed for beginners without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos; must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Refurbishment" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: Server-side rendering via LibreOffice may cause layout misalignment due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. LibreOffice is not required when uploading PDF files. For Docker users who still need to support PPTX uploads within the container, run:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed via this method will be lost after the container is rebuilt and will need to be reinstalled.

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

```bash
uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure environment variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then follow the previously mentioned method to open and edit the `.env` file to configure your API key

# AI Resource Navigation

<p align="center">
  <img src="logo.png" alt="AI Resource Navigation Logo" width="120">
</p>

<p align="center">
  A curated collection of high-quality AI resources, tools, tutorials, and the latest news from across the web. Dedicated to providing a one-stop learning and exploration platform for AI enthusiasts, developers, and practitioners.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/Update-Daily-brightgreen.svg" alt="Update Frequency">
  <a href="https://github.com/example/repo"><img src="https://img.shields.io/github/stars/example/repo.svg" alt="GitHub Stars"></a>
</p>

## Table of Contents

- [AI Basics](#ai-basics)
- [Large Language Models (LLM)](#large-language-models-llm)
- [AI Tools](#ai-tools)
- [AI Tutorials & Courses](#ai-tutorials--courses)
- [Prompt Engineering](#prompt-engineering)
- [AI Communities & News](#ai-communities--news)
- [Open Source Projects](#open-source-projects)

## AI Basics

Covers the fundamental theories of Artificial Intelligence, including Machine Learning, Deep Learning, Mathematics for AI, and more.

## Large Language Models (LLM)

Information and resources related to current mainstream Large Language Models (LLMs):
- **ChatGPT**: OpenAI's conversational AI model.
- **Claude**: Anthropic's high-performance AI model.
- **Gemini**: Google's next-generation multimodal model.
- **Llama**: Meta's open-source large language model series.

## AI Tools

### Image Generation
- **Midjourney**: A leading AI tool for high-quality image generation.
- **Stable Diffusion**: A powerful and flexible open-source image generation model.

### Coding Assistants
- **GitHub Copilot**: An AI-powered programming assistant integrated into your IDE.
- **Cursor**: An AI-native code editor designed for pair programming with AI.

### Productivity
- **Notion AI**: AI-driven writing and organization within Notion.
- **Otter.ai**: AI-powered meeting transcription and notes.

## AI Tutorials & Courses

Curated high-quality learning paths and educational content from platforms like Coursera, DeepLearning.AI, fast.ai, and various community guides.

## Prompt Engineering

Guides, techniques, and best practices for crafting effective prompts to optimize results from AI models.

## AI Communities & News

- **Communities**: Stay connected with other AI professionals via Reddit, Discord, and specialized forums.
- **News**: Stay updated with the latest trends through newsletters like The Batch and TLDR AI.

## Open Source Projects

A collection of notable and trending AI-related open-source projects on GitHub.

## Contribution Guide

Contributions are welcome! Please read our [Contribution Guidelines](CONTRIBUTING.md) for more details on how to get involved.

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

The frontend will automatically connect to the backend service at `http://localhost:5000`. If you need to modify it, please edit `src/api/client.ts`.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all stored in the uploads/ folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5000`.

Visit `http://localhost:5000/health` to verify if the service is running correctly.

#### Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3000`.

Open your browser to access the application.

## 🛠️ Technical Architecture

### Frontend Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Communication Group

To facilitate communication and mutual support, we have created this WeChat group.

Feel free to suggest new features or provide feedback; I will also answer questions in a ~~laid-back~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/0c94e62f-dc68-4b81-9ee8-f53f9ac656ee" />




Feel free to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.xiaohongshu.com/user/profile/62e8f580000000001902fc9d"><img src="https://img.shields.io/badge/小红书-Anion-FF2442?style=flat-square&logo=xiaohongshu&logoColor=white" alt="小红书"></a>
  <a href="https://space.bilibili.com/477162339"><img src="https://img.shields.io/badge/Bilibili-Anion-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Bilibili"></a>
</p>

## **🔧 FAQ**

See [Official Documentation](https://docs.bananaslides.online/zh/faq)

## 🤝 Contributing Guide

Welcome to contribute to this project through
[Issue](https://github.com/Anionex/banana-slides/issues)
and
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and may be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research;



<h2>🚀 Sponsor</h2>
<br>
<div align="center">
<a href="https://aihubmix.com/?aff=17EC">
  <img src="./assets/logo_aihubmix.png" alt="AIHubMix" style="height:48px;">
</a>
<p>Thanks to AIHubMix for sponsoring this project</p>
</div>


<div align="center">

 <br>

<a href="https://api.chatfire.site/login?inviteCode=A15CD6A0"><img width="200" alt="image" src="https://github.com/user-attachments/assets/d6bd255f-ba2c-4ea3-bd90-fef292fc3397" />
</a>


Thanks to <a href="https://api.chatfire.site/login?inviteCode=A15CD6A0">ChatFire</a> for sponsoring this project
 
</div>

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Support

Open source is not easy 🙏 If this project is valuable to you, you are welcome to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their selfless sponsorship and support:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon
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
