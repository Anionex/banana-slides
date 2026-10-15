[//]: # "Banana Slides is an AI-native PPT generation app for creating editable presentations from ideas, outlines, documents, images, and custom templates. Features: prompt-to-slide generation, template control, material parsing, conversational editing, PPTX export, project history, and reproducible workflows. Quick Start / Install / Usage / Demo / API / Deploy / Architecture / Test / Screenshot guides are provided for local Docker deployment and online use."
<div align="center">

<p>
  <img src="./assets/hero.png" alt="Banana Slides — Vibe your way to great slides." width="860">
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
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><img src="https://img.shields.io/badge/version-v0.9.0--rc.7-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>A native AI PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious typesetting, edit via conversation, and step into the world of true "Vibe PPT"</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><b>💻 Desktop RC7</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment</b></a>
</p>
<p>
  If this project is helpful to you, please <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## ❤️ Sponsor

> Want to sponsor this project? Please send an email to davidyang042@gmail.com.

<details open>
<summary>Click to collapse</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> for sponsoring this project! AIHubMix is a stable, high-concurrency AI large model API aggregation platform. A single API Key provides access to mainstream models like Claude, GPT, Gemini, and DeepSeek, compatible with various protocols. For registration, international users please use the <a href="https://aihubmix.com/?aff=17EC">AIHubMix portal</a>, and mainland China users please use the <a href="https://inferera.com/?aff=17EC">Inferera portal</a>.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="火山引擎" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">Volcengine</a> for sponsoring this project! Compared to mainstream overseas official APIs, it offers lower prices, higher cost-effectiveness, and similar generation quality; direct connection within China, no special network environment required. Once subscribed, it can also be used for daily tasks and other compatible tools, not limited to Banana Slides.<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">View offers and subscribe →</a></td>
</tr>
</table>

</details>

## 🔥 Latest News

- **[2026-09-05]**: Release Candidate 7 of 0.9.0 is released, fixing the issue where Codex (OpenAI OAuth) is connected but image generation returns 400: the internal main model call has been updated from `gpt-5.4` to `gpt-5.6-terra`, while the image model remains `gpt-image-2` (no need to change the image model to a text model). This version also includes content-driven style descriptions and SenseNova U1 image generation support; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7)
- **[2026-08-30]**: Release Candidate 6 of 0.9.0 is released, adding a toggleable desktop startup update check, update cards with summaries and full log links, as well as download progress, failure retry, and restart to install; also fixed APIMart OpenAI-compatible async image tasks, non-streaming requests, and 1K/2K/4K resolution passing; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**: Release Candidate 5 of 0.9.0 is released, adding an immersive online slide player and APIMart OpenAI-compatible Provider presets. The desktop update check now correctly follows the RC channel. Improved MinerU credential error prompts for PPT renovation, fixed SSRF risks for remote images in reference documents, and set image editing to enter marquee selection state by default; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**: Release Candidate 4 of 0.9.0 is released, focusing on fixing the unavailability of LazyLLM online providers (qwen, etc.) and missing SOCKS proxy dependencies in the desktop packaged version. Restored the "Previous Step" button on the preview page to return to the description editing page; fixed export task modal overlay and desktop property drawer interaction; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**: Restored the "Previous Step" button on the preview page, allowing a one-click return from slide preview to the description editing page for further modifications.
- **[2026-08-20]**: Fixed the issue where the export task modal was blocked by the page property drawer; the desktop property drawer is now expanded by default and automatically adapts to the window width.
- **[2026-07-31]**: The desktop packaged version now fully registers 11 LazyLLM online providers (qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai), fixing the `Unsupported source: qwen` error in the packaged version.
- **[2026-08-06]**: Release Candidate 3 of 0.9.0 is released, focusing on fixing Volcengine Agent Plans configuration and credential recovery, and introducing outline stream isolation, in-place slide editing, Field Contract v2, template matching, and editable PPTX export improvements; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser caches, preserving valid presets and preventing abnormal cache from blocking the editing page.
- **[2026-07-11]**: Release Candidate 2 of 0.9.0 is released, including all capabilities of RC1, and fixing MinerU directory inconsistencies for editable PPTX on Windows desktop and FFprobe path errors for commentary videos; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Per-page templates launched — supports both unified template and independent per-page template modes. Users can upload images or PDFs to build project template libraries. AI automatically parses template styles and intelligently matches each page with one click, or allows manual binding page-by-page; supports seamless two-way switching between modes ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — added three new modes to the original asset generation: whole image editing, marquee editing (overlay/replace), and smart erasing, with a unified entry for one-stop operation.
- **[2026-04-25]**: Added support for official OpenAI OAuth login binding. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, not reverse engineered).
- **[2026-04-25]**: Support for saving custom text style description templates, which can be named, color-coded, and persisted for reuse without re-entering every time.
- **[2026-04-23]**: Supported the `gpt-image-2` model; meanwhile, the background effect for editable exports has been improved due to model capability upgrades (Select "Generative Retrieval" in Settings - Export Options - Background Retrieval).
- **[2026-04-11]**: Supported [CLI operations and added agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields, multi-aspect ratio settings, etc.

## ✨ Project Origins

Have you ever found yourself in this dilemma: a report is due tomorrow, but your PPT is still a blank slate; you have countless brilliant ideas in your head, but all your enthusiasm is drained by tedious layout and design?

I (we) long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the "speed" requirement, they still suffer from the following issues:

- 1️⃣ Only preset templates can be selected, with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making multi-round revisions difficult 
- 3️⃣ Similar-looking finished products with severe homogenization
- 4️⃣ Low material quality and a lack of specificity
- 5️⃣ Disconnected text and image layouts with a poor sense of design

These flaws make it difficult for traditional AI PPT generators to simultaneously meet our dual needs of "speed" and "aesthetics." Even those claiming to be "Vibe PPT" are, in my eyes, still far from being "Vibe" enough.

However, the emergence of the nano banana 🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were excellent in terms of quality, aesthetics, and consistency. It can precisely render almost all text required by the prompt and strictly follow the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Use Cases

1. **Beginners**: Quickly generate beautiful PPTs with zero threshold and no design experience required, reducing the hassle of template selection.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of text and graphic elements to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated PPT lesson plans to enhance classroom effectiveness.
4. **Students**: Quickly complete assignment presentations, focusing energy on content rather than layout and aesthetics.
5. **Workplace Professionals**: Quickly visualize business proposals and product introductions, with rapid adaptation to various scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly create beautiful and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technology Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Equipment for Ready-to-Eat Meal Production Lines** | **The Evolution of Money: A Journey from Shells to Paper Currency** |

</div>

See more in <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to suit various creative habits.
- **One-Sentence Generation**: Input a topic, and the AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Modify outlines or descriptions using conversational "Vibe" prompts (e.g., "Change the third page to a case study"), with the AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual refinement of details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload files such as PDF, Docx, MD, Txt, etc., and the backend will automatically parse the content.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information in the text to provide rich materials for generation.
- **Automatic Image Storage**: Images parsed from documents will automatically enter the project material library after the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Support uploading reference images or templates to customize PPT styles.

<img width="1920" height="1080" alt="File Parsing and Material Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Editing

No longer restricted by complex menu buttons, issue modification commands directly through **natural language**.
- **Local Inpainting**: Perform verbal modifications on specific areas (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Export Formats

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transitions before exporting to PPTX, supporting classic effects such as fade in/out.
- **Perfect Fit**: Default 16:9 aspect ratio, requiring no manual layout adjustments, ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="Export PPT and PDF" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Editable PPTX Export (In Beta Iteration)

- **Export images to high-fidelity PPT pages with clean backgrounds and freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Explainer Video Export

- **One-click conversion of slides into explainer videos (MP4) with AI voiceovers and subtitles**
- AI automatically generates natural, spoken-style narrations based on page descriptions and content
- Supports configuration of multiple expression styles, languages, and voice tones

<br>

**🌟 Comparison with NotebookLM Slide Deck Features**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Secondary Editing | Prompt-based modification | **Selection-based editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Add freely after generation** |
| Export Formats | Supports export to PDF, (non-editable image) pptx | **Export to PDF, (image or editable) pptx, explainer video** |
| Watermark | Watermark in free version | **No watermark, freely add/remove elements** |

> Note: Comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Vibe verbal editing for selected areas on a single PPT slide |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of multiple file formats |
| ✅ Completed | Support Vibe verbal adjustment of outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support exporting editable .pptx with multi-layer and precise background removal |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narration video export (Multi-timbre in CN/EN/JP, subtitles) |

## 📦 Usage

### (New) One-click deployment with application templates

This is the simplest method, as it requires no Docker installation or project downloading. You can access the application directly after creation.


1. One-click deployment and startup of this application via Rainyun (High bandwidth, suitable for HD image generation and downloading. Free trials available for new users)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Stay tuned

### Using Docker Compose 🐳

Quickly start front-end and back-end services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please first [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/), and ensure Docker is running (check the system tray icon on Windows; check the menu bar icon on macOS), then follow the same steps as described in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also ensure that ports **3011** and **5011** are not occupied.

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

**(Optional, you can also configure this via the user interface after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The Large Language Model (LLM) interfaces in this project follow the AIHubMix platform format. It is recommended to use [AIHubMix (click here to access)](https://api.inferera.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly Reminder: The Google nano banana pro model interface fees are relatively high; please be mindful of usage costs.**
```env

# AI Provider Configuration Format (gemini / openai / volcengine / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://api.inferera.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://api.inferera.com/v1

# SenseTime SenseNova U1 Image Model (Keep old Provider, images use OpenAI-compatible path)

# Recommendation: Continue using Gemini for text, route only images through SenseTime

# IMAGE_MODEL_SOURCE=openai

# IMAGE_API_KEY=your-sensenova-api-key

# IMAGE_API_BASE=https://token.sensenova.cn/v1

# IMAGE_MODEL=sensenova-u1.5-lite

# Volcengine Ark Agent Plans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

# Note: Agent Plan requires the use of a dedicated API Key and model names (doubao-seed-2.1-turbo / doubao-seedream-5.0-lite)

VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/plan/v3

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

# Vendor API Keys (Only configure the providers you want to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine / Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud / Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu AI GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime SenseNova

# U1 Please prioritize the above IMAGE_MODEL_SOURCE=openai configuration for image generation; this key is used for the legacy LazyLLM path.

MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
KIMI_API_KEY=your-kimi-api-key                # Moonshot AI Kimi
PPIO_API_KEY=your-ppio-api-key                # PPIO Cloud
AIPING_API_KEY=your-aiping-api-key            # AIPing
...
```

> Banana Slides explicitly packages the LazyLLM online provider SDKs used by domestic vendors:
> `volcengine-python-sdk[ark]` for Doubao, `dashscope` for Qwen/Wanxiang, and `zhipuai` for GLM/Zhipu.
> LazyLLM also exposes `lazyllm install online-advanced`, but the PyPI wheel may not publish that group as a standard install extra, so Docker/prebuilt images rely on these explicit dependencies instead.
>
> Desktop (PyInstaller) builds register every LazyLLM online vendor explicitly
> (qwen, doubao, deepseek, glm, kimi, minimax, sensenova, siliconflow, ppio,
> aiping, openai) so packaged backends never hit `Unsupported source: ...`.
  
</details>


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu Intelligent Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill in the `BAIDU_API_KEY` field in the `.env` file (there is a generous free usage quota). For more details, please refer to the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (For GCP Users)</summary>

Google Cloud Vertex AI allows calling Gemini models via a GCP service account, and new users can use the free trial credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If using Docker for deployment, you also need to uncomment the relevant lines in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Start the Service**

**⚡ Using Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch). You can skip the local build steps and achieve rapid deployment:

```bash

# Start with Pre-built Image (No need to build from scratch)

docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After starting, you can go to **Settings → About → Check for Updates** within the application. The app will determine if there are available updates based on the current version SHA; the current Git SHA will also be used for determination when running from source.

**Build Images from Scratch**

```bash
docker compose up -d
```


> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use mirror sources in China
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

5. **Stop Service**

```bash
docker compose down
```

6. **Update Project**

**Use Pre-built Images (docker-compose.prod.yml)**

You can also go to **Settings → About → Check for Updates** within the app first to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Use Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable; you need to revert the code to the version at the time of the pull first.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), which is specifically designed for beginners without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for narration video export, and must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when using the "PPT Revamp" feature to upload PPTX files, used to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading** because LibreOffice may cause layout shifts during server-side rendering due to missing fonts (e.g., Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. Uploading PDF files does not require LibreOffice. Docker users who still need to support PPTX uploads within the container can execute:
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

Run in the project root directory:
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

# Then, follow the previously described method to open and edit the `.env` file and configure your API key.

Since there was no content provided in the "Original content" section, I cannot provide a translation. Please provide the Chinese Markdown content you would like translated.

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

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` via Vite proxy (default `http://localhost:5011`). To modify this, please set `BACKEND_PORT` in the `.env` file at the project root directory.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and finished products are all stored in the uploads/ folder.

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

Open your browser to this address to use the application.

## Communication Group

Welcome to suggest new features or provide feedback in the group~


<img width="369" height="471" alt="image" src="https://github.com/user-attachments/assets/633db07a-e4e7-4511-a6c4-c9f196ef4a6c" />





Welcome to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>

## **🔧 FAQ**

See the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project via
[Issue](https://github.com/Anionex/banana-slides/issues)
and
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
It can be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research activities; authorization is required for closed-source commercial use.

If you have any questions, cooperation intentions, or wish to obtain the multi-tenant commercial version, please contact: davidyang042@gmail.com

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsorship

Open source is not easy 🙏 If you find this project valuable, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their selfless sponsorship and support of the project:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon, @刘星宇&小陀螺AIGC
> If you have any questions regarding the sponsorship list, please <a href="mailto:davidyang042@gmail.com">contact the author</a>

## 📈 Project Statistics

<a href="https://www.star-history.com/?type=timeline&legend=top-left&repos=Anionex%2Fbanana-slides">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&theme=dark&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
 </picture>
</a>

</a>

<br>

### Daily Reports and Backend Material Tasks

In the "One-sentence Generation" on the homepage, you can switch to "Daily Report" to select Weekly/Monthly Report, Project Report, Product Introduction, Training Courseware, or Custom Scenarios. After filling in the topic and optional fields, you can edit the Prompt preview, and then follow the original workflow for templates, reference files, aspect ratio, and per-page templates. Presets only fill in the blank fields; a manually edited preview is only rebuilt when clicking "Update Prompt from Form."

Selecting Codex directly in Settings will trigger an OpenAI login window if you are not connected. Once connected, the selection will be applied; canceling will retain the original settings. After submitting a task in the Asset Toolbox, you can continue to generate the next one. Each task displays its status and results independently, and can be restored after refreshing. If a query is paused, click "Continue Query" to resume; the results will still be saved to the Asset Library.
