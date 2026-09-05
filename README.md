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
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6"><img src="https://img.shields.io/badge/version-v0.9.0--rc.6-44cc11?style=flat-square" alt="Version"></a>
  <a href="https://github.com/Anionex/banana-slides/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anionex/banana-slides?color=0055aa&style=flat-square" alt="License"></a>
  <br>
  <img src="https://img.shields.io/badge/Docker-Build-4A90D9?logo=docker&logoColor=white&style=flat-square" alt="Docker Build">
  <a href="https://deepwiki.com/Anionex/banana-slides"><img src="./assets/badge-deepwiki-flat.svg" alt="Ask DeepWiki"></a>
</p>

<p>
  <b>你的想法，不必套版。</b><br>
  从想法、文档或旧 PPT 开始，用 AI 创作演示，再用自然语言和局部修改调整每一页。
</p>
<p>
  <a href="https://bananaslides.online/"><b>🚀 在线 Demo</b></a>
  &nbsp;|&nbsp;
  <a href="https://docs.bananaslides.online/"><b>📖 文档</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6"><b>💻 桌面版 RC6</b></a>
  &nbsp;|&nbsp;
 <a href="https://github.com/Anionex/banana-slides#-%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95"><b>部署方法</b></a>
</p>
<p>
  如果该项目对你有用，欢迎 <b>Star 🌟</b> & <b>Fork 🍴</b>
</p>

</div>

### 创作工作台

首页提供「写个想法」「粘贴大纲」「输入逐页内容」「翻新旧稿」四个入口；原有空白项目、参考文件、图片上传和风格配置继续保留。「接着上次的想法」展示最近 3 个项目，可直接继续编辑。

新界面采用暖白、墨黑和香蕉黄，并支持深色模式。编辑器顶部显示项目名称、页数和当前创作阶段；原有保存、生成条件和前后步骤操作不变。动效仅用于短暂入场与交互反馈，案例不再自动轮播；界面遵循系统的「减少动态效果」设置。手机端的素材、设置、帮助和语言入口收纳在右上角「更多工具」。

详见[功能总览](docs/zh/features/overview.mdx)。本轮界面更新不改变 AI 服务配置、生成次数或导出格式。

## ❤️ 赞助

> 想赞助本项目？请发送邮件至 davidyang042@gmail.com。

<details open>
<summary>点击折叠</summary>

<table>
<tr>
<td width="220" align="center" valign="middle"><a href="https://aihubmix.com/?aff=17EC"><img src="./assets/logo_aihubmix.png" alt="AIHubMix" width="189"></a></td>
<td valign="middle">感谢 <a href="https://aihubmix.com/?aff=17EC">AIHubMix</a> 赞助本项目！AIHubMix 是稳定、高并发的 AI 大模型 API 聚合平台，一个 API Key 即可接入 Claude、GPT、Gemini、DeepSeek 等主流模型，兼容多种协议。注册时，海外用户请使用 <a href="https://aihubmix.com/?aff=17EC">AIHubMix 入口</a>，中国大陆用户请使用 <a href="https://inferera.com/?aff=17EC">Inferera 入口</a>。</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://go.apimart.ai/gh-banana-slides"><img src="./assets/logo_apimart.png" alt="APIMart" width="189"></a></td>
<td valign="middle">感谢 <a href="https://go.apimart.ai/gh-banana-slides">APIMart</a> 赞助了本项目！APIMart 是专注 AI 图片/视频生成的低价 API 平台，GPT-Image-2 低至 $0.006/张，1 美元可出图 160+ 张。图片、视频一套异步 API 通吃，提交任务拿 ID、回调取结果，跑批万张不超时、换模型不改代码。按量付费、无月费，通过此<a href="https://go.apimart.ai/gh-banana-slides">注册链接</a>注册即可开用。</td>
</tr>
<tr>
<td width="220" align="center" valign="middle"><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides"><img src="./assets/huoshan.png" alt="火山引擎" width="189"></a></td>
<td valign="middle">感谢 <a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">火山引擎</a> 赞助了本项目！相比海外主流官方 API 价格更低、性价比更高，生成效果接近；国内直连，无需特殊网络环境。订阅后还能用于日常使用和其他兼容工具，不局限于 Banana Slides。<br><a href="https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides">查看优惠并订阅 →</a></td>
</tr>
</table>

