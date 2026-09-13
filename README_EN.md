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
  <b>From ideas to presentations in minutes—no tedious formatting, conversational editing, moving towards the true "Vibe PPT"</b>
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

The public demo provides fixed model configurations for Inferera, APIMart, and Volcengine Agent Plan, with API Keys isolated by visitor. The public version does not provide project history; please save the preview page link for future access. Configuration for extra description fields is fixed, while the main body and generation requirements remain editable. Service tests on the settings page can run simultaneously, displaying results individually. Site administrators can set `PUBLIC_DEMO_ADMIN_PASSWORD` in the `.env` file to view history via the `/admin/history` password entry. See [Public Demo Usage and Migration Instructions](docs/zh/public-demo.mdx).

## ❤️ Sponsorship

> Want to sponsor this project? Please send an email to davidyang042@gmail.com.

<details open>
<summary>Click to collapse</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> for sponsoring this project! AIHubMix is a stable, high-concurrency AI large model API aggregation platform. A single API Key provides access to mainstream models such as Claude, GPT, Gemini, and DeepSeek, supporting multiple protocols. When registering, overseas users please use the <a href="https://aihubmix.com/?aff=17EC">AIHubMix portal</a>, and users in Mainland China please use the <a href="https://inferera.com/?aff=17EC">Inferera portal</a>.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://go.apimart.ai/gh-banana-slides"><img src="./assets/logo_apimart.png" alt="APIMart" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://go.apimart.ai/gh-banana-slides">APIMart</a> for sponsoring this project! APIMart is a low-cost API platform specializing in AI image/video generation. GPT-Image-2 is as low as $0.006 per image, with $1 producing 160+ images. A unified asynchronous API handles both images and videos—submit tasks to get an ID and use callbacks to retrieve results. Process tens of thousands of batches without timeouts and switch models without changing code. Pay-as-you-go with no monthly fees. Register via this <a href="https://go.apimart.ai/gh-banana-slides">registration link</a> to start using.</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="Volcengine" width="189"></a></td>
<td valign="middle">Thanks to <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">Volcengine</a> for sponsoring this project! Compared to mainstream official APIs overseas, it offers lower prices, higher cost-effectiveness, and similar generation quality; it provides direct connection within China without needing a special network environment. Once subscribed, it can also be used for daily tasks and other compatible tools, not limited to Banana Slides.<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">View offers and subscribe →</a></td>
</tr>
</table>

</details>

## 🔥 Latest Updates

