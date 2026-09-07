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
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><img src="https://img.shields.io/badge/version-v0.9.0--rc.7-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>An AI-native PPT generation application based on nano banana pro 🍌</b><br>
  <b>Go from idea to presentation in minutes—no tedious formatting, edit via conversation—moving towards true "Vibe PPT"</b>
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 Online Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 Documentation</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7"><b>💻 Desktop RC7</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>Usage Guide</b></a>
</p>
<p>
  If this project is helpful to you, please feel free to <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

The public demo provides fixed model configurations for Inferera, APIMart, and Volcengine Agent Plan, with API Keys isolated by visitor. The public version has no history list, so save the preview page link to return later. Extra description fields are fixed, while the description body and generation requirements remain editable. Service tests in Settings can run concurrently and show their results separately. Site owners can set `PUBLIC_DEMO_ADMIN_PASSWORD` in `.env` and view history through the password-protected `/admin/history` entry point. See the [Public Demo Usage and Migration Guide](docs/public-demo.mdx).

## ❤️ Sponsor

> Want to sponsor this project? Please send an email to davidyang042@gmail.com.

<details open>
<summary>Click to collapse</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> for sponsoring this project! AIHubMix is a stable, high-concurrency AI large model API aggregation platform. A single API Key provides access to mainstream models such as Claude, GPT, Gemini, and DeepSeek, and is compatible with multiple protocols. For registration, overseas users please use the <a href="https://aihubmix.com/?aff=17EC">AIHubMix entry</a>, and mainland China users please use the <a href="https://inferera.com/?aff=17EC">Inferera entry</a>.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://go.apimart.ai/gh-banana-slides"><img src="./assets/logo_apimart.png" alt="APIMart" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://go.apimart.ai/gh-banana-slides">APIMart</a> for sponsoring this project! APIMart is a low-cost API platform specializing in AI image/video generation. GPT-Image-2 is as low as $0.006/image, meaning $1 can generate over 160 images. A single set of asynchronous APIs covers both images and videos: submit tasks to get an ID and use callbacks to retrieve results. Batch processing of tens of thousands of images won't time out, and switching models requires no code changes. Pay-as-you-go with no monthly fees. Register via this <a href="https://go.apimart.ai/gh-banana-slides">registration link</a> to get started.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="Volcengine" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">Volcengine</a> for sponsoring this project! Compared to mainstream overseas official APIs, it offers lower prices and higher cost-effectiveness with similar generation results. It supports direct connection within China without requiring a special network environment. After subscribing, it can also be used for daily tasks and other compatible tools, not limited to Banana Slides.<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">View offers and subscribe →</a></td>
</tr>
</table>

</details>

## 🔥 Latest Updates