</details>

## 🔥 最新动态
- **[2026-08-30]**：0.9.0 候选版本 6 发布，新增可开关的桌面启动更新检查、包含更新摘要与完整日志链接的更新卡片，以及下载进度、失败重试和重启安装；同时修复 APIMart OpenAI-compatible 异步图片任务、非流式请求及 1K/2K/4K 分辨率传递；[查看下载与安装说明](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.6)
- **[2026-08-29]**：0.9.0 候选版本 5 发布，新增沉浸式在线幻灯片播放器与 APIMart OpenAI-compatible Provider 预设，桌面版更新检查现可正确跟随 RC 通道；同时改进 PPT 改造的 MinerU 凭据错误提示、修复参考文档远程图片 SSRF 风险，并让图片编辑默认进入框选状态；[查看下载与安装说明](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.5)
- **[2026-08-20]**：0.9.0 候选版本 4 发布，重点修复桌面打包版 LazyLLM 在线供应商不可用（qwen 等）与 SOCKS 代理依赖缺失，并恢复预览页「上一步」返回描述编辑页、修复导出任务弹层遮挡与桌面端属性抽屉交互；[一键下载并安装](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4)
- **[2026-08-20]**：预览页恢复「上一步」按钮，可从幻灯片预览一键返回描述编辑页继续修改
- **[2026-08-20]**：修复导出任务弹层被页面属性抽屉遮挡的问题；桌面端页面属性抽屉默认展开并自动适配窗口宽度
- **[2026-07-31]**：桌面打包版完整注册 11 家 LazyLLM 在线供应商（qwen / doubao / deepseek / glm / kimi / minimax / sensenova / siliconflow / ppio / aiping / openai），修复打包版报 `Unsupported source: qwen` 的问题
- **[2026-08-06]**：0.9.0 候选版本 3 发布，重点修复火山引擎 Agent Plans 配置与凭据恢复，并带来大纲流隔离、幻灯片就地编辑、字段契约 v2、模板匹配和可编辑 PPTX 导出改进；[一键下载并安装](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.3)
- **[2026-07-15]**：自定义大纲/描述要求预设现在会自动修复损坏的浏览器缓存，保留仍然有效的预设，避免异常缓存阻断编辑页面
- **[2026-07-11]**：0.9.0 候选版本 2 发布，包含 RC1 的全部能力，并修复 Windows 桌面端可编辑 PPTX 的 MinerU 目录不一致、讲解视频 FFprobe 路径错误；[一键下载并安装](https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.2)
- **[2026-06-23]**：逐页模板上线 — 支持统一模板 / 每页独立模板两种模式，可上传图片或 PDF 构建项目模板库，AI 自动解析模板风格并一键为每页智能匹配，也可逐页手动绑定；两种模式随时双向切换（[文档](https://docs.bananaslides.online/zh/features/templates)）
- **[2026-04-25]**： 素材工具箱上线 — 在原有素材生成基础上新增整图编辑、框选编辑（overlay/replace）、智能擦除三种模式，统一入口一站式操作
- **[2026-04-25]**：支持通过 OpenAI 官方 OAuth 登录绑定账号，绑定后可直接使用 Codex 作为文本/图片生成 provider，无需手动填写 API Key，plus账号五小时可生成100+ 2k图（[教程](https://ziy68cvfvu3.feishu.cn/wiki/LDSOwPzkhiNonkkNTF1ct2VBnNc))（基于 OpenAI 官方 OAuth PKCE 授权流程，非逆向）
- **[2026-04-25]**：支持保存自定义文字风格描述模板，可命名、标色、持久化复用，无需每次重新输入
- **[2026-04-23]**：支持了gpt-image-2模型，同时导出可编辑背景效果也因模型能力升级得到了提升（在 设置-导出选项-背景获取 选择 生成式获取）
- **[2026-04-11]**：支持了[cli操作并加入了agent skills](https://docs.bananaslides.online/cli)
- **[2026-03]**：加入了若干功能和优化，如额外字段、多比例设定等

## ✨ 项目缘起
你是否也曾陷入这样的困境：明天就要汇报，但PPT还是一片空白；脑中有无数精彩的想法，却被繁琐的排版和设计消磨掉所有热情？

我(们)渴望能快速创作出既专业又具设计感的演示文稿，传统的AI PPT生成app，虽然大体满足“快”这一需求，却还存在以下问题：

- 1️⃣只能选择预设模版，无法灵活调整风格
- 2️⃣自由度低，多轮改动难以进行 
- 3️⃣成品观感相似，同质化严重
- 4️⃣素材质量较低，缺乏针对性
- 5️⃣图文排版割裂，设计感差

以上这些缺陷，让传统的AI ppt生成器难以同时满足我们“快”和“美”的两大PPT制作需求。即使自称Vibe PPT，但是在我的眼中还远不够“Vibe”。

但是，nano banana🍌模型的出现让一切有了转机。我尝试使用🍌pro进行ppt页面生成，发现生成的结果无论是质量、美感还是一致性，都做的非常好，且几乎能精确渲染prompt要求的所有文字+遵循参考图的风格。那为什么不基于🍌pro，做一个原生的"Vibe PPT"应用呢？

## 👨‍💻 适用场景


1. **小白**：零门槛快速生成美观PPT，无需设计经验，减少模板选择烦恼
2. **PPT专业人士**：参考AI生成的布局和图文元素组合，快速获取设计灵感
3. **教育工作者**：将教学内容快速转换为配图教案PPT，提升课堂效果
4. **学生**：快速完成作业Pre，把精力专注于内容而非排版美化
5. **职场人士**：商业提案、产品介绍快速可视化，多场景快速适配

<p>
  <b>🎯目标： 降低 PPT 制作门槛，让每个人都能快速创作出美观专业的演示文稿</b>
</p>


## 🎨 结果案例


<div align="center">

| | |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644" width="500" alt="案例3"> | <img src="https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e" width="500" alt="案例2"> |
| **软件开发最佳实践** | **DeepSeek-V3.2技术展示** |
| <img src="https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7" width="500" alt="案例4"> | <img src="https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1" width="500" alt="案例1"> |
| **预制菜智能产线装备研发和产业化** | **钱的演变：从贝壳到纸币的旅程** |

</div>

更多可见<a href="https://github.com/Anionex/banana-slides/issues/2" > 使用案例 </a>


## 🎯 功能介绍

### 1. 灵活多样的创作路径
支持**想法**、**大纲**、**页面描述**三种起步方式，满足不同创作习惯。
- **一句话生成**：输入一个主题，AI 自动生成结构清晰的大纲和逐页内容描述。
- **自然语言编辑**：支持以 Vibe 形式口头修改大纲或描述（如"把第三页改成案例分析"），AI 实时响应调整。
- **大纲/描述模式**：既可一键批量生成，也可手动调整细节。

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/7fc1ecc6-433d-4157-b4ca-95fcebac66ba" />


### 2. 强大的素材解析能力
- **多格式支持**：上传 PDF/Docx/MD/Txt 等文件，后台自动解析内容。
- **智能提取**：自动识别文本中的关键点、图片链接和图表信息，为生成提供丰富素材。
- **图片自动入库**：文档解析出的图片会随参考文件关联项目后自动进入项目素材库，后续可直接复用。
- **风格参考**：支持上传参考图片或模板，定制 PPT 风格。

<img width="1920" height="1080" alt="文件解析与素材处理" src="https://github.com/user-attachments/assets/8cda1fd2-2369-4028-b310-ea6604183936" />

### 3. "Vibe" 式自然语言修改
不再受限于复杂的菜单按钮，直接通过**自然语言**下达修改指令。
- **局部重绘**：对不满意的区域进行口头式修改（如"把这个图换成饼图"）。
- **整页优化**：基于 nano banana pro🍌 生成高清、风格统一的页面。

<img width="2000" height="1125" alt="image" src="https://github.com/user-attachments/assets/929ba24a-996c-4f6d-9ec6-818be6b08ea3" />


### 4. 开箱即用的格式导出
- **多格式支持**：一键导出标准 **PPTX** 或 **PDF** 文件。
- **播放设置**：导出 PPTX 前可开启页面切换动画，支持淡入淡出等经典效果
- **完美适配**：默认 16:9 比例，排版无需二次调整，直接演示。

<img width="1000" alt="image" src="https://github.com/user-attachments/assets/3e54bbba-88be-4f69-90a1-02e875c25420" />
<img width="1748" height="538" alt="PPT与PDF导出" src="https://github.com/user-attachments/assets/647eb9b1-d0b6-42cb-a898-378ebe06c984" />

### 5. 可自由编辑的pptx导出（Beta迭代中）
- **导出图像为高还原度、背景干净的、可自由编辑图像和文字的PPT页面**
- 相关更新见 https://github.com/Anionex/banana-slides/issues/121
<img width="1000"  alt="image" src="https://github.com/user-attachments/assets/a85d2d48-1966-4800-a4bf-73d17f914062" />

### 6. 一键导出讲解视频
- **一键将幻灯片转换为带 AI 语音旁白和字幕的讲解视频（MP4）**
- AI 自动根据页面描述和内容生成口语化旁白
- 支持配置多种表达风格、多语言和多种音色

<br>

**🌟和notebooklm slide deck功能对比**
| 功能 | notebooklm | 本项目 | 
| --- | --- | --- |
| 页数上限 | 15页 | **无限制** | 
| 二次编辑 | 提示词修改 | **框选编辑+口头编辑** |
| 素材添加 | 生成后无法添加 | **生成后自由添加** |
| 导出格式 | 支持导出为 PDF、（不可编辑图片）pptx | **导出为PDF、(图片or可编辑)pptx、讲解视频** |
| 水印 | 免费版有水印 | **无水印，自由增删元素** |

> 注：随着新功能添加,对比可能过时



## 🗺️ 开发计划

| 状态 | 里程碑 |
| --- | --- |
| ✅ 已完成 | PPT 单页添加更多素材 |
| ✅ 已完成 | PPT 单页框选区域Vibe口头编辑 |
| ✅ 已完成 | 素材模块: 素材生成、上传等 |
| ✅ 已完成 | 支持多种文件的上传+解析 |
| ✅ 已完成 | 支持Vibe口头调整大纲和描述 |
| ✅ 已完成 | 初步支持可编辑版本pptx文件导出 |
| 🔄 进行中 | 支持多层次、精确抠图的可编辑pptx导出 |
| 🔄 进行中 | 网络搜索 |
| 🔄 进行中 | Agent 模式 |
| ✅ 已完成 | TTS 讲解视频导出（中/英/日多音色、字幕） |


## 📦 使用方法

### （新）使用应用模板一键部署
这是最简单的方式，无需安装docker或下载项目，创建后可直接进入应用


1. 通过雨云一键部署和启动本应用 (带宽大，适合高清图片生成和下载。新用户有免费试用)
- [图文教程](https://ziy68cvfvu3.feishu.cn/wiki/B5RIwg3OUiCfo9kyadzcR9CInnc?from=from_copylink)

[![通过雨云一键部署](https://rainyun-apps.cn-nb1.rains3.com/materials/deploy-on-rainyun-cn.svg)](https://app.rainyun.com/apps/rca/store/7549/anionex_)

2. 敬请期待


### 使用 Docker Compose🐳
通过docker compose快速启动前后端服务。

<details>
  <summary>📒 Windows/Mac用户说明</summary>

如果你使用 **Windows 或 macOS**，请先[安装 **Docker Desktop**](https://docs.docker.com/desktop/setup/install/windows-install/)，并确保 Docker 正在运行（Windows 可检查系统托盘图标；macOS 可检查菜单栏图标），然后按文档中的相同步骤操作。

> **提示**：如果遇到问题，Windows 用户请在 Docker Desktop 设置中启用 **WSL 2 后端**（推荐）；同时确保端口 **3011** 和 **5011** 未被占用。

</details>

0. **克隆代码仓库**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **配置环境变量**

创建 `.env` 文件（参考 `.env.example`）：
```bash
cp .env.example .env
```

**（可选， 也可以启动后在用户界面配置，[教程可点击此处](https://ziy68cvfvu3.feishu.cn/wiki/GiNawdmpiinSRqkGspocqEWAnkh?from=from_copylink )）** 编辑 `.env` 文件，配置必要的环境变量：

<details>
<summary>点击展开详情</summary>
  
> **项目中大模型接口以AIHubMix平台格式为标准，推荐使用 [AIHubMix(点击此处可直接访问)](https://api.inferera.com/?aff=17EC) 获取API密钥，减小迁移成本**<br>
> **友情提示：谷歌nano banana pro模型接口费用较高，请注意调用成本**
```env
# AI Provider格式配置 (gemini / openai / volcengine / vertex)
AI_PROVIDER_FORMAT=gemini

# Gemini 格式配置（当 AI_PROVIDER_FORMAT=gemini 时使用）
GOOGLE_API_KEY=your-api-key-here
GOOGLE_API_BASE=https://generativelanguage.googleapis.com
# 代理示例: https://api.inferera.com/gemini

# OpenAI 格式配置（当 AI_PROVIDER_FORMAT=openai 时使用）
OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
# 代理示例: https://api.inferera.com/v1

# 商汤日日新 U1 图片模型（保留旧 Provider，图片走 OpenAI 兼容路径）
# 推荐：文本继续用 Gemini，只让图片走商汤
# IMAGE_MODEL_SOURCE=openai
# IMAGE_API_KEY=your-sensenova-api-key
# IMAGE_API_BASE=https://token.sensenova.cn/v1
# IMAGE_MODEL=sensenova-u1.5-lite

# 火山方舟 Agent Plans 配置（当 AI_PROVIDER_FORMAT=volcengine 时使用）
# 注意: Agent Plan 需使用专属 API Key 与模型名 (doubao-seed-2.1-turbo / doubao-seedream-5.0-lite)
VOLCENGINE_API_KEY=your-volcengine-api-key-here
VOLCENGINE_API_BASE=https://ark.cn-beijing.volces.com/api/plan/v3

# Vertex AI 配置（AI_PROVIDER_FORMAT=vertex）
# 需要 GCP 项目和服务账户密钥
# VERTEX_PROJECT_ID=your-gcp-project-id
# VERTEX_LOCATION=global
# GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Lazyllm 格式配置（当 AI_PROVIDER_FORMAT=lazyllm 时使用）
# 选择文本生成和图片生成使用的厂商
TEXT_MODEL_SOURCE=deepseek        # 文本生成模型厂商
IMAGE_MODEL_SOURCE=doubao         # 图片编辑模型厂商
IMAGE_CAPTION_MODEL_SOURCE=qwen   # 图片描述模型厂商

# 各厂商 API Key（只需配置你要使用的厂商）
DOUBAO_API_KEY=your-doubao-api-key            # 火山引擎/豆包
DEEPSEEK_API_KEY=your-deepseek-api-key        # DeepSeek
QWEN_API_KEY=your-qwen-api-key                # 阿里云/通义千问
GLM_API_KEY=your-glm-api-key                  # 智谱 GLM
SILICONFLOW_API_KEY=your-siliconflow-api-key  # 硅基流动
SENSENOVA_API_KEY=your-sensenova-api-key      # 商汤日日新
# U1 生图请优先使用上面的 IMAGE_MODEL_SOURCE=openai 配置；此 Key 用于旧 LazyLLM 路径
MINIMAX_API_KEY=your-minimax-api-key          # MiniMax
KIMI_API_KEY=your-kimi-api-key                # 月之暗面 Kimi
PPIO_API_KEY=your-ppio-api-key                # PPIO 派欧云
AIPING_API_KEY=your-aiping-api-key            # AIPing 爱拼
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


**使用新版可编辑导出配置方法，获得更好的可编辑导出效果**: 需在[百度智能云平台](https://console.bce.baidu.com/iam/#/iam/apikey/list)（点击此处进入）中获取API KEY，填写在.env文件中的BAIDU_API_KEY字段（有充足的免费使用额度）。详见https://github.com/Anionex/banana-slides/issues/121 中的说明


<details>
  <summary>📒 Vertex AI 配置指南（适用于 GCP 用户）</summary>

Google Cloud Vertex AI 允许通过 GCP 服务账户调用 Gemini 模型，新用户可使用赠金额度。配置步骤：

1. 前往 [GCP Console](https://console.cloud.google.com/)，创建一个服务账户并下载 JSON 格式的密钥文件
2. 将密钥文件保存为项目根目录下的 `gcp-service-account.json`
3. 在 `.env` 中设置：
   ```env
   AI_PROVIDER_FORMAT=vertex
   VERTEX_PROJECT_ID=your-gcp-project-id
   VERTEX_LOCATION=global
   ```
4. 如果使用 Docker 部署，还需要在 `docker-compose.yml` 中取消相关注释，将密钥文件挂载到容器内并设置 `GOOGLE_APPLICATION_CREDENTIALS` 环境变量。

> `gemini-3-*` 系列模型要求 `VERTEX_LOCATION=global`

</details>

2. **启动服务**

**⚡ 使用预构建镜像（推荐）**

项目在 Docker Hub 提供了构建好的前端和后端镜像（同步主分支最新版本），可以跳过本地构建步骤，实现快速部署：

```bash
# 使用预构建镜像启动（无需从头构建）
docker compose -f docker-compose.prod.yml up -d
```

镜像名称：
- `anoinex/banana-slides-frontend:latest`
- `anoinex/banana-slides-backend:latest`

启动后可在应用内进入 **设置 → 关于 → 检查更新**，应用会根据当前版本 SHA 判断是否已有可用更新；源码运行时也会用当前 Git SHA 参与判断。

**从头构建镜像**

```bash
docker compose up -d
```


> [!TIP]
> 如遇网络问题，可在 `.env` 文件中取消镜像源配置的注释, 再重新运行启动命令：
> ```env
> # 在 .env 文件中取消以下注释即可使用国内镜像源
> DOCKER_REGISTRY=docker.1ms.run/
> GHCR_REGISTRY=ghcr.nju.edu.cn/
> APT_MIRROR=mirrors.aliyun.com
> PYPI_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
> NPM_REGISTRY=https://registry.npmmirror.com/
> ```


3. **访问应用**

- 前端：http://localhost:3011
- 后端 API：http://localhost:5011

4. **查看日志**

```bash
# 查看后端日志（最后 200 行）
docker logs --tail 200 banana-slides-backend

# 实时查看后端日志（最后 100 行）
docker logs -f --tail 100 banana-slides-backend

# 查看前端日志（最后 100 行）
docker logs --tail 100 banana-slides-frontend
```

5. **停止服务**

```bash
docker compose down
```

6. **更新项目**

**使用预构建镜像（docker-compose.prod.yml）**

也可以先在应用内进入 **设置 → 关于 → 检查更新** 查看是否已有新版本。

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**使用本地构建（docker-compose.yml）**

注：若手动修改了代码，该方法不适用，需要先将代码还原到拉取时的版本。

```bash
git pull 
docker compose down
docker compose build --no-cache
docker compose up -d
```

**注：感谢优秀开发者朋友 [@ShellMonster](https://github.com/ShellMonster/) 提供了[新人部署教程](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md)，专为没有任何服务器部署经验的新手设计，可[点击链接](https://github.com/ShellMonster/banana-slides/blob/docs-deploy-tutorial/docs/NEWBIE_DEPLOYMENT.md)查看。**

### 从源码部署

#### 环境要求
- Python 3.10 或更高版本
- [uv](https://github.com/astral-sh/uv) - Python 包管理器
- Node.js 16+ 和 npm
- [FFmpeg](https://ffmpeg.org/) - 讲解视频导出必需，且必须包含 `libass` / `ass` 字幕滤镜支持
- 有效的 Google Gemini API 密钥
- （可选）[LibreOffice](https://www.libreoffice.org/) - 使用「PPT 翻新」功能上传 PPTX 文件时需要，用于将 PPTX 转换为 PDF。**推荐先在本地将 PPTX 转为 PDF 后再上传**，原因：LibreOffice 在服务端渲染时可能因缺少字体（如微软雅黑、Calibri 等）导致排版错位，且无法完整还原部分特效。上传 PDF 文件则不需要 LibreOffice。Docker 用户如仍需在容器内支持 PPTX 上传，可执行：
  ```bash
  docker exec -it banana-slides-backend bash -c "apt-get update && apt-get install -y libreoffice-impress && rm -rf /var/lib/apt/lists/*"
  ```
  > 注意：此方式安装的 LibreOffice 在容器重建后会丢失，需重新安装。

#### 后端安装

0. **克隆代码仓库**
```bash
git clone https://github.com/Anionex/banana-slides
cd banana-slides
```

1. **安装 uv（如果尚未安装）**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. **安装依赖**

在项目根目录下运行：
```bash
# macOS（Homebrew）
brew install ffmpeg-full
brew unlink ffmpeg 2>/dev/null || true
brew link --overwrite --force ffmpeg-full

# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y ffmpeg libass9

# 然后安装 Python 依赖
uv sync
```

这将根据 `pyproject.toml` 自动安装所有依赖。

3. **配置环境变量**

复制环境变量模板：
```bash
cp .env.example .env
# 然后按照前述方法，打开编辑 `.env` 文件，配置你的 API 密钥
```

#### 前端安装

1. **进入前端目录**
```bash
cd frontend
```

2. **安装依赖**
```bash
npm install
```

3. **配置API地址**

前端会通过 Vite proxy 自动连接到 `BACKEND_PORT` 指定的后端服务（默认 `http://localhost:5011`）。如需修改，请在项目根目录的 `.env` 中设置 `BACKEND_PORT`。


#### 启动后端服务
> （可选）如果本地已有重要数据，升级前建议先备份数据库：  
> `cp backend/instance/database.db backend/instance/database.db.bak`
> 备注： 默认配置下，模板、素材、成品都在uploads/文件夹中

```bash
cd backend
uv run alembic upgrade head && uv run python app.py
```

后端服务将在 `http://localhost:5011` 启动。

访问 `http://localhost:5011/health` 验证服务是否正常运行。

#### 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端开发服务器将在 `http://localhost:3011` 启动。

打开浏览器访问即可使用应用。


## 交流群

欢迎在群中提出新功能建议或反馈～

<img width="312" alt="0ed188e1aa9d2d6ffffebdf749a077c7" src="https://github.com/user-attachments/assets/943dd564-eb3c-436a-85e3-ec0547c29f15" />






欢迎关注作者的社交媒体，我会分享有关本项目和有关AI的信息：

<p>
  <a href="https://x.com/anion_ex"><img src="https://img.shields.io/badge/X-@anion__ex-000000?style=flat-square&logo=x&logoColor=white" alt="X (Twitter)"></a>
</p>





## **🔧 常见问题**
可见[官网文档](https://docs.bananaslides.online/zh/faq)

也可以直接到 DeepWiki 提问 
<a href="https://deepwiki.com/Anionex/banana-slides"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>



## 🤝 贡献指南

欢迎通过
[Issue](https://github.com/Anionex/banana-slides/issues)
和
[Pull Request](https://github.com/Anionex/banana-slides/pulls)
为本项目贡献力量！

> **重要：** 贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 许可证

本项目采用 **GNU Affero General Public License v3.0（AGPL-3.0）** 开源，
可自由用于个人学习、研究、试验、教育或非营利科研活动等非商业用途；闭源商业用途需获取授权。

如有疑问或合作意向、获取多租户商业版本，可联系: davidyang042@gmail.com



## 致谢

- 项目贡献者们：

[![Contributors](https://contrib.rocks/image?repo=Anionex/banana-slides)](https://github.com/Anionex/banana-slides/graphs/contributors)

- [Linux.do](https://linux.do/): 新的理想型社区
  
## 赞赏

开源不易🙏如果本项目对你有价值，欢迎请开发者喝杯咖啡☕️

<img width="240" alt="image" src="https://github.com/user-attachments/assets/fd7a286d-711b-445e-aecf-43e3fe356473" />

感谢以下朋友对项目的无偿赞助支持：
> @雅俗共赏、@曹峥、@以年观日、@John、@胡yun星Ethan, @azazo1、@刘聪NLP、@🍟、@苍何、@万瑾、@biubiu、@law、@方源、@寒松Falcon、@刘星宇&小陀螺AIGC
> 如对赞助列表有疑问，可<a href="mailto:davidyang042@gmail.com">联系作者</a>
 
## 📈 项目统计

<a href="https://www.star-history.com/?type=timeline&legend=top-left&repos=Anionex%2Fbanana-slides">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&theme=dark&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Anionex/banana-slides&type=timeline&legend=top-left&sealed_token=pzS0bBi13dr1t_I0Dwnl1DVcQSdm3cX-52VniVUNQzg-ZWc6KLgzf_c-kfUYgEbGbpIw37AZbrkimxRYTzoiBCKkszqr7i07YYdStd03_JlKnzQ42jG8Vg" />
 </picture>
</a>

</a>

<br>
