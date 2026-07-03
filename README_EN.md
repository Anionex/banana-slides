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
  <a href="https://github.com/Anionex/banana-slides"><img src="https://img.shields.io/badge/version-v0.9.0-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious formatting, just conversational editing. Step into the era of "Vibe PPT".</b>
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

## 🔥 Latest News

- **[2026-06-23]**: Page-by-page templates launched — Supports both single and multi-template modes. Upload images or PDFs to build a project template library. AI automatically parses template styles and provides one-click smart matching for each page, or manual binding page by page; supports seamless two-way switching between both modes ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — Adds full image editing, area selection editing (overlay/replace), and smart erasure modes on top of existing asset generation, providing a unified entry for one-stop operation.
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2k images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on the official OpenAI OAuth PKCE authorization flow, not reverse-engineered).
- **[2026-04-25]**: Supports saving custom text style description templates. Templates can be named, color-labeled, and persistently reused, eliminating the need for repeated manual entry.
- **[2026-04-23]**: Added support for the gpt-image-2 model. Editable background effects in exports have also been improved due to upgraded model capabilities (Select "Generative Acquisition" in Settings - Export Options - Background Acquisition).
- **[2026-04-11]**: Added support for [CLI operations and agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields, multi-aspect ratio settings, etc.
- **[2026-02-09]**: New features and optimizations
  * New Features
    * Supports pasting images in the homepage, outline, and description cards with immediate recognition and an improved interaction experience.
    * Manual outline chapter editing: Supports manually adjusting the chapter (part) a page belongs to.
    * Docker multi-architecture: Images support amd64 / arm64 builds.
    * Internationalization + Dark Mode: Added Chinese/English switching; supports Light/Dark/System themes; full component adaptation for Dark Mode.
  * Fixes and Experience Optimizations
    * Fixed export-related 500 errors, reference file association timing, outline/page data misalignment, incorrect task polling, infinite polling in description generation, image preview memory leaks, and partial failure handling in bulk deletions.
    * Optimized format example tips, HTTP error message copy, Modal closing experience, cleaned up old project localStorage, and removed redundant prompts for first-time project creation.
    * Various other optimizations and fixes.

## ✨ Project Origin

Have you ever found yourself in this predicament: a presentation is due tomorrow, but your slides are still blank; your mind is full of brilliant ideas, but all your enthusiasm is drained by tedious typesetting and design?

We long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the "speed" requirement, they still suffer from the following issues:

- 1️⃣ Limited to preset templates with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making multi-round revisions difficult 
- 3️⃣ Finished products look similar, with severe homogenization
- 4️⃣ Low-quality assets that lack relevance
- 5️⃣ Fragmented layout of text and images, resulting in poor design quality

These deficiencies make it difficult for traditional AI PPT generators to simultaneously meet our dual needs of "speed" and "aesthetics." Even those claiming to be "Vibe PPT" are, in my eyes, far from having enough "Vibe."

However, the emergence of the nano banana 🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were excellent in terms of quality, aesthetics, and consistency. Furthermore, it can accurately render almost all text requested in the prompts while following the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Zero barrier to quickly generating aesthetic PPTs without design experience, reducing the hassle of template selection.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of text and visual elements to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated PPT lesson plans to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing energy on content rather than layout and aesthetics.
5. **Workplace Professionals**: Quickly visualize business proposals and product introductions with fast adaptation to various scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, enabling everyone to quickly create aesthetic and professional presentations</b>
</p>

## 🎨 Example Results

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technology Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Meals** | **The Evolution of Money: A Journey from Shells to Paper Currency** |

</div>

See more at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Versatile Creation Paths

Supports three starting modes: **Idea**, **Outline**, and **Page Description** to suit different creative habits.
- **One-sentence Generation**: Enter a topic, and the AI will automatically generate a clearly structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying the outline or description via "Vibe" prompts (e.g., "change the third page to a case study"), with the AI adjusting in real-time.
- **Outline/Description Mode**: Allows for both one-click batch generation and manual fine-tuning of details.
- **Reliable Markdown Import**: The import dialog previews the number of recognizable pages before execution and appends pages all at once in file order, preventing formatting issues or sequence uncertainty when importing multiple pages.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload PDF/Docx/MD/Txt and other files, and the background will automatically parse the content.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information in the text to provide rich materials for generation.
- **Automatic Image Archiving**: Images parsed from documents will automatically enter the project asset library after the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Supports uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer restricted by complex menu buttons, issue modification commands directly using **natural language**.
- **Inpainting**: Make verbal-style modifications to unsatisfactory areas (e.g., "Change this chart to a pie chart").
- **Full-Page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.
- **Quality Control Mode**: Can be enabled in system settings or the preview page; it automatically checks for garbled text, low-quality visuals, and prompt deviation after generation. Only images that pass the inspection will be saved as new versions.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX. Supports classic effects such as Fade, Push, Pan, Wipe, Split, Blinds, Checkerboard, Clock, etc., with the option to randomly apply multiple selected effects.
- **Export File Management**: The preview page lists files already exported on the server, allowing for direct download or deletion of unnecessary files. Export task history is isolated and cleared by project to avoid accidental deletion of records from other projects. If a backend task becomes unavailable after refreshing, the task panel will clearly display a failure status and prompt for re-export.
- **Clearer Page Selection Export**: The selective page export now indicates missing image status based on the current selection range. Unselected draft pages will no longer gray out the export entry for selected completed pages. Explainer videos will only include pages without images if the placeholder frame option is explicitly checked.
- **Perfect Adaptation**: Default 16:9 aspect ratio requires no secondary layout adjustments; ready for direct presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Freely Editable PPTX Export (In Beta)

- **Export images as high-fidelity, clean-background PPT pages with freely editable images and text**
- Enable **Only Text Layers Editable** before export to generate a text-erased background while making only detected text editable. VLM verification checks whether the background still contains text; Banana Slides retries failed erasures and keeps the candidate with the fewest missed text regions. This option is off by default.
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-Click Explainer Video Export

- **One-click conversion of slides into explainer videos (MP4) with AI voiceovers and subtitles**
- AI automatically generates conversational narration based on page descriptions and content
- Supports configuration of multiple expression styles, languages, and voice tones

<br>

**🌟 Comparison with NotebookLM Slide Deck**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Secondary Editing | Modify via prompts | **Selection editing + Oral editing** |
| Adding Assets | Cannot add after generation | **Add freely after generation** |
| Export Formats | Supports PDF, (non-editable image) PPTX | **Export as PDF, (image or editable) PPTX, explainer video** |
| Watermark | Watermarked in free version | **No watermark, freely add/remove elements** |

> Note: This comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Create PPT via three paths: idea, outline, and page description |
| ✅ Completed | Parse Markdown-formatted images in text |
| ✅ Completed | Add more assets to single PPT slides |
| ✅ Completed | Vibe voice editing for selected areas on single slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing multiple file formats |
| ✅ Completed | Support Vibe voice adjustment for outlines and descriptions |
| ✅ Completed | Initial support for exporting editable .pptx files |
| 🔄 In Progress | Support editable .pptx export with multi-layer and precise image segmentation |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narration video export (Multi-timbre in CN/EN/JP, subtitles) |
| 🚍 Partial | Optimize front-end loading speed |
| 🧭 Planned | Online playback feature |
| 🧭 Planned | Simple animations and slide transitions |
| 🚍 Partial | Multi-language support |
| | |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest method; no Docker installation or project downloading is required. You can access the application directly after creation.


1. One-click deploy and launch this application via Rainyun (High bandwidth, ideal for HD image generation and downloading. Free trials available for new users).
- [Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose 🐳

Quickly start front-end and back-end services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure Docker is running (check the system tray icon on Windows or the menu bar icon on macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended). Also, ensure ports **3011** and **5011** are not occupied.

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

**(Optional, can also be configured in the user interface after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The large model interface in the project follows the AIHubMix platform format. It is recommended to use [AIHubMix (click here for direct access)](https://aihubmix.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly Reminder: Google Nano Banana Pro model interface costs are high; please be mindful of usage costs.**
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

# GCP Project and Service Account Key Required

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (Used when AI_PROVIDER_FORMAT=lazyllm)

# Select Providers for Text and Image Generation

```text
TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider
```

# API Keys for Each Provider (Only configure the ones you intend to use)

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


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (sufficient free quota is available). See the instructions in https://github.com/Anionex/banana-slides/issues/121 for details.


<details>
  <summary>📒 Vertex AI Configuration Guide (For GCP Users)</summary>

Google Cloud Vertex AI allows calling Gemini models via a GCP service account; new users can use free credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment relevant lines in `docker-compose.yml`, mount the key file into the container, and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

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

After startup, you can go to **Settings → About → Check for Updates** within the application. The app will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for determination.

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

```bash
docker logs --tail 100 banana-slides-frontend
```

5. **Stop Services**

```bash
docker compose down
```

6. **Update Project**

**Using Pre-built Images (docker-compose.prod.yml)**

You can also go to **Settings → About → Check for Updates** within the application to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable; you must first revert the code to the version it was at when pulled.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Deployment Tutorial for Beginners](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), which is specifically designed for novices without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting presentation videos; must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required for converting PPTX files to PDF when using the "PPT Revamp" feature with PPTX uploads. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: Server-side rendering with LibreOffice may result in layout misalignment due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully reproduce some special effects. LibreOffice is not required if uploading PDF files. Docker users who still need PPTX upload support within the container can run:
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

Run the following command in the project root directory:
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

# Then Install Python Dependencies

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, as described earlier, open and edit the `.env` file to configure your API key

# Paddle AI Suite (Paddle-Pipelines)

[![License](https://img.shields.io/badge/license-Apache%202-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/release/PaddlePaddle/Paddle-Pipelines.svg)](https://github.com/PaddlePaddle/Paddle-Pipelines/releases)
[![Documentation](https://img.shields.io/badge/docs-release-brightgreen.svg)](https://paddlepaddle.github.io/Paddle-Pipelines/)

Paddle-Pipelines is an end-to-end, low-code AI application development platform designed to help developers quickly build and deploy various AI pipelines, such as Retrieval-Augmented Generation (RAG), semantic search, and intelligent question answering.

## Core Features

- **End-to-End Pipelines**: Pre-configured with multiple mature AI scenario pipelines to support rapid application building.
- **Flexible and Extensible**: Based on a component-based design, supporting custom operators and workflow orchestration.
- **High-Performance Inference**: Integrated with Paddle Inference and Paddle Serving to ensure high throughput and low latency.
- **Low Barrier to Entry**: Provides RESTful APIs and a Web UI, requiring no deep understanding of underlying model details.

## Quick Start

### Installation

```bash
pip install paddle-pipelines
```

### Build a Simple RAG System

```python
from pipelines.pipelines import Pipeline
from pipelines.nodes import Retreiver, Generator

# Initialize retriever and generator
retriever = Retreiver(document_store=doc_store)
generator = Generator(model="ernie-3.5")

# Create pipeline
rag_pipeline = Pipeline()
rag_pipeline.add_node(component=retriever, name="Retriever", inputs=["Query"])
rag_pipeline.add_node(component=generator, name="Generator", inputs=["Retriever"])

# Run
prediction = rag_pipeline.run(query="What is PaddlePaddle?")
print(prediction)
```

## Documentation

For more detailed information, please refer to the [Official Documentation](https://paddlepaddle.github.io/Paddle-Pipelines/).

## License

This project follows the [Apache 2.0 License](LICENSE).

#### Front-end Installation

1. **Enter the frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure API address**

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`) via Vite proxy. To modify this, please set `BACKEND_PORT` in the `.env` file at the project root.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`  
> Note: Under default configuration, templates, assets, and final products are all stored in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify if the service is running correctly.

#### Start Front-end Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access the application.

## 🛠️ Technical Architecture

### Front-end Tech Stack

React 18 + TypeScript + Vite 5 + Zustand

### Backend Tech Stack

Python 3.10+ + Flask 3.0 + uv + SQLite

## Community Group

Feel free to suggest new features or provide feedback. I will also answer your questions in a ~~laid-back~~ manner.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/e5e48e68-8ed8-4889-9fed-60ffbb7523f9" />

Feel free to follow the author's social media, where I share updates about this project and information regarding AI:

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

Welcome to contribute to this project via 
[Issue](https://github.com/Anionex/banana-slides/issues) 
and 
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and is free for non-commercial use such as personal learning, research, experimentation, education, or non-profit scientific research activities;

For inquiries or cooperation intentions, please contact: davidyang042@gmail.com

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
      Ark Agent Plan limited-time 75% off subscription, <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">click the link to buy</a></p>
</a>
</div>

<!-- Note: For the English README, use this version: -->
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

## Acknowledgements

- Project contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsor

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Special thanks to the following friends for their generous sponsorship and support:
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