- **[2026-09-05]**: Release Candidate 7 (v0.9.0-rc.7) is out, fixing an issue where Codex (OpenAI OAuth) returns a 400 error despite being connected: updated the internal main model call from `gpt-5.4` to `gpt-5.6-terra`. The image model remains `gpt-image-2` without needing to be changed to a text model. This version also includes content-driven style descriptions and SenseNova U1 image generation support; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7)
- **[2026-08-30]**: Release Candidate 6 (v0.9.0-rc.6) is out, adding a toggleable desktop startup update check, update cards with summaries and full log links, download progress, failure retries, and restart-to-install; also fixed APIMart OpenAI-compatible asynchronous image tasks, non-streaming requests, and 1K/2K/4K resolution passing; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**: Release Candidate 5 (v0.9.0-rc.5) is out, adding an immersive online slide player and APIMart OpenAI-compatible Provider presets. The desktop update check now correctly follows the RC channel. Improved MinerU credential error prompts for PPT transformation, fixed SSRF risks for remote images in reference documents, and set image editing to enter selection mode by default; [View download and installation instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**: Release Candidate 4 (v0.9.0-rc.4) is out, focusing on fixing unavailable LazyLLM online providers (qwen, etc.) and missing SOCKS proxy dependencies in the desktop packaged version. Restored the "Previous" button on the preview page to return to the description editing page, fixed the export task overlay occlusion, and improved desktop property drawer interactions; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**: Restored the "Previous" button on the preview page, allowing one-click return from slide preview to the description editing page for further modifications.
- **[2026-08-20]**: Fixed the issue where the export task popup was blocked by the page property drawer; the desktop page property drawer now expands by default and automatically adapts to the window width.
- **[2026-07-31]**: The desktop packaged version now fully registers 11 LazyLLM online providers (qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai), fixing the `Unsupported source: qwen` error in the packaged version.
- **[2026-08-06]**: Release Candidate 3 (v0.9.0-rc.3) is out, focusing on fixing Volcengine Agent Plans configuration and credential recovery, while introducing outline stream isolation, in-place slide editing, Field Contract v2, template matching, and editable PPTX export improvements; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser caches, retaining valid presets and preventing abnormal cache from blocking the editing page.
- **[2026-07-11]**: Release Candidate 2 (v0.9.0-rc.2) is out, including all features from RC1 and fixing MinerU directory inconsistencies for editable PPTX on Windows desktop, as well as FFprobe path errors for narration videos; [One-click download and install](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Per-page templates launched — supports two modes: unified template or independent templates per page. Users can upload images or PDFs to build a project template library. AI automatically parses template styles and intelligently matches them to each page, or they can be manually bound page-by-page. Supports seamless two-way switching between the two modes ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — adds three new modes to the existing asset generation: Full Image Edit, Selection Edit (overlay/replace), and Smart Erase, providing a unified entry point for one-stop operations.
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth. Once bound, Codex can be used directly as a text/image generation provider without manually filling in API Keys. Plus accounts can generate 100+ 2K images every five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, not reverse engineering).
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and persistently reused without re-entering every time.
- **[2026-04-23]**: Added support for the `gpt-image-2` model; meanwhile, editable background effects for export have been improved due to model upgrades (Select "Generative Acquisition" in Settings - Export Options - Background Acquisition).
- **[2026-04-11]**: Added support for [CLI operations and integrated agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields and multi-aspect ratio settings.

## ✨ Project Origin

Have you ever found yourself in this predicament: you have a presentation tomorrow, but the PPT is still blank; your mind is full of brilliant ideas, but your enthusiasm is drained by tedious layout and design?

We long for the ability to quickly create professional and well-designed presentations. Traditional AI PPT generation apps, while generally satisfying the need for "speed," still suffer from the following issues:

- 1️⃣ Limited to preset templates, unable to adjust styles flexibly
- 2️⃣ Low degree of freedom, making multi-round revisions difficult
- 3️⃣ Similar-looking outputs with severe homogenization
- 4️⃣ Low material quality and lack of specificity
- 5️⃣ Disconnected text and image layout with poor design sense

These shortcomings make it difficult for traditional AI PPT generators to simultaneously meet our dual requirements of "speed" and "aesthetics." Even those claiming to be "Vibe PPT" are, in my view, far from being "Vibe" enough.

However, the emergence of the nano banana 🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the quality, aesthetics, and consistency of the results were exceptional. It can accurately render almost all text requested in the prompts and strictly follow the style of reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Quickly generate beautiful PPTs with zero barrier; no design experience required, reducing the hassle of choosing templates.
2. **PPT Professionals**: Reference AI-generated layouts and combinations of graphic elements to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Quickly complete presentation assignments, focusing effort on content rather than layout and aesthetics.
5. **Business Professionals**: Quickly visualize business proposals and product introductions with rapid adaptation to various scenarios.

<p>
  <b>🎯Goal: Lower the barrier to PPT creation, enabling everyone to quickly create beautiful and professional presentations</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Equipment for Prepared Meals** | **The Evolution of Money: A Journey from Shells to Paper Currency** |

</div>

View more at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to accommodate different creative habits.
- **One-sentence generation**: Enter a topic, and the AI automatically generates a clear outline and page-by-page content descriptions.
- **Natural language editing**: Supports modifying the outline or description using "Vibe" prompts (e.g., "Change page three to a case study"), with real-time AI response and adjustment.
- **Outline/Description mode**: Supports both one-click batch generation and manual adjustment of details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capabilities

- **Multi-format Support**: Upload files in PDF, Docx, MD, Txt, and other formats; the system automatically parses content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information within the text to provide rich material for generation.
- **Automatic Image Storage**: Images extracted from documents will be automatically added to the project material library once the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Support uploading reference images or templates to customize PPT styles.

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style Natural Language Editing

No longer limited by complex menu buttons; issue modification commands directly via **natural language**.
- **Partial Redrawing**: Perform conversational edits on specific areas (e.g., "change this chart to a pie chart").
- **Full-Page Optimization**: Generate high-definition pages with a unified style based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX, supporting classic effects like fade-in and fade-out.
- **Perfect Fit**: Default 16:9 aspect ratio, no manual adjustments needed, ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT and PDF export" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Editable PPTX Export (Beta Iteration)

- **Export images as high-fidelity, clean-background PPT pages with freely editable images and text**
- See related updates at https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explainer Videos

- **One-click conversion of slides into presentation videos (MP4) with AI voice narration and subtitles**
- AI automatically generates spoken narration based on page descriptions and content
- Supports configuration of various expression styles, multiple languages, and diverse voice tones

<br>

**🌟 Comparison with NotebookLM Slide Deck Features**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Post-editing | Prompt-based modification | **Selection editing + Verbal editing** |
| Adding Assets | Cannot add after generation | **Free to add after generation** |
| Export Formats | PDF, (non-editable image) pptx | **PDF, (image or editable) pptx, presentation video** |
| Watermark | Watermarked in free version | **No watermark, freedom to add/delete elements** |

> Note: As new features are added, this comparison may become outdated.

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Add more assets to single PPT slides |
| ✅ Completed | Vibe verbal editing for selected areas on single PPT slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of multiple file types |
| ✅ Completed | Support Vibe verbal adjustments for outlines and descriptions |
| ✅ Completed | Preliminary support for exporting editable .pptx files |
| 🔄 In Progress | Support editable .pptx export with multi-layer and precise matting |
| 🔄 In Progress | Web Search |
| 🔄 In Progress | Agent Mode |
| ✅ Completed | TTS narrated video export (Multi-voice in CN/EN/JP, subtitles) |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest way. No Docker installation or project download required; you can access the application directly after creation.

1. One-click deployment and startup of this application via Rainyun (High bandwidth, suitable for HD image generation and downloading. Free trials available for new users)
- [Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Stay tuned

### Using Docker Compose🐳

Quickly start frontend and backend services via Docker Compose.

<details>
  <summary>📒 Instructions for Windows/Mac Users</summary>

If you are using **Windows or macOS**, please [install **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/) first and ensure that Docker is running (check the system tray icon on Windows or the menu bar icon on macOS), then follow the same steps in the documentation.

> **Tip**: If you encounter issues, Windows users should enable the **WSL 2 backend** in Docker Desktop settings (recommended); also, ensure that ports **3011** and **5011** are not in use.

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

**(Optional, can also be configured in the UI after startup, [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink ))** Edit the `.env` file and configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **Large language model interfaces in the project follow the AIHubMix platform format as standard. It is recommended to use [AIHubMix (click here to access directly)](https://api.inferera.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Friendly Tip: Google nano banana pro model interface costs are relatively high, please be mindful of usage costs.**
```env

```
</details>

# AI Provider Format Configuration (gemini / openai / volcengine / vertex)

AI_PROVIDER_FORMAT=gemini

# Gemini Format Configuration (Used when AI_PROVIDER_FORMAT=gemini)

GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com

# Proxy Example: https://api.inferera.com/gemini

# OpenAI Format Configuration (Used when AI_PROVIDER_FORMAT=openai)

OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Proxy Example: https://api.inferera.com/v1

# SenseTime SenseNova U1 Image Model (Keep old Provider, Images via OpenAI Compatible Path)

# Recommendation: Continue using Gemini for text, route only images through SenseTime

# IMAGE_MODEL_SOURCE=openai

# IMAGE_API_KEY=your-sensenova-api-key

# IMAGE_API_BASE=https://token.sensenova.cn/v1

# IMAGE_MODEL=sensenova-u1.5-lite

# Volcengine Ark Agent Plans Configuration (Used when AI_PROVIDER_FORMAT=volcengine)

# Note: Agent Plan requires an exclusive API Key and model name (doubao-seed-2.1-turbo / doubao-seedream-5.0-lite)

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

# API Keys for Various Providers (Only configure the provider(s) you intend to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine/Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud/Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu AI GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime SenseNova

# U1 For image generation, please prioritize using the above IMAGE_MODEL_SOURCE=openai configuration; this Key is used for the legacy LazyLLM path.

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

**Use the new editable export configuration method to get better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter), and fill it into the `BAIDU_API_KEY` field in the `.env` file (there is sufficient free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.


<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models via GCP service accounts; new users can use free trial credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If using Docker deployment, you also need to uncomment the relevant sections in `docker-compose.yml` to mount the key file into the container and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Start Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synchronized with the latest version of the main branch), which allows you to skip local build steps for rapid deployment:

```bash

# Start with Pre-built Images (No need to build from scratch)

docker compose -f docker-compose.prod.yml up -d
```

Image Names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After startup, you can go to **Settings → About → Check for Updates** within the application. The app will determine if an update is available based on the current version SHA; when running from source, the current Git SHA will also be used for the check.

**Build images from source**

```bash
docker compose up -d
```

> [!TIP]
> If you encounter network issues, you can uncomment the mirror source configurations in the `.env` file and then run the startup command again:
> ```env
> # Uncomment the following in the .env file to use domestic (China) mirror sources
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

# View Backend Logs (Last 200 lines)

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

You can also go to **Settings → About → Check for Updates** within the application to see if a new version is available.

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Using Local Build (docker-compose.yml)**

Note: If you have manually modified the code, this method is not applicable. You must first revert the code to the version at the time of pulling.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), specifically designed for beginners with no server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting video lectures, and must include support for the `libass` / `ass` subtitle filter
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Renovation" feature to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: When rendering on the server side, LibreOffice may cause layout misalignment due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully reproduce some special effects. Uploading PDF files does not require LibreOffice. Docker users who still need PPTX upload support within the container can execute:
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > Note: LibreOffice installed this way will be lost after container reconstruction and must be reinstalled.

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

# Then, follow the previously described method to open and edit the `.env` file and configure your API key.

# 🚀 Deploy Your LobeChat with One Click

If you want to deploy your own LobeChat, you can use the following methods:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flobehub%2Flobe-chat&env=OPENAI_API_KEY&env=ACCESS_CODE&project-name=lobe-chat&repository-name=lobe-chat)
[![Deploy with Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/VZGGTI)
[![Deploy with Sealos](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dlobe-chat)
[![Docker Release](https://img.shields.io/docker/v/lobehub/lobe-chat?color=2496ed&label=docker&logo=docker&logoColor=fff)](https://hub.docker.com/r/lobehub/lobe-chat)

### A. Deploy with Vercel (Recommended)

Vercel is the preferred platform for LobeChat deployment. It is free for individuals, supports automatic CI/CD, and requires no server maintenance.

1.  **Fork this repository** to your GitHub account.
2.  **Click the "Deploy with Vercel" button** above to enter the deployment page.
3.  **Configure Environment Variables**:
    *   `OPENAI_API_KEY`: Your OpenAI API Key.
    *   `ACCESS_CODE`: The password used to access LobeChat (recommended for security).
4.  **Click Deploy** and wait for the build to complete. Once finished, you can access it via the assigned domain.

### B. Deploy with Docker

We provide an official Docker image, which you can deploy using the following command:

```bash
docker run -d -p 3210:3210 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e ACCESS_CODE=lobe666 \
  lobehub/lobe-chat
```

### C. Other Deployment Methods

*   **Zeabur**: Click the "Deploy with Zeabur" button to quickly deploy to the Zeabur platform.
*   **Sealos**: Click the "Deploy with Sealos" button for one-click deployment to the Sealos cloud ecosystem.

---

> [!NOTE]
> Please ensure that you have correctly configured the `OPENAI_API_KEY` and other necessary environment variables. For more detailed configuration options, please refer to the [Environment Variables Documentation](https://github.com/lobehub/lobe-chat/wiki/Environment-Variables).

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

The frontend will automatically connect via Vite proxy to the backend service specified by `BACKEND_PORT` (default `http://localhost:5011`). To modify this, please set `BACKEND_PORT` in the `.env` file at the project root directory.

#### Start Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, assets, and outputs are all located in the `uploads/` folder.

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

Open your browser and visit the address to use the application.

## Community Groups

Feel free to suggest new features or provide feedback in the group!

<img width="312" alt="image" src="https://github.com/user-attachments/assets/8f2ed8a0-dde5-4b79-8402-10c0c89c8c68" />






Feel free to follow the author's social media, where I will share information about this project and AI:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>

## **🔧 FAQ**

Refer to the [official documentation](https://docs.bananaslides.online/zh/faq)

You can also ask questions directly on DeepWiki 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>

## 🤝 Contributing Guide

Welcome to contribute to this project via [Issue](https://github.com/Anionex/banana-slides/issues) and [Pull Request](https://github.com/Anionex/banana-slides/pulls)!

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**, and can be freely used for non-commercial purposes such as personal learning, research, testing, education, or non-profit scientific research activities; a license is required for closed-source commercial use.

For any inquiries, cooperation interests, or to obtain the multi-tenant commercial version, please contact: davidyang042@gmail.com

## Acknowledgements

- Project contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsorship

Open source is not easy 🙏 If this project is valuable to you, feel free to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their generous sponsorship and support:
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