- **[2026-09-05]**: 0.9.0 Release Candidate 7 released, fixing the issue where Codex (OpenAI OAuth) is connected but image generation returns a 400 error: the internal call to the main model updated from `gpt-5.4` to `gpt-5.6-terra`, while the image model remains `gpt-image-2` without needing to change it to a text model. This version also includes content-driven style descriptions and SenseNova U1 image generation support; [View Download and Installation Instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.7)
- **[2026-08-30]**: 0.9.0 Release Candidate 6 released, adding a toggleable desktop startup update check, update cards with summaries and full log links, as well as download progress, failure retries, and restart installation; also fixed APIMart OpenAI-compatible asynchronous image tasks, non-streaming requests, and 1K/2K/4K resolution passing; [View Download and Installation Instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**: 0.9.0 Release Candidate 5 released, adding an immersive online slide player and APIMart OpenAI-compatible Provider presets; desktop update checks now correctly follow the RC channel; improved MinerU credential error prompts for PPT reconstruction, fixed SSRF risks in reference document remote images, and set image editing to enter selection state by default; [View Download and Installation Instructions](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**: 0.9.0 Release Candidate 4 released, focusing on fixing the unavailability of LazyLLM online providers (qwen, etc.) and missing SOCKS proxy dependencies in the desktop packaged version; restored the "Previous" button on the preview page to return to the description editing page, fixed export task overlay occlusion, and improved desktop property drawer interaction; [Download and Install Now](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**: Restored the "Previous" button on the preview page, allowing one-click return from slide preview to the description editing page for further modifications.
- **[2026-08-20]**: Fixed the issue where the export task overlay was blocked by the page property drawer; the desktop page property drawer is now expanded by default and automatically adapts to the window width.
- **[2026-07-31]**: The desktop packaged version now fully registers 11 LazyLLM online providers (qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai), fixing the "Unsupported source: qwen" error in the packaged version.
- **[2026-08-06]**: 0.9.0 Release Candidate 3 released, focusing on fixing Volcengine Agent Plans configuration and credential recovery, while introducing outline stream isolation, in-place slide editing, Field Contract v2, template matching, and editable PPTX export improvements; [Download and Install Now](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**: Custom outline/description requirement presets now automatically repair corrupted browser caches, retaining valid presets and preventing abnormal cache from blocking the editing page.
- **[2026-07-11]**: 0.9.0 Release Candidate 2 released, including all capabilities of RC1, while fixing MinerU directory inconsistencies for editable PPTX and FFprobe path errors for commentary videos on Windows desktop; [Download and Install Now](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**: Page-by-page templates launched — supports both unified template and independent per-page template modes; users can upload images or PDFs to build a project template library; AI automatically parses template styles and intelligently matches each page with one click, or allows manual binding page by page; supports two-way switching between the two modes at any time ([Documentation](https://docs.bananaslides.online/zh/features/templates))
- **[2026-04-25]**: Asset Toolbox launched — adds three new modes: full image editing, selection editing (overlay/replace), and smart erasing to the original asset generation, providing a one-stop operation through a unified entry point.
- **[2026-04-25]**: Supports account binding via official OpenAI OAuth login; once bound, Codex can be used directly as a text/image generation provider without manually entering an API Key; Plus accounts can generate 100+ 2K images in five hours ([Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc)) (Based on official OpenAI OAuth PKCE authorization flow, not reverse engineered).
- **[2026-04-25]**: Supports saving custom text style description templates, which can be named, color-coded, and persistently reused, eliminating the need to re-enter them every time.
- **[2026-04-23]**: Added support for the `gpt-image-2` model, and the effect of exporting editable backgrounds has also been improved due to the model's enhanced capabilities (Select "Generative Acquisition" in Settings -> Export Options -> Background Acquisition).
- **[2026-04-11]**: Added support for [CLI operations and integrated agent skills](https://docs.bananaslides.online/cli).
- **[2026-03]**: Added several features and optimizations, such as extra fields, multi-aspect ratio settings, etc.

## ✨ Project Origins

Have you ever found yourself in this dilemma: you have a presentation tomorrow, but your PPT is still blank; your mind is full of brilliant ideas, but your enthusiasm is drained by tedious layout and design?

We long to quickly create presentations that are both professional and well-designed. While traditional AI PPT generation apps generally meet the need for "speed," they still suffer from the following issues:

- 1️⃣ Only preset templates can be selected, with no flexibility to adjust styles
- 2️⃣ Low degree of freedom, making multi-round revisions difficult 
- 3️⃣ Finished products look similar, with severe homogenization
- 4️⃣ Low quality of assets and lack of specificity
- 5️⃣ Disjointed text and image layout with poor design sense

These flaws make it difficult for traditional AI PPT generators to satisfy our dual needs for both "speed" and "aesthetics" simultaneously. Even those claiming to be "Vibe PPT" are, in my eyes, still far from having enough "Vibe."

However, the emergence of the nano banana🍌 model has changed everything. I tried using 🍌pro to generate PPT pages and found that the results were excellent in terms of quality, aesthetics, and consistency. Furthermore, it can accurately render almost all text requested in the prompts while following the style of the reference images. So, why not build a native "Vibe PPT" application based on 🍌pro?

## 👨‍💻 Applicable Scenarios

1. **Beginners**: Generate beautiful PPTs quickly with zero threshold and no design experience required, reducing the hassle of template selection.
2. **PPT Professionals**: Reference AI-generated layouts and graphic-text combinations to quickly gain design inspiration.
3. **Educators**: Quickly convert teaching content into illustrated lesson plan PPTs to enhance classroom effectiveness.
4. **Students**: Rapidly complete assignment presentations, focusing energy on content rather than layout and beautification.
5. **Business Professionals**: Quickly visualize business proposals and product introductions with rapid adaptation for various scenarios.

<p>
  <b>🎯 Goal: Lower the barrier to PPT creation, enabling everyone to quickly produce beautiful and professional presentations.</b>
</p>

## 🎨 Result Examples

<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="Case 3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="Case 2"> |
| **Software Development Best Practices** | **DeepSeek-V3.2 Technical Showcase** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="Case 4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="Case 1"> |
| **R&D and Industrialization of Intelligent Production Line Equipment for Prepared Dishes** | **Evolution of Money: The Journey from Shells to Banknotes** |

</div>

See more at <a href="https://github.com/Anionex/banana-slides/issues/2" > Use Cases </a>

## 🎯 Features

### 1. Flexible and Diverse Creative Paths

Supports three starting modes—**Idea**, **Outline**, and **Page Description**—to cater to different creative habits.
- **One-Sentence Generation**: Enter a topic, and the AI automatically generates a well-structured outline and slide-by-slide content descriptions.
- **Natural Language Editing**: Supports modifying the outline or descriptions using "Vibe" prompts (e.g., "Change page three to a case study"), with the AI responding and adjusting in real-time.
- **Outline/Description Mode**: Supports both one-click batch generation and manual adjustment of details.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />

### 2. Powerful Asset Parsing Capability

- **Multi-format Support**: Upload PDF/Docx/MD/Txt and other files, and the system will automatically parse the content in the background.
- **Intelligent Extraction**: Automatically identify key points, image links, and chart information within the text to provide rich source material for generation.
- **Automatic Image Storage**: Images extracted from documents will be automatically added to the project asset library once the reference file is associated with the project, allowing for direct reuse later.
- **Style Reference**: Support uploading reference images or templates to customize the PPT style.

<img width="1920" height="1080" alt="Document Parsing and Asset Processing" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe"-style natural language modification

No longer limited by complex menu buttons, issue modification commands directly through **natural language**.
- **Inpainting**: Make verbal-style modifications to specific areas (e.g., "Change this chart to a pie chart").
- **Full-page Optimization**: Generate high-definition, stylistically consistent pages based on nano banana pro🍌.

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />

### 4. Out-of-the-box Format Export

- **Multi-format Support**: One-click export to standard **PPTX** or **PDF** files.
- **Playback Settings**: Enable slide transition animations before exporting to PPTX, supporting classic effects like Fade.
- **Perfect Fit**: Default 16:9 aspect ratio; no need for layout adjustments, ready for immediate presentation.

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT and PDF Export" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. Fully Editable PPTX Export (Beta)

- **Export images as high-fidelity, clean-background PPT slides with freely editable images and text**
- For related updates, see https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. One-click Export of Explainer Videos

- **Convert slides to explainer videos (MP4) with AI voiceovers and subtitles in one click**
- AI automatically generates natural voiceovers based on page descriptions and content
- Supports configuring various expression styles, multiple languages, and diverse voice tones

<br>

**🌟 Comparison with notebooklm slide deck**
| Feature | notebooklm | This Project | 
| --- | --- | --- |
| Page Limit | 15 pages | **Unlimited** | 
| Editing | Prompt modification | **Box-selection editing + Verbal editing** |
| Asset Addition | Cannot add after generation | **Add freely after generation** |
| Export Formats | Supports PDF, (non-editable image) pptx | **Export as PDF, (image or editable) pptx, Explainer Video** |
| Watermark | Watermarked in free version | **No watermark, free to add/delete elements** |

> Note: Comparisons may become outdated as new features are added

## 🗺️ Roadmap

| Status | Milestone |
| --- | --- |
| ✅ Completed | Add more assets to single PPT slides |
| ✅ Completed | Vibe verbal editing for selected areas on single PPT slides |
| ✅ Completed | Asset Module: Asset generation, uploading, etc. |
| ✅ Completed | Support uploading and parsing of multiple file formats |
| ✅ Completed | Support verbal adjustment of outlines and descriptions via Vibe |
| ✅ Completed | Initial support for exporting editable .pptx files |
| 🔄 In Progress | Support editable .pptx export with multi-layering and precise cutout |
| 🔄 In Progress | Web search |
| 🔄 In Progress | Agent mode |
| ✅ Completed | TTS presentation video export (multi-voice in CN/EN/JP, subtitles) |

## 📦 Usage

### (New) One-click deployment using application templates

This is the simplest way, requiring no Docker installation or project downloading. You can access the application directly after creation.

1. Deploy and start this application with one click via Rainyun (High bandwidth, ideal for HD image generation and downloading. Free trial available for new users)
- [Graphic Tutorial](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![Deploy on Rainyun](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. Stay tuned

### Using Docker Compose🐳

Quickly start front-end and back-end services using Docker Compose.

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

**(Optional, you can also configure these in the user interface after startup; [click here for the tutorial](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink))** Edit the `.env` file to configure the necessary environment variables:

<details>
<summary>Click to expand details</summary>
  
> **The LLM interfaces in this project follow the AIHubMix platform format. It is recommended to use [AIHubMix (click here to access)](https://api.inferera.com/?aff=17EC) to obtain API keys and reduce migration costs.**<br>
> **Note: The Google Nano/Banana Pro model interfaces have higher costs; please be mindful of usage expenses.**
```env

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

# SenseTime SenseNova U1 Image Model (Retaining Old Provider, Images via OpenAI Compatible Path)

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

# Selecting Providers for Text and Image Generation

```text
TEXT_MODEL_SOURCE=deepseek        # Text generation model provider
IMAGE_MODEL_SOURCE=doubao         # Image editing model provider
IMAGE_CAPTION_MODEL_SOURCE=qwen   # Image captioning model provider
```

# API Keys for Various Providers (Only configure the providers you intend to use)

DOUBAO_API_KEY=your-doubao-api-key            # Volcengine / Doubao
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # Alibaba Cloud / Qwen
GLM_API_KEY=your-glm-api-key                  # Zhipu GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # SiliconFlow
SENSENOVA_API_KEY=your-sensenova-api-key      # SenseTime / SenseNova

# U1 For image generation, please prioritize using the IMAGE_MODEL_SOURCE=openai configuration above; this Key is used for the legacy LazyLLM path.

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

**Use the new editable export configuration method to achieve better editable export results**: You need to obtain an API KEY from the [Baidu AI Cloud Platform](https://console.bce.baidu.com/iam/#/iam/apikey/list) (click here to enter) and fill it in the `BAIDU_API_KEY` field in the `.env` file (there is sufficient free usage quota). For details, see the instructions in https://github.com/Anionex/banana-slides/issues/121.

<details>
  <summary>📒 Vertex AI Configuration Guide (for GCP users)</summary>

Google Cloud Vertex AI allows calling Gemini models through GCP service accounts, and new users can use complimentary credits. Configuration steps:

1. Go to the [GCP Console](https://console.cloud.google.com/), create a service account, and download the JSON format key file.
2. Save the key file as `gcp-service-account.json` in the project root directory.
3. Set the following in `.env`:
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. If using Docker deployment, you also need to uncomment the relevant sections in `docker-compose.yml`, mount the key file into the container, and set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.

> The `gemini-3-*` series models require `VERTEX_LOCATION=global`.

</details>

2. **Start the Service**

**⚡ Use Pre-built Images (Recommended)**

The project provides pre-built frontend and backend images on Docker Hub (synchronized with the latest version of the main branch), allowing you to skip local build steps for rapid deployment:

```bash

# Start with Pre-built Images (No Need to Build from Scratch)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Image names:
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

After starting, you can go to **Settings → About → Check for Updates** within the application. The app will determine if there are available updates based on the current version SHA; when running from source, the current Git SHA will also be used for this determination.

**Build Images from Scratch**

```bash
docker compose up -d
```


> [!TIP]
> In case of network issues, you can uncomment the mirror source configurations in the `.env` file and then rerun the startup command:
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

# View Frontend Logs (Last 100 lines)

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

Note: If you have manually modified the code, this method is not applicable. You must first revert the code to the state when it was pulled.

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Note: Thanks to the excellent developer friend [@ShellMonster](https://github.com/ShellMonster/) for providing the [Newbie Deployment Tutorial](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md), designed specifically for beginners without any server deployment experience. You can [click the link](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md) to view it.**

### Deploy from Source

#### Environment Requirements

- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - Python package manager
- Node.js 16+ and npm
- [FFmpeg](https://ffmpeg.org/) - Required for exporting explanation videos; must include `libass` / `ass` subtitle filter support
- A valid Google Gemini API key
- (Optional) [LibreOffice](https://www.libreoffice.org/) - Required when uploading PPTX files using the "PPT Refurbishment" feature, used to convert PPTX to PDF. **It is recommended to convert PPTX to PDF locally before uploading.** Reason: When rendering on the server side, LibreOffice may cause layout issues due to missing fonts (such as Microsoft YaHei, Calibri, etc.) and cannot fully restore certain special effects. LibreOffice is not required if you upload PDF files directly. For Docker users who still need PPTX upload support within the container, run:
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

uv sync
```

This will automatically install all dependencies based on `pyproject.toml`.

3. **Configure Environment Variables**

Copy the environment variable template:
```bash
cp .env.example .env
```

# Then, follow the previously described method to open and edit the `.env` file and configure your API key.

# Lightweight Cross-platform Redis Desktop Client

This is a Redis desktop management tool developed based on Rust, Tauri, and Vue3. It aims to provide a lightweight, fast, and beautiful Redis management experience.

## Features

- **Lightweight**: Developed with Rust and Tauri, with low resource consumption.
- **Cross-platform**: Supports Windows, macOS, and Linux.
- **High Performance**: Leverages the performance advantages of Rust.
- **Multi-language**: Supports Chinese and English.
- **Beautiful UI**: Built with Vue3 and Naive UI, supports dark mode.
- **Feature-rich**: Supports connection management, key-value operations, terminal emulation, etc.

## Installation

You can download the installation package for your operating system from the [Releases](https://github.com/example/redis-client/releases) page.

## Preview

![Screenshot 1](https://example.com/screenshot1.png)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/example/redis-client.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development mode:
   ```bash
   npm run tauri dev
   ```
4. Build application:
   ```bash
   npm run tauri build
   ```

## Contribution

Pull Requests and Issues are welcome to help improve this project.

## License

This project is open-sourced under the MIT License.

#### Front-end Installation

1. **Navigate to the frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure API address**

The frontend will automatically connect to the backend service specified by `BACKEND_PORT` via Vite proxy (default `http://localhost:5011`). To modify it, please set `BACKEND_PORT` in the `.env` file in the project root directory.

#### Start the Backend Service

> (Optional) If you have important local data, it is recommended to back up the database before upgrading:  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> Note: Under the default configuration, templates, materials, and finished products are all stored in the `uploads/` folder.

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

The backend service will start at `http://localhost:5011`.

Access `http://localhost:5011/health` to verify if the service is running correctly.

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend development server will start at `http://localhost:3011`.

Open your browser to access the application.

## Community Groups

You are welcome to suggest new features or provide feedback in the group!

<img width="312" alt="image" src="https://github.com/user-attachments/assets/586861e7-5b25-4f91-8c81-1872b21def10" />






Feel free to follow the author's social media, where I will share updates about this project and AI-related information:

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
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

> **Important:** Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing

## 📄 License

This project is open-sourced under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 
It can be freely used for non-commercial purposes such as personal study, research, experimentation, education, or non-profit scientific research activities; authorization is required for closed-source commercial use.

For inquiries, cooperation intentions, or to obtain the multi-tenant commercial version, please contact: davidyang042@gmail.com

## Acknowledgments

- Project Contributors:

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): A new ideal community

## Sponsorship

Open source is not easy 🙏 If this project is valuable to you, you are welcome to buy the developer a coffee ☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

Thanks to the following friends for their selfless sponsorship and support:
> @雅俗共赏、@曹峥、@以年观日、@John、@胡yun星Ethan, @azazo1、@刘聪NLP、@🍟、@苍何、@万瑾、@biubiu、@law、@方源、@寒松Falcon、@刘星宇&小陀螺AIGC
> If you have any questions regarding the sponsorship list, you can <a href="mailto:davidyang042@gmail.com">contact the author</a>

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
