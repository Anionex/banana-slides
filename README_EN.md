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
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><img src="https://img.shields.io/badge/version-v0.9.0--rc.7-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>A native AI PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious formatting, just conversational revisions—moving towards a true "Vibe PPT"</b>
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
  If this project is helpful to you, feel free to <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

The public demo provides fixed model configurations for Inferera, APIMart, and Volcengine Agent Plan, with API keys isolated by visitor. The public version does not provide project history; please save the preview page link for future access. Extra field configurations for descriptions are fixed, while the body text and generation requirements remain editable. Various service tests on the settings page can run simultaneously, displaying results separately. Site owners can set `PUBLIC_DEMO_ADMIN_PASSWORD` in `.env` and view history via the `/admin/history` password entry. See [Public Demo Usage and Migration Instructions](docs/zh/public-demo.mdx).

## ❤️ Sponsorship

> Want to sponsor this project? Please send an email to davidyang042@gmail.com.

<details open>
<summary>Click to collapse</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> for sponsoring this project! AIHubMix is a stable, high-concurrency AI large model API aggregation platform. A single API Key provides access to mainstream models like Claude, GPT, Gemini, and DeepSeek, compatible with multiple protocols. When registering, overseas users please use the <a href="https://aihubmix.com/?aff=17EC">AIHubMix portal</a>, and users in Mainland China please use the <a href="https://inferera.com/?aff=17EC">Inferera portal</a>.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://go.apimart.ai/gh-banana-slides"><img src="./assets/logo_apimart.png" alt="APIMart" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://go.apimart.ai/gh-banana-slides">APIMart</a> for sponsoring this project! APIMart is a low-cost API platform focused on AI image/video generation, with GPT-Image-2 as low as $0.006 per image—1 USD can generate 160+ images. A single set of asynchronous APIs handles both images and videos: submit tasks to get IDs and use callbacks to retrieve results. Batch process tens of thousands of images without timeouts, and switch models without changing code. Pay-as-you-go, no monthly fees. Register via this <a href="https://go.apimart.ai/gh-banana-slides">registration link</a> to start using it.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="Volcengine" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">Volcengine</a> for sponsoring this project! Compared to mainstream official overseas APIs, it offers lower prices, higher cost-effectiveness, and similar generation results. It provides direct connection within China, requiring no special network environment. Once subscribed, it can be used for daily use and other compatible tools, not limited to Banana Slides.<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">View offers and subscribe →</a></td>
</tr>
</table>

</details>

## 🔥 Latest Updates

