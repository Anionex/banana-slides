[//]: # "Banana Slides is an AI-native PPT generation app for creating editable presentations from ideas, outlines, documents, images, and custom templates. Features: prompt-to-slide generation, template control, material parsing, conversational editing, PPTX export, project history, and reproducible workflows. Quick Start / Install / Usage / Demo / API / Deploy / Architecture / Test / Screenshot guides are provided for local Docker deployment and online use."
<div align="center">

<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/hero-light.png">
    <img src="./assets/hero-light.png" alt="Banana Slides — Vibe your way to great slides." width="860">
  </picture>
</p>
<p>
  <a href="https://trendshift.io/repositories/22056" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/badge-trendshift-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://trendshift.io/api/badge/repositories/22056">
      <img src="https://trendshift.io/api/badge/repositories/22056" alt="Anionex%2Fbanana-slides | Trendshift" width="265" height="58">
    </picture>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/Anionex/banana-slides" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&amp;claim_uid=CtDTm2jbUHhVGBr&amp;theme=dark">
      <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&amp;claim_uid=CtDTm2jbUHhVGBr&amp;theme=neutral">
      <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=c8a0ee51918e4353af08012b8472b85e&amp;claim_uid=CtDTm2jbUHhVGBr&amp;theme=neutral" alt="Featured｜HelloGitHub" width="265" height="58">
    </picture>
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
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><img src="https://img.shields.io/badge/version-v0.9.0--rc.7-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious formatting, edit through conversation, and step into the true "Vibe PPT".</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><b>💻 Desktop RC7</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Deployment Guide</b></a>
</p>
<p>
  If this project is helpful to you, feel free to <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

## ❤️ Sponsorship

> Want to sponsor this project? Please email davidyang042@gmail.com.

<details open>
<summary>Click to collapse</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">Special thanks to <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> for sponsoring this project! AIHubMix is a stable, high-concurrency AI large model API aggregation platform. A single API Key provides access to mainstream models like Claude, GPT, Gemini, and DeepSeek, supporting multiple protocols. When registering, international users please use the <a href="https://aihubmix.com/?aff=17EC">AIHubMix portal</a>, and mainland China users please use the <a href="https://inferera.com/?aff=17EC">Inferera portal</a>.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="火山引擎" width="189"></a></td>
<td valign="middle">Special thanks to <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">Volcengine</a> for sponsoring this project! Compared to mainstream overseas official APIs, it offers lower prices, higher cost-effectiveness, and similar generation quality; direct connection within China, no special network environment required. Once subscribed, it can be used for daily tasks and other compatible tools, not limited to Banana Slides.<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">View offers and subscribe →</a></td>
</tr>
</table>

</details>

## 🔥 Latest Updates

- **[2026-09-05]**: 0.9.0 Release Candidate 7 (RC7) released, fixing an issue where Codex (OpenAI OAuth) was connected but image generation returned a 400 error: Internal call main model updated from `gpt-5.4` to `gpt-5.6-terra`; the image model remains `gpt-image-2`, so there is no need to change the image model to a text model. This version also includes content-driven style descriptions and SenseNova U1 image generation support added after RC6; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7)
- **[2026-08-30]**: 0.9.0 Release Candidate 6 (RC6) released, adding a toggleable desktop startup update check, update cards with update summaries and full log links, as well as download progress, failure retry, and restart installation; also fixed APIMart OpenAI-compatible asynchronous image tasks, non-streaming requests, and 1K/2K/4K resolution passing; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**: 0.9.0 Release Candidate 5 (RC5) released, adding an immersive online slide player and APIMart OpenAI-compatible Provider presets; desktop update checks now correctly follow the RC channel; improved MinerU credential error prompts for PPT reconstruction, fixed SSRF risks for remote images in reference documents, and set image editing to enter selection state by default; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**: 0.9.0 Release Candidate 4 (RC4) released, focusing on fixing the unavailability of LazyLLM online providers (qwen, etc.) in the packaged desktop version and missing SOCKS proxy dependencies; restored the "Previous" button on the preview page to return to the description editor; fixed export task popup blocking and desktop property drawer interaction; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**: Restored the "Previous" button on the preview page, allowing one-click return from slide preview to the description editing page for further modifications.
- **[2026-08-20]**: Fixed the issue where the export task popup was obscured by the page property drawer; the desktop page property drawer now expands by default and automatically adapts to the window width.
- **[2026-07-31]**: The packaged desktop version now fully registers 11 LazyLLM online providers (qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai), fixing the `Unsupported source: qwen` error in the packaged version.
- **[2026-08-06]**: 0.9.0 Release Candidate 3 (RC3) released, focusing on fixing Volcengine Agent Plans configuration and credential recovery, and bringing improvements to outline stream isolation, in-place slide editing, Field Contract v2, template matching, and editable PPTX export; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser cache, retaining valid presets to prevent abnormal cache from blocking the editing page.
- **[2026-07-11]**: 0.9.0 Release Candidate 2 (RC2) released, including all capabilities of RC1 and fixing inconsistent MinerU directories for editable PPTX on Windows desktop and incorrect FFprobe paths for explanation videos; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Page-by-page templates launched — supports two modes: Unified Template / Independent Page Template. You can upload images or PDFs to build a project template library; AI automatically analyzes template styles and provides smart matching for each page with one click, or you can bind them manually page by page. Bidirectional switching between modes is available at any time ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — adds three modes: full image editing, selection editing (overlay/replace), and smart erasure to the original asset generation, with a unified entry point for one-stop operation.
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth login. Once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, not a reverse engineering solution).
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and reused persistently without re-entering every time.
- **[2026-04-23]**: Supported the `gpt-image-2` model; meanwhile, editable background effects for export have been improved due to model capability upgrades (Select "Generative Acquisition" in Settings - Export Options - Background Acquisition).
- **[2026-04-11]**: Supported [CLI operations and added Agent Skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields and multi-ratio settings.

## ✨ Project Origin

Have you ever found yourself in this dilemma: a presentation is due tomorrow, but the slides are still blank? You have countless brilliant ideas, yet your enthusiasm is drained by tedious layout and design work.

We long to quickly create professional and aesthetically pleasing presentations. While traditional AI PPT generation apps generally satisfy the need for speed, they still suffer from the following issues:

- 1️⃣ Limited to preset templates with no flexibility to adjust styles.
- 2️⃣ Low degree of freedom, making iterative changes difficult to execute.
- 3️⃣ Similar visual outcomes, resulting in severe homogenization.
- 4️⃣ Low-quality assets that lack relevance and specificity.
- 5️⃣ Fragmented text-image layouts with poor design aesthetics.

These flaws make it difficult for traditional AI PPT generators to simultaneously satisfy the twin demands of "speed" and "beauty." Even those claiming to be "Vibe PPTs" fall far short of being truly "Vibe" in my eyes.

However, the emergence of the **nano banana🍌** model has changed everything. I experimented with using 🍌pro to generate PPT slides and found that the results were exceptional in terms of quality, aesthetics, and consistency. It accurately renders almost all text specified in the prompt while strictly adhering to the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Quickly generate aesthetic PPTs with zero barrier to entry, requiring no design experience and reducing the hassle of template selection.
2. **PPT Professionals**: Quickly gain design inspiration by referencing AI-generated layouts and combinations of text and graphic elements.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete assignment presentations, focusing effort on content rather than layout and beautification.
5. **Business Professionals**: Quickly visualize business proposals and product introductions, with rapid adaptation to various scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, enabling everyone to quickly create aesthetic and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technology Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Dishes** | **The Evolution of Money: A Journey from Shells to Banknotes** |

</div>

More available at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes: **Idea**, **Outline**, and **Page Description**, catering to different creative habits.
- **One-Sentence Generation**: Enter a topic, and the AI automatically generates a well-structured outline and page-by-page content descriptions.
- **Natural Language Editing**: Supports modifying outlines or descriptions via "Vibe" prompts (e.g., "Change page three to a case study"), with real-time AI responses and adjustments.
- **Outline/Description Mode**: Supports both one-click batch generation and manual adjustment of details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload PDF, Docx, MD, Txt, and other file formats; the backend automatically parses the content.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information in the text to provide rich materials for generation.
- **Automatic Image Storage**: Images parsed from documents will automatically enter the project material library once the reference files are associated, enabling direct reuse later.
- **Style Reference**: Support for uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe" Style Natural Language Editing

No longer restricted by complex menu buttons, issue modification commands directly through **natural language**.
- **Local Redraw**: Make verbal modifications to unsatisfactory areas (e.g., "change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, style-consistent pages based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Export Formats

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transitions before exporting to PPTX, supporting classic effects like fade-in/out.
- **Perfect Fit**: Default 16:9 aspect ratio; no manual layout adjustments required—ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Freely Editable PPTX Export (Beta in progress)

- **Export images to high-fidelity, clean-background PPT slides with freely editable images and text**
- See related updates at https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export Explainer Video

- **One-click conversion of slides into explainer videos (MP4) with AI voiceover and subtitles**
- AI automatically generates natural, spoken narration based on page descriptions and content
- Supports configuration of multiple expression styles, languages, and voice tones

<br>

**🌟 Feature Comparison with NotebookLM Slide Deck**
| Feature | NotebookLM | This Project | 
| --- | --- | --- |
| Max Pages | 15 pages | **No limit** | 
| Secondary Editing | Prompt-based modification | **Selection editing + Voice-based editing** |
| Asset Addition | Cannot add after generation | **Freely add after generation** |
| Export Formats | Supports PDF, (non-editable image) pptx | **Export to PDF, (image or editable) pptx, Explainer Video** |
| Watermark | Watermarked in free version | **No watermark, freely add/remove elements** |

> Note: This comparison may become outdated as new features are added.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Add more assets to a single PPT slide |
| ✅ Completed | Vibe voice-based editing for box-selected areas on a single PPT slide |
| ✅ Completed | Asset module: Asset generation, uploading, etc. |
| ✅ Completed | Support for uploading and parsing multiple file types |
| ✅ Completed | Support for Vibe voice-based adjustment of outlines and descriptions |
| ✅ Completed | Initial support for exporting editable .pptx files |
| 🔄 In Progress | Support for editable .pptx export with multi-layer, precise background removal |
| 🔄 In Progress | Web search |
| 🔄 In Progress | Agent mode |
| ✅ Completed | TTS narration video export (Multi-voice in CN/EN/JP, subtitles) |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest method. No Docker installation or project downloading is required. You can access the application immediately after creation.


1. One-click deployment and startup via Rainyun (High bandwidth, suitable for HD image generation and downloads. Free trials available for new users)
- [Image and Text Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Coming soon

### Using Docker Compose🐳

Quickly start frontend and backend services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure that Docker is running (check the system tray icon on Windows or the menu bar icon on macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also, ensure that ports **3011** and **5011** are not occupied.

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

**(Optional, can also be configured in the UI after startup; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink)).** Edit the `.env` file to configure necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The Large Language Model (LLM) interfaces in this project follow the AIHubMix platform format. It is recommended to use [AIHubMix (click here for direct access)](https://api.inferera.com/?aff=17EC) to obtain an API key to reduce migration costs.**<br>
> **Friendly Reminder: The API costs for the Google Nano/Banana Pro models are relatively high; please be mindful of usage costs.**
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

# SenseTime SenseNova U1 Image Model (Retain old Provider, images follow OpenAI compatible path)

# Recommendation: Continue Using Gemini for Text, Use SenseTime Only for Images

# IMAGE_MODEL_SOURCE=openai

# IMAGE_API_KEY=your-sensenova-api-key

# IMAGE_API_BASE=https://token.sensenova.cn/v1

# IMAGE_MODEL=sensenova-u1.5-lite

# Volcengine Ark Agent Plans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

# Note: Agent Plan requires a dedicated API Key and model names (doubao-seed-2.1-turbo / doubao-seedream-5.0-lite)

VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/plan/v3

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

# Vendor API Keys (Only configure the providers you want to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine / Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud / Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime SenseNova

# U1 For image generation, please prioritize using the IMAGE_MODEL_SOURCE=openai configuration above; this key is used for the legacy LazyLLM path.

MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
KIMI_API_KEY=your-kimi-api-key                # Moonshot Kimi
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


**Use the new editable export configuration method to get better editable export results**: You need to obtain the API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter), and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is sufficient free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP Users)</summary>

Google Cloud Vertex AI allows calling Gemini models through GCP service accounts; new users can use promotional credits. Configuration steps:

1. Go to [GCP Console](https://console.cloud.google.com/), create a service account and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If deploying with Docker, you also need to uncomment the relevant sections in `docker-compose.yml`, mount the key file into the container, and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> `gemini-3-*` series models require `VERTEX_LOCATION=global`

</details>

2. **Start Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synced with the latest version of the main branch), which allows skipping the local build steps for rapid deployment:

```bash

# Start with Pre-built Images (No Need to Build from Scratch)

docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can navigate to **Settings → About → Check for Updates** within the application. The application will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for determination.

**Build images from scratch**

```bash
docker compose up -d
```


> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then rerun the startup command:
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

**Using pre-built images (docker-compose.prod.yml)**

You can also check for new versions within the app by going to **Settings → About → Check for Updates**.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using local build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable; you must first revert the code to the version it was when pulled.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to our excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing a [deployment tutorial for beginners](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md). It is specifically designed for novices without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos, and must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when using the "PPT Renovation" feature to upload PPTX files, used for converting PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: When rendering on the server side, LibreOffice may cause layout misalignment due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore some special effects. LibreOffice is not required if uploading PDF files directly. Docker users who still need PPTX upload support within the container can execute:
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

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, following the previously mentioned method, open and edit the `.env` file to configure your API key.

I cannot provide a translation because no Chinese Markdown content was provided in the "Original content" section. Please provide the text you would like translated, and I will be happy to assist you while following all your formatting and technical requirements.

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

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`) via Vite proxy. If you need to modify it, please set `BACKEND_PORT` in the `.env` file at the project root directory.

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

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access the application.

## Communication Group

Welcome to suggest new features or provide feedback in the group~


<img width="369" height="471" alt="image" src="https://github.com/user-attachments/assets/633db07a-e4e7-4511-a6c4-c9f196ef4a6c" />





Welcome to follow the author's social media, where I share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>

## **🔧 Frequently Asked Questions**

See the [Official Documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Contributions to this project via [Issue](https://github.com/Anionex/banana-slides/issues) and [Pull Request](https://github.com/Anionex/banana-slides/pulls) are welcome!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)** and can be freely used for non-commercial purposes such as personal learning, research, testing, education, or non-profit scientific research activities; authorization is required for closed-source commercial use.

For any questions, partnership inquiries, or to obtain the multi-tenant commercial version, please contact: davidyang042@gmail.com

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Appreciation

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Grateful for the generous sponsorship and support from the following friends:
> @雅俗共赏, @曹峥, @以年观日, @John, @胡yun星Ethan, @azazo1, @刘聪NLP, @🍟, @苍何, @万瑾, @biubiu, @law, @方源, @寒松Falcon, @刘星宇&小陀螺AIGC
> If you have any questions about the sponsorship list, please <a href="mailto:davidyang042@gmail.com">contact the author</a>

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

### Daily Reports and Backend Asset Tasks

On the homepage's "One-sentence Generation," you can switch to "Routine Reporting" and select Weekly/Monthly Report, Project Report, Product Introduction, Training Courseware, or Custom Scenario. After filling in the topic and optional fields, you can edit the Prompt preview and then follow the original template, reference files, aspect ratio, and per-page template workflow. Presets only fill in the blank fields; the manually edited preview will only be rebuilt when clicking "Update Prompt from Form."

Selecting Codex directly in the settings will trigger an OpenAI login window if not connected. Once connected successfully, the current selection will be applied; if canceled, the original settings will be retained. After submitting a task in the Asset Toolbox, you can continue generating the next one. Each task independently displays its status and results, and the query can be restored after refreshing. If a query is paused, you can click "Continue Query," and the results will still be saved to the Asset Library.
