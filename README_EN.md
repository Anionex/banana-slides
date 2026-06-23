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
  <b>Go from idea to presentation in minutes—no tedious formatting, just verbal requests for changes. Moving towards a true "Vibe PPT".</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If this project is helpful to you, please give it a <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

---

<p align="center">
  <a href="https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=banana-slides">
    <img src="./assets/atlas-cloud-logo.png" alt="Atlas Cloud" width="200">
  </a>
</p>

> 🎁 **[Atlas Cloud](https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=banana-slides)** serves both the **nano-banana image model family** and OpenAI-compatible LLMs — exactly matching Banana Slides' two cores: image generation and text generation. Set `AI_PROVIDER_FORMAT=atlascloud` and **a single key drives both**: images go through the Atlas async Media API (`google/nano-banana/text-to-image`, auto-switching to `google/nano-banana/edit` when reference images are provided), while text / captions use the OpenAI-compatible endpoint.
>
> 🖼️ Full image / video model list: [atlascloud.ai/models](https://www.atlascloud.ai/models) · 🤖 LLM-friendly plan: [coding plan](https://www.atlascloud.ai/console/coding-plan)

```env
AI_PROVIDER_FORMAT=atlascloud
ATLASCLOUD_API_KEY=<atlascloud-api-key>
ATLASCLOUD_API_BASE=https://api.atlascloud.ai/v1
ATLASCLOUD_MEDIA_API_BASE=https://api.atlascloud.ai/api/v1/model
IMAGE_MODEL=google/nano-banana/text-to-image
TEXT_MODEL=deepseek-ai/deepseek-v4-pro
```

<details>
<summary>nano-banana image models on Atlas Cloud</summary>

Text-to-image:
- `google/nano-banana/text-to-image`
- `google/nano-banana-2/text-to-image`
- `google/nano-banana-pro/text-to-image`
- `google/nano-banana-pro/text-to-image-ultra`

Image-to-image / edit:
- `google/nano-banana/edit`
- `google/nano-banana-2/edit`
- `google/nano-banana-2/reference-to-image`
- `google/nano-banana-2/reference-to-image-developer`
- `google/nano-banana-pro/edit`
- `google/nano-banana-pro/edit-ultra`

See the full image / video model list at [atlascloud.ai/models](https://www.atlascloud.ai/models).

</details>

---

## 🔥 Latest Updates

- **[2026-04-25]**: Asset Toolbox launched — Added three new modes based on original asset generation: full-image editing, marquee editing (overlay/replace), and smart erasure, providing a unified one-stop operation.
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, non-reverse engineering).
- **[2026-04-25]**: Supports saving custom text style description templates. They can be named, color-coded, and persistently reused, eliminating the need for re-entry.
- **[2026-04-23]**: Added support for the gpt-image-2 model. Editable background effects during export have also been improved due to upgraded model capabilities (Select "Generative Retrieval" in Settings -> Export Options -> Background Retrieval).
- **[2026-04-11]**: Supported [CLI operations and integrated agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields, multi-aspect ratio settings, etc.
- **[2026-02-09]**: New Features and Optimizations
  * New Features
    * Support for pasting images on the home page, outlines, and description cards for immediate recognition, providing a better interactive experience.
    * Manual outline chapter editing: Supports manual adjustment of the chapter (part) a page belongs to.
    * Docker multi-architecture: Images now support amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese/English switching; support for Light/Dark/Follow System themes; full component adaptation for Dark Mode.
  * Fixes and Experience Optimizations
    * Fixed export-related 500 errors, reference file association timing, outline/page data misalignment, task polling errors, infinite polling in description generation, image preview memory leaks, and partial failure handling in batch deletion.
    * Optimized format example hints, HTTP error message copy, Modal closing experience, cleaned up legacy project localStorage, and removed redundant prompts for first-time project creation.
    * Various other optimizations and fixes.

## ✨ Project Origin

Have you ever found yourself in this dilemma: you have a presentation due tomorrow, but the PPT is still blank; you have countless brilliant ideas in your head, yet your passion is drained by tedious layout and design?

We long to quickly create presentations that are both professional and design-oriented. While traditional AI PPT generation apps generally meet the need for "speed," several issues persist:

- 1️⃣ Only preset templates can be chosen, with no flexibility to adjust styles.
- 2️⃣ Low degree of freedom, making multi-round revisions difficult.
- 3️⃣ Finished products look similar, leading to severe homogenization.
- 4️⃣ Low-quality assets that lack relevance.
- 5️⃣ Disconnected image-text layouts with a poor sense of design.

These flaws make it difficult for traditional AI PPT generators to satisfy our dual needs for "speed" and "aesthetics" simultaneously. Even those claiming to be "Vibe PPT" are, in my opinion, still far from being truly "Vibe."

However, the emergence of the nano banana🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were exceptional in terms of quality, aesthetics, and consistency. It accurately renders almost all text from the prompts and faithfully follows the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Use Cases

1. **Novices**: Generate beautiful PPTs quickly with zero barrier and no design experience, reducing the hassle of template selection.
2. **PPT Professionals**: Use AI-generated layouts and element combinations as references to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing energy on content rather than layout and beautification.
5. **Professionals**: Quickly visualize business proposals and product introductions with fast adaptation across multiple scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly create beautiful and professional presentations</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Dishes** | **The Evolution of Money: A Journey from Shells to Banknotes** |

</div>

See more <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Ideas**, **Outlines**, and **Page Descriptions**—to accommodate different creative habits.
- **One-Sentence Generation**: Enter a topic, and AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying the outline or descriptions using natural language (e.g., "Change page 3 to a case study"), with AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual detail adjustments.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other file formats for automatic background content parsing.
- **Intelligent Extraction**: Automatically identifies key points, image links, and chart information within the text to provide rich materials for generation.
- **Automatic Image Storage**: Images extracted from documents are automatically added to the project asset library once the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Supports uploading reference images or templates to customize PPT styles.

<img width="1920" height="1080" alt="File Parsing and Asset Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer restricted by complex menu buttons, issue modification commands directly through **natural language**.
- **Partial Regeneration**: Perform verbal-style modifications on unsatisfactory areas (e.g., "change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX. Supports classic effects such as Fade, Push, Pan, Wipe, Split, Blinds, Checkerboard, and Clock, with the option to multi-select for random application.
- **Perfect Fit**: Default 16:9 aspect ratio; layout requires no secondary adjustments, ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT and PDF Export" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully editable PPTX export (In Beta)

- **Export images as high-fidelity, clean-background PPT slides with freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explanation Videos

- **One-click conversion of slides into explainer videos (MP4) with AI voiceover and subtitles**
- AI automatically generates natural, spoken-style narrations based on page descriptions and content
- Supports configuration of multiple speaking styles, languages, and diverse voice options

<br>

**🌟 Comparison with notebooklm slide deck features**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Secondary Editing | Prompt-based modification | **Selection-based editing + Verbal editing** |
| Adding Assets | Cannot add after generation | **Add freely after generation** |
| Export Formats | Supports PDF, (non-editable image) pptx | **Export as PDF, (image or editable) pptx, Explainer Video** |
| Watermark | Watermark in free version | **No watermark, freely add/remove elements** |

> Note: As new features are added, the comparison may become outdated.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT from three paths: idea, outline, and page description |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Region selection and Vibe voice editing for single PPT slides |
| ✅ Completed | Asset module: asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of multiple file formats |
| ✅ Completed | Support Vibe voice adjustment of outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support for editable .pptx export with multi-layering and precise matting |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | Export TTS-narrated videos (multi-voice in Chinese/English/Japanese, subtitles) |
| 🚍 Partial | Optimize frontend loading speed |
| 🧭 In Planning | Online playback functionality |
| 🧭 In Planning | Simple animations and page transition effects |
| 🚍 Partial | Multi-language support |
| | |

## 📦 Usage

### (New) One-click Deployment Using Application Templates

This is the simplest way. No need to install Docker or download the project; you can access the application directly after creation.

1. Deploy and start this application with one click via Rainyun (High bandwidth, suitable for HD image generation and downloading. Free trial available for new users)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun with one click](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose🐳

Quickly start frontend and backend services using Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please first [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) and ensure that Docker is running (Windows users can check the system tray icon; macOS users can check the menu bar icon), then follow the same steps as described in the documentation.

> **Tip**: If you encounter any issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also ensure that ports **3011** and **5011** are not currently occupied.

</details>

0. **Clone the Repository**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **Configure Environment Variables**

Create a `.env` file (refer to `.env.example`):
```bash
cp .env.example .env
```

**(Optional, can also be configured in the user interface after startup; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink))** Edit the `.env` file and configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The large model interfaces in this project follow the AIHubMix platform format. It is recommended to use [AIHubMix (click here to access)](https://aihubmix.com/?aff=17EC) to obtain an API key and reduce migration costs.**<br>
> **Friendly reminder: The interface costs for Google Nano and Banana Pro models are relatively high; please be mindful of the invocation costs.**
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

# GCP Project and Service Account Key Required

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Select Providers for Text and Image Generation

TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider

# Vendor API Keys (Only configure the vendors you want to use)

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


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain the API KEY from the [Baidu Intelligent Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is sufficient free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via GCP service accounts; new users can use free credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment relevant sections in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> `gemini-3-*` series models require `VERTEX_LOCATION=global`

</details>

2. **Start the Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch), allowing you to skip local build steps for rapid deployment:

```bash

# Start with Pre-built Images (No need to build from scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can go to **Settings → About → Check for Updates** within the application. The app will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for the determination.

**Build images from scratch**

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

# View Front-end Logs (Last 100 Lines)

docker logs --tail 100 banana-slides-frontend
```

5. **Stop Service**

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

Note: If you have manually modified the code, this method is not applicable; you need to revert the code to the version it was when pulled first.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing a [Deployment Tutorial for Newcomers](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), specifically designed for beginners with no server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos; must include `libass` / `ass` subtitle filter support
- Valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Refurbishment" feature, used to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: LibreOffice may cause layout displacement during server-side rendering due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore certain special effects. LibreOffice is not required if you upload PDF files. For Docker users who still need PPTX upload support within the container, run:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost when the container is rebuilt and must be reinstalled.

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

Run the following command in the project root directory:
```bash

# macOS (Homebrew)

```bash
brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full
```

# Ubuntu / Debian

```markdown
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

# Then follow the aforementioned method to open and edit the `.env` file and configure your API key

# LangChain-ChatChat

[![Python](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/chatchat-space/LangChain-ChatChat/blob/master/LICENSE)

🌍 [中文](README.md) | [English](README_en.md)

## Introduction

**LangChain-ChatChat** (formerly Langchain-ChatGLM)

An open-source, offline-deployable Retrieval-Augmented Generation (RAG) large language model knowledge base solution, implemented based on large language models like ChatGLM and application frameworks like Langchain.

### Core Features

- **Multiple Modes**: Supports Local Knowledge Base QA, Search-Enhanced QA, and Intelligent Agent QA.
- **LLM Support**: Supports various LLMs including ChatGLM, Llama, Qwen, Baichuan, etc., with support for local deployment or API calls.
- **Knowledge Base Management**: Supports multiple document formats (PDF, Word, Markdown, Excel, etc.), supporting full-text search and vector search.
- **Easy Deployment**: Supports one-click Docker deployment and multi-platform support for Windows, Linux, and macOS.

## Quick Start

### 1. Environment Preparation

First, ensure that your machine has a Python 3.8+ environment installed.

```bash
# Clone the project
git clone https://github.com/chatchat-space/LangChain-ChatChat.git
cd LangChain-ChatChat

# Install dependencies
pip install -r requirements.txt
```

### 2. Initialize Knowledge Base

```bash
python copy_config_example.py
python init_database.py --recreate-vs
```

### 3. Start the Project

```bash
python startup.py -a
```

## Architecture Diagram

<img src="docs/img/architecture.png" width="800">

## Contact Us

If you have any questions, feel free to reach out via GitHub Issues or scan the QR code below to join our WeChat group:

<img src="docs/img/wechat_group.png" width="200">

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

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` via Vite proxy (default: `http://localhost:5011`). To modify this, please set `BACKEND_PORT` in the `.env` file in the project root directory.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all stored in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Access `http://localhost:5011/health` to verify that the service is running correctly.

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access and use the application.

## 🛠️ Technical Architecture

### Front-end Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Communication Group

Welcome to suggest new features or provide feedback; I will also answer your questions ~~at my own pace~~.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/2e59082b-b311-40f9-adbe-15dcc897af72" />



Welcome to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.xiaohongshu.com/user/profile/62e8f580000000001902fc9d"><img src="https://img.shields.io/badge/小红书-Anion-FF2442?style=flat-square&logo=xiaohongshu&logoColor=white" alt="小红书"></a>
  <a href="https://space.bilibili.com/477162339"><img src="https://img.shields.io/badge/Bilibili-Anion-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Bilibili"></a>
</p>

## **🔧 Frequently Asked Questions**

See the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project via [Issue](https://github.com/Anionex/banana-slides/issues) and [Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and can be freely used for non-commercial purposes such as personal study, research, experimentation, education, or non-profit scientific research;

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

 <br>

<a href="https://api.chatfire.site/login?inviteCode=A15CD6A0"><img width="200" alt="image" src="https://github.com/user-attachments/assets/d6bd255f-ba2c-4ea3-bd90-fef292fc3397" />
</a>


Thanks to AI Huobao for sponsoring this project
 
</div>

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Support

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their generous sponsorship and support:
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