- **[2026-09-05]**: 0.9.0 Release Candidate 7 released, fixing the issue where Codex (OpenAI OAuth) returned 400 for image generation despite being connected: internal main model calls updated from `gpt-5.4` to `gpt-5.6-terra`, while keeping the image model as `gpt-image-2` (no need to change the image model to a text model). This version also includes content-driven style descriptions after RC6 and SenseNova U1 image generation support; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7)
- **[2026-08-30]**: 0.9.0 Release Candidate 6 released, adding a toggleable desktop startup update check, update cards with summaries and full log links, as well as download progress, failure retry, and restart installation; also fixed APIMart OpenAI-compatible asynchronous image tasks, non-streaming requests, and 1K/2K/4K resolution passing; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**: 0.9.0 Release Candidate 5 released, adding an immersive online slide player and APIMart OpenAI-compatible Provider presets; desktop update checks now correctly follow RC channels; improved MinerU credential error prompts for PPT reconstruction, fixed SSRF risks for remote images in reference documents, and set image editing to enter selection mode by default; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**: 0.9.0 Release Candidate 4 released, focusing on fixing the unavailability of LazyLLM online providers (e.g., qwen) and missing SOCKS proxy dependencies in the desktop packaged version; restored the "Previous" button on the preview page to return to the description editing page, fixed export task popup blocking, and desktop attribute drawer interactions; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**: Restored the "Previous" button on the preview page, allowing one-click return from slide preview to the description editing page for further modifications.
- **[2026-08-20]**: Fixed the issue where the export task popup was obscured by the page attribute drawer; the desktop page attribute drawer now expands by default and automatically adapts to window width.
- **[2026-07-31]**: Fully registered 11 LazyLLM online providers (qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai) in the desktop packaged version, fixing the `Unsupported source: qwen` error.
- **[2026-08-06]**: 0.9.0 Release Candidate 3 released, focusing on fixing Volcengine Agent Plans configuration and credential recovery, and introducing outline stream isolation, in-place slide editing, field contract v2, template matching, and editable PPTX export improvements; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser caches, retaining valid presets and preventing abnormal cache from blocking the editing page.
- **[2026-07-11]**: 0.9.0 Release Candidate 2 released, including all capabilities from RC1, and fixing inconsistent MinerU directories for editable PPTX on Windows desktop and FFprobe path errors for narration videos; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Page-by-page templates launched — supporting two modes: Unified Template and Independent Template per page. Users can upload images or PDFs to build project template libraries. AI automatically parses template styles and intelligently matches each page, or users can bind them manually. Both modes support two-way switching at any time ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — added full-image editing, selection editing (overlay/replace), and smart erase modes on top of existing asset generation, providing a unified entry for one-stop operations.
- **[2026-04-25]**: Supports login and account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, non-reverse engineered).
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and persistently reused, eliminating the need to re-enter them every time.
- **[2026-04-23]**: Supported the `gpt-image-2` model; meanwhile, editable background export effects have been improved due to model upgrades (select "Generative Acquisition" in Settings - Export Options - Background Acquisition).
- **[2026-04-11]**: Supported [CLI operations and added agent skills](https://docs.bananaslides.online/cli)
- **[2026-03]**: Added several features and optimizations, such as additional fields and multi-aspect ratio settings.

## ✨ Project Origins

Have you ever found yourself in this dilemma: a presentation is due tomorrow, yet your slides remain blank? You have countless brilliant ideas, but your enthusiasm is drained by tedious layout and design work.

We all long to create presentations that are both professional and aesthetically pleasing. While traditional AI PPT generation apps generally meet the need for speed, they still suffer from the following issues:

- 1️⃣ Only able to choose from preset templates, with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making multi-round revisions difficult
- 3️⃣ Finished products look similar, resulting in severe homogenization
- 4️⃣ Low-quality assets that lack relevance
- 5️⃣ Disconnected text and image layouts with a poor sense of design

These flaws make it difficult for traditional AI PPT generators to simultaneously satisfy our dual needs for "speed" and "beauty." Even those claiming to be "Vibe PPT" are, in my eyes, far from having that true "Vibe."

However, the emergence of the nano banana🍌 model has changed everything. I tried using 🍌pro for PPT page generation and found that the results were excellent in terms of quality, aesthetics, and consistency. It can accurately render almost all text requested in the prompts while strictly following the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Novices**: Rapidly generate aesthetic PPTs with zero threshold and no design experience, eliminating the stress of template selection.
2. **PPT Professionals**: Quickly gain design inspiration by referencing AI-generated layouts and combinations of text and graphic elements.
3. **Educators**: Swiftly convert teaching content into illustrated lesson plan PPTs to improve classroom engagement.
4. **Students**: Rapidly complete presentation assignments, focusing efforts on content rather than layout and design.
5. **Business Professionals**: Quickly visualize business proposals and product introductions, with fast adaptation across multiple scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, empowering everyone to quickly produce beautiful and professional presentations</b>
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

### 1. Flexible and Diverse Creative Paths

Supports three starting methods—**Ideas**, **Outlines**, and **Page Descriptions**—to accommodate different creative workflows.
- **One-Sentence Generation**: Simply input a topic, and the AI will automatically generate a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Modify outlines or descriptions using natural language prompts (e.g., "Change page three to a case study"), with the AI responding and adjusting in real-time.
- **Outline/Description Mode**: Choose between one-click batch generation or manual refinement of specific details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other files for automatic background content parsing.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information from the text to provide rich materials for generation.
- **Automatic Image Storage**: Images parsed from documents are automatically added to the project's material library once the reference files are linked, enabling direct reuse later.
- **Style Reference**: Supports uploading reference images or templates to customize PPT styles.

<img width="1920" height="1080" alt="File Parsing and Material Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Modification

No longer restricted by complex menu buttons, issue modification commands directly through **natural language**.
- **Partial Redraw**: Make verbal-style modifications to specific areas (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition pages with consistent styling based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transitions before exporting to PPTX, supporting classic effects like fade in/out.
- **Seamless Compatibility**: Default 16:9 aspect ratio, no need for secondary layout adjustments, ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Freely editable pptx export (Beta in progress)

- **Export images to high-fidelity PPT pages with clean backgrounds and freely editable images and text**
- See https://github.com/Anionex/banana-slides/issues/121 for related updates
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export Explainer Video

- **One-click conversion of slides into explainer videos (MP4) with AI voice narration and subtitles**
- AI automatically generates spoken-style narration based on page descriptions and content
- Supports configuration of various expression styles, multiple languages, and diverse voice personas

<br>

**🌟 Comparison with notebooklm slide deck features**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Page limit | 15 pages | **Unlimited** | 
| Further editing | Prompt-based modification | **Selection editing + Voice-based editing** |
| Adding assets | Cannot add after generation | **Freely add after generation** |
| Export formats | Supports PDF, (non-editable image) pptx | **Export as PDF, (image or editable) pptx, explainer video** |
| Watermark | Watermarked in free version | **No watermark, freely add/remove elements** |

> Note: As new features are added, this comparison may become outdated

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Vibe verbal editing for selected regions on a single PPT slide |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support for uploading and parsing multiple file formats |
| ✅ Completed | Support for Vibe verbal adjustment of outlines and descriptions |
| ✅ Completed | Initial support for exporting editable pptx files |
| 🔄 In Progress | Support for exporting editable pptx with multi-layer and precise background removal |
| 🔄 In Progress | Web search |
| 🔄 In Progress | Agent mode |
| ✅ Completed | TTS explanation video export (Multi-voice in CN/EN/JP, subtitles) |

## 📦 Usage

### (New) One-click Deployment Using Application Templates

This is the simplest method; no need to install Docker or download the project. You can access the application directly after creation.


1. Deploy and start this application with one click via RainYun (High bandwidth, suitable for HD image generation and downloading. Free trials available for new users)
- [Image-text Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![One-click deployment via RainYun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Stay tuned

### Using Docker Compose 🐳

Quickly start front-end and back-end services using Docker Compose.

<details>
  <summary>📒 Notes for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure that Docker is running (check the system tray icon on Windows or the menu bar icon on macOS), then follow the same steps in the documentation.

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

**(Optional, you can also configure it in the UI after startup; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file to configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM API in this project follows the AIHubMix platform format. It is recommended to use [AIHubMix (click here to access)](https://api.inferera.com/?aff=17EC) to obtain API keys to minimize migration costs.**<br>
> **Friendly Reminder: The Google Nano Banana Pro model API costs are high, please be mindful of usage costs.**
```env

# AI Provider Configuration (gemini / openai / volcengine / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://api.inferera.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://api.inferera.com/v1

# SenseTime SenseNova U1 Image Model (Keep old Provider, images use OpenAI compatible path)

# Recommendation: Continue Using Gemini for Text, Use SenseTime Only for Images

# IMAGE_MODEL_SOURCE=openai

# IMAGE_API_KEY=your-sensenova-api-key

# IMAGE_API_BASE=https://token.sensenova.cn/v1

# IMAGE_MODEL=sensenova-u1.5-lite

# Volcengine Ark Agent Plans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

# Note: Agent Plan requires using an exclusive API Key and model names (doubao-seed-2.1-turbo / doubao-seedream-5.0-lite)

VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/plan/v3

# Vertex AI Configuration (AI_PROVIDER_FORMAT=vertex)

# GCP Project and Service Account Key Required

# VERTEX_PROJECT_ID=your-gcp-project-id

# VERTEX_LOCATION=global

# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm Format Configuration (used when AI_PROVIDER_FORMAT=lazyllm)

# Select Providers for Text and Image Generation

```text
TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider
```

# API Keys for Each Provider (Only configure the providers you intend to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine/Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud/Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime SenseNova

# U1 For image generation, please prioritize using the IMAGE_MODEL_SOURCE=openai configuration above; this Key is used for the legacy LazyLLM path.

MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
KIMI_API_KEY=your-kimi-api-key                # Moonshot AI Kimi
PPIO_API_KEY=your-ppio-api-key                # PPIO
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


**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is a generous free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (For GCP Users)</summary>

Google Cloud Vertex AI allows calling Gemini models via GCP service accounts, and new users can utilize free trial credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant sections in `docker-compose.yml`, mount the key file into the container, and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Start Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch). You can skip the local build steps to achieve rapid deployment:

```bash

# Launch with Pre-built Images (No need to build from scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can go to **Settings → About → Check for Updates** within the app. The application will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for determination.

**Build Images from Scratch**

```bash
docker compose up -d
```


> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then rerun the startup command:
> ```env
> # Uncomment the following in the .env file to use mirror sources
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

**Using pre-built images (docker-compose.prod.yml)**

You can also go to **Settings → About → Check for Updates** within the application to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using local build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable. You must first revert the code to the pulled version.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), which is specifically designed for beginners with no server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos, and must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Refurbishment" feature, used for converting PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading**, because LibreOffice may cause layout issues during server-side rendering due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore certain special effects. Uploading PDF files does not require LibreOffice. For Docker users who still need PPTX upload support within the container, run:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost if the container is rebuilt and must be reinstalled.

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

This will automatically install all dependencies according to `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, as previously described, open and edit the `.env` file to configure your API key.

## Core Features

*   **Multi-model Selection**: Integrated with various AI models including ChatGPT, Claude, Google Gemini, Ollama, etc., to meet the needs of different scenarios.
*   **One-click Summary**: Automatically extract core viewpoints from web pages to save reading time.
*   **Smart Q&A**: Deep dialogue based on the current webpage content to answer any of your questions.
*   **Code Highlighting**: Supports syntax highlighting for multiple programming languages, making it convenient for developers to read.
*   **Multi-language Support**: Supports 20+ mainstream languages.
*   **Privacy & Security**: Your data is encrypted, and custom API Keys are supported to ensure privacy and security.

## Quick Start

1.  **Install Extension**: Download and install from the [Chrome Web Store](https://chrome.google.com/webstore).
2.  **Configure Model**: Click the plugin icon and enter your API Key or configure the local Ollama service in the settings page.
3.  **Start Chatting**: Open any webpage and click the sidebar icon to start using it.

<p align="center">
  <a href="https://github.com/example/repo/stargazers"><img src="https://img.shields.io/github/stars/example/repo" alt="Stars"></a>
  <a href="https://github.com/example/repo/issues"><img src="https://img.shields.io/github/issues/example/repo" alt="Issues"></a>
  <a href="https://github.com/example/repo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/example/repo" alt="License"></a>
</p>

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

#### Start backend service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under default configuration, templates, assets, and finished products are all located in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Visit `http://localhost:5011/health` to verify that the service is running correctly.

#### Start the frontend development server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access and use the application.

## Communication Group

Welcome to suggest new features or provide feedback in the group!

<img width="312" alt="image" src="https://github.com/user-attachments/assets/d4392639-3b5b-4e53-bccd-60b5028d6def" />







Welcome to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>

## **🔧 Frequently Asked Questions**

See the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project through 
[Issue](https://github.com/Anionex/banana-slides/issues) 
and 
[Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 
It can be freely used for non-commercial purposes such as personal learning, research, experimentation, education, or non-profit scientific research activities; commercial use for closed-source projects requires authorization.

If you have any questions, cooperation intentions, or wish to obtain the multi-tenant commercial version, please contact: davidyang042@gmail.com

## Acknowledgements

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Donation

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their voluntary sponsorship and support:
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
