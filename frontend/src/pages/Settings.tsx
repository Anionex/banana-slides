import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_ERROR_RECOVERY } from '@/hooks/useApiSettingsRecovery';
import { useTranslation } from 'react-i18next';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText, Brain, ArrowUp, HelpCircle, Link2, ChevronDown, Volume2, Info, RefreshCw, CheckCircle, Lightbulb, Sparkles, AlertCircle } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { appVersion } from '@/utils/appVersion';
import { isDesktop } from '@/utils';
import { startOpenAIOAuthMonitor } from '@/utils/openaiOAuthMonitor';
import { DataStorageSettings } from '@/components/settings/DataStorageSettings';
import type { DesktopUpdateCheckResult } from '@/types/desktopUpdate';

// 组件内翻译
const settingsI18n = {
  zh: {
    nav: { backToHome: '返回首页', backToEditor: '返回编辑器' },
    settings: {
      title: "系统设置",
      subtitle: "配置应用的各项参数",
      sections: {
        appearance: "外观设置", language: "界面语言", apiConfig: "默认 API 配置",
        apiConfigDesc: "下方模型未单独指定提供商时，将使用此处的配置",
        modelConfig: "模型配置", mineruConfig: "MinerU 配置", imageConfig: "图像生成配置",
        performanceConfig: "性能配置", outputLanguage: "输出语言设置",
        textReasoning: "文本推理模式", imageReasoning: "图像推理模式",
        baiduOcr: "百度配置", serviceTest: "服务测试", lazyllmConfig: "LazyLLM 厂商配置",
        vendorApiKeys: "厂商 API Key 配置",
        advancedSettings: "高级设置",
        elevenlabs: "ElevenLabs 语音合成",
        about: "关于"
      },
      about: {
        version: "当前版本",
        source: "GitHub 项目",
        checkUpdate: "检查更新",
        checking: "检查中...",
        upToDate: "您当前已是最新版本",
        updateAvailable: "有版本更新：{{version}}",
        unknown: "无法判断当前是否为最新版本",
        failed: "检查更新失败",
        resultTitle: "检查更新结果",
        download: "前往下载",
        close: "关闭",
      },
      openaiOAuth: {
        title: "OpenAI 账号连接",
        description: "通过 OAuth 登录 OpenAI 账号，无需手动输入 API Key 即可使用 OpenAI 的模型（如 GPT Image）",
        loginBtn: "Login with OpenAI",
        disconnectBtn: "断开连接",
        connected: "已连接",
        disconnected: "未连接",
        account: "账号",
        connecting: "连接中...",
        disconnecting: "断开中...",
        connectFailed: "连接失败",
        popupBlocked: "登录窗口被浏览器拦截，请允许弹出窗口后重试",
        connectTimeout: "登录等待超时，请重试或使用手动回调方式连接",
        disconnectFailed: "断开失败",
        disconnectSuccess: "已断开 OpenAI 账号",
        hint: "连接后，可在上方模型配置中选择 Codex 作为提供商，使用你的 OpenAI 账号额度",
        availableModels: "可用模型",
        selectModel: "选择模型...",
        loadingModels: "正在加载可用模型...",
        connectFirst: "请先连接 OpenAI 账号",
        manualCallbackLabel: "登录后连接失败？",
        manualCallbackHint: "请复制弹窗浏览器地址栏中的完整地址，粘贴到下方即可完成连接",
        manualCallbackPlaceholder: "粘贴回调地址...",
        manualCallbackSubmit: "提交",
        manualCallbackSuccess: "连接成功",
        callbackPortBusy: "检测到本机 1455 端口被占用，请登录后复制弹窗地址栏中的完整地址并粘贴到下方。",
      },
      theme: { label: "主题模式", light: "浅色", dark: "深色", system: "跟随系统" },
      language: { label: "界面语言", zh: "中文", en: "English" },
      fields: {
        aiProviderFormat: "AI 提供商格式",
        aiProviderFormatDesc: "选择 API 请求格式，影响后端如何构造和发送请求。保存设置后生效。",
        openaiFormat: "OpenAI 格式", geminiFormat: "Gemini 格式", lazyllmFormat: "LazyLLM 格式",
        apiBaseUrl: "API Base URL", apiBaseUrlPlaceholder: "https://api.example.com",
        apiBaseUrlDesc: "设置大模型提供商 API 的基础 URL",
        volcengineBaseUrlHint: "当前 Base URL 不是火山 AgentPlans 官方端点（https://ark.cn-beijing.volces.com/api/plan/v3），测试或生成可能失败",
        volcengineBaseUrlReset: "使用官方端点",
        apiKey: "API Key", apiKeyPlaceholder: "输入新的 API Key",
        apiKeyDesc: "留空则保持当前设置不变，输入新值则更新",
        apiKeySet: "已设置（长度: {{length}}）",
        textModel: "文本大模型", textModelPlaceholder: "留空使用环境变量配置 (如: gemini-3-flash-preview)",
        textModelDesc: "用于生成大纲、描述等文本内容的模型名称",
        imageModel: "图像生成模型", imageModelPlaceholder: "留空使用环境变量配置 (如: imagen-3.0-generate-001)",
        imageModelDesc: "用于生成页面图片的模型名称",
        imageCaptionModel: "图片识别模型", imageCaptionModelPlaceholder: "留空使用环境变量配置 (如: gemini-3-flash-preview)",
        imageCaptionModelDesc: "用于识别参考文件中的图片并生成描述",
        mineruApiBase: "MinerU API Base", mineruApiBasePlaceholder: "留空使用环境变量配置 (如: https://mineru.net)",
        mineruApiBaseDesc: "MinerU 服务地址，用于解析参考文件",
        mineruToken: "MinerU Token", mineruTokenPlaceholder: "输入新的 MinerU Token",
        mineruTokenDesc: "留空则保持当前设置不变，输入新值则更新",
        imageResolution: "图像清晰度（某些OpenAI格式中转调整该值无效）",
        imageResolutionDesc: "更高的清晰度会生成更详细的图像，但需要更长时间",
        enableImageQualityControl: "启用质量控制模式",
        enableImageQualityControlDesc: "开启后，每张图生成后会先检查乱码文字、低质量插画和描述偏离；不通过会自动重试，最终失败时不会落库为新版本",
        descriptionGenerationMode: "描述生成模式", descriptionGenerationModeDesc: "流式模式通过一次 AI 调用逐页生成，体验更流畅；并行模式为每页独立调用 AI，速度更快",
        descriptionGenerationModeStreaming: "流式", descriptionGenerationModeParallel: "并行",
        maxDescriptionWorkers: "描述生成最大并发数", maxDescriptionWorkersDesc: "并行模式下同时生成描述的最大工作线程数 (1-20)，越大速度越快",
        maxImageWorkers: "图像生成最大并发数", maxImageWorkersDesc: "同时生成图像的最大工作线程数 (1-20)，越大速度越快",
        defaultOutputLanguage: "默认输出语言", defaultOutputLanguageDesc: "AI 生成内容时使用的默认语言",
        enableTextReasoning: "启用文本推理", enableTextReasoningDesc: "开启后，文本生成（大纲、描述等）会使用 extended thinking 进行深度推理",
        textThinkingBudget: "文本思考负载", textThinkingBudgetDesc: "文本推理的思考 token 预算 (1-8192)，数值越大推理越深入",
        enableImageReasoning: "启用图像推理", enableImageReasoningDesc: "开启后，图像生成会使用思考链模式，可能获得更好的构图效果",
        imageThinkingBudget: "图像思考负载", imageThinkingBudgetDesc: "图像推理的思考 token 预算 (1-8192)，数值越大推理越深入",
        baiduOcrApiKey: "百度 API Key", baiduOcrApiKeyPlaceholder: "输入百度 API Key",
        baiduOcrApiKeyDesc: "用于可编辑 PPTX 导出时的文字识别功能，留空则保持当前设置不变",
        elevenLabsEnabled: "启用 ElevenLabs 语音合成",
        elevenLabsEnabledDesc: "开启后，视频导出将使用 ElevenLabs 代替 edge-tts 生成旁白音频，音质更自然",
        elevenLabsApiKey: "ElevenLabs API Key", elevenLabsApiKeyPlaceholder: "输入 ElevenLabs API Key",
        elevenLabsApiKeyDesc: "留空则保持当前设置不变，API Key 可在 ElevenLabs 控制台获取",
        applyLink: "，请点击此处申请",
        textModelSource: "文本模型提供商格式", textModelSourceDesc: "选择文本生成使用的提供商格式", textModelSourcePlaceholder: "-- 请选择 --",
        imageModelSource: "图片模型提供商格式", imageModelSourceDesc: "选择图片生成使用的提供商格式", imageModelSourcePlaceholder: "-- 请选择 --", imageSourceUnavailable: "当前厂商不支持图片生成，请选择其他提供商",
        imageCaptionModelSource: "图片识别模型提供商格式", imageCaptionModelSourceDesc: "选择图片识别使用的提供商格式", imageCaptionModelSourcePlaceholder: "-- 请选择 --",
        vendorApiKey: "{{vendor}} API Key", vendorApiKeyPlaceholder: "输入 {{vendor}} API Key",
        vendorApiKeyDesc: "留空则保持当前设置不变，输入新值则更新",
        vendorApiKeySet: "已设置（长度: {{length}}）",
        selectPlaceholder: "-- 请选择 --",
        modelProvider: "提供商", modelProviderDesc: "为此模型选择独立的提供商，不选则使用上方默认配置",
        modelProviderPlaceholder: "-- 使用默认配置 --",
        perModelApiBaseUrl: "API Base URL", perModelApiBaseUrlPlaceholder: "留空使用默认 Base URL",
        perModelApiKey: "API Key", perModelApiKeyPlaceholder: "输入 API Key",
        perModelApiKeyDesc: "留空则保持当前设置不变",
        perModelApiKeySet: "已设置（长度: {{length}}）",
        imageApiProtocol: "图片 API 协议",
        imageApiProtocolDesc: "选择图片生成使用的 API 路径。自动检测根据模型名判断，也可强制指定",
        imageApiProtocolAuto: "自动检测",
        imageApiProtocolImages: "images.generate",
        imageApiProtocolChat: "chat.completions",
      },
      apiKeyHelp: {
        title: "如何获取 API 密钥",
        step1: "打开 {{link}}，登录或注册账号",
        step2: "进入 Console 控制台，先在左侧 Account 区域点击「Top Up」完成充值",
        step3: "充值后在左侧 Develop 区域点击「API Keys」",
        step4: "在 API Keys 页面点击「Add key」生成新的 API Key，并复制到本页",
        linkLabel: "访问 AIHubMix 官网 →",
        copyLink: "复制链接",
      },
      apiKeyTip: { before: "若需快速配置或稳定高并发生图，可选择 ", linkLabel: "AIHubMix 申请 API Key", after: "" },
      apimartKeyHelp: {
        title: "如何获取 APIMart API Key",
        step1: "打开 {{link}}，注册或登录 APIMart",
        step2: "进入 APIMart 控制台并完成账户设置",
        step3: "在控制台创建新的 API Key",
        step4: "将 API Key 复制到本页并保存设置",
        linkLabel: "打开 APIMart →",
        copyLink: "复制链接",
      },
      apimartApiKeyTip: { before: "当前已选择 APIMart，请前往 ", linkLabel: "APIMart 获取 API Key", after: "" },
      providerComparison: {
        apimart: {
          name: "APIMart",
          providerHint: "仅需 $0.006/张",
          tagline: "低价生图 · 按量付费",
          suitedFor: "适合：高频图片生成、批量出图或关注使用成本",
          point1: "GPT-Image-2 低至 $0.006/张",
          point2: "1 美元可生成 160+ 张图片",
          point3: "按量付费、无月费",
          cta: "使用 APIMart",
          active: "当前方案",
          link: "注册并获取 API Key →",
          note: "自动填入 APIMart 端点和推荐模型",
        },
        volcengine: {
          name: "火山 Agent Plan",
          tagline: "国内直连 · 高性价比",
          suitedFor: "适合：国内网络、个人使用、追求性价比",
          point1: "国内直连，无需特殊网络环境",
          point2: "效果接近海外主流，价格更低",
          point3: "订阅后可日常使用，不局限于 Banana Slides",
          cta: "选择此方案",
          active: "当前方案",
          link: "查看优惠并订阅 →",
          note: "自动填入火山 Agent Plan 专属端点并推荐模型",
        },
      },
      volcenginePromo: {
        providerHint: "国内直连",
        title: "为什么选择火山 Agent Plan？",
        body: "相比海外主流官方 API，价格更低、性价比更高，生成效果接近；国内直连，无需特殊网络环境。订阅后还可用于日常使用和其他兼容工具，不局限于 Banana Slides。官方活动页目前还提供 Agent Plan / Coding Plan 限时折扣、豆包模型资源包和免费 Tokens。",
        cta: "查看优惠并订阅",
        copy: "复制链接",
        guideLink: "火山 AgentPlans",
        applyModels: "一键填写推荐模型",
      },
      volcengineKeyHelp: {
        title: "订阅并获取火山 AgentPlans API Key",
        step1: "打开官方活动页，订阅",
        step2: "进入 Agent Plan 控制台",
        step3: "在 Agent Plan 控制台创建专属 API Key",
        step4: "回到本页填写 Agent Plan 专属 API Key",
        apikeyConsoleLabel: "API Key 控制台",
      },
      doubaoVolcenginePromo: {
        providerHint: "国内直连",
        title: "为什么选择豆包 / 火山方舟？",
        body: "国内直连，无需特殊网络环境；API Key 可用于 Banana Slides、日常开发和其他兼容工具。官方活动还提供豆包图像创作模型 5.0、模型资源包、Agent Plan / Coding Plan 限时折扣和免费 Tokens。",
        cta: "查看官方活动",
        copy: "复制链接",
        guideLink: "火山引擎官方活动页",
        applyModels: "一键填写推荐模型",
        tokenTitle: "免费 Tokens 额度领取流程",
        tokenStep1: "登录火山引擎账号并打开官方活动页",
        tokenStep2: "点击活动页的「立即领取」",
        tokenStep3: "进入火山方舟控制台，点击「开通服务」并完成「一键授权」",
        tokenStep4: "单个模型可领取 50 万 Tokens，累计额度以活动页展示为准；调用时仍需填写普通方舟 API Key",
      },
      doubaoKeyHelp: {
        title: "领取额度并获取普通方舟 API Key",
        step1: "打开官方活动页，注册或登录火山引擎账号",
        step2: "需要免费 Tokens 时，点击活动页的「立即领取」，进入火山方舟控制台完成「开通服务」和「一键授权」",
        step3: "在火山方舟控制台开通需要调用的豆包模型，并前往 API Key 管理页面创建普通方舟 API Key",
        step4: "回到本页填写普通方舟 API Key；Agent/Coding Plan 专属 Key 不适用",
      },
      serviceTest: {
        title: "服务测试", description: "提前验证关键服务配置是否可用，避免使用期间异常。",
        tip: "提示：图像生成测试可能需要数分钟（取决于模型），请耐心等待。",
        startTest: "开始测试", testing: "测试中...", testTimeout: "测试超时，请重试", testFailed: "测试失败",
        tests: {
          baiduOcr: { title: "Baidu OCR 服务", description: "识别测试图片文字，验证 BAIDU_API_KEY 配置" },
          textModel: { title: "文本生成模型", description: "发送短提示词，验证文本模型与 API 配置" },
          captionModel: { title: "图片识别模型", description: "生成测试图片并请求模型输出描述" },
          baiduInpaint: { title: "Baidu 图像修复", description: "使用测试图片执行修复，验证百度 inpaint 服务" },
          imageModel: { title: "图像生成模型", description: "基于测试图片生成演示文稿背景图（固定分辨率，可能需要 20-40 秒）" },
          mineruPdf: { title: "MinerU 解析 PDF", description: "上传测试 PDF 并等待解析结果返回（可能需要 30-60 秒）" }
        },
        results: {
          recognizedText: "识别结果：{{text}}", modelReply: "模型回复：{{reply}}",
          captionDesc: "识别描述：{{caption}}", imageSize: "输出尺寸：{{width}}x{{height}}",
          parsePreview: "解析预览：{{preview}}"
        }
      },
      actions: { save: "保存设置", saveAndReturn: "保存并返回", saving: "保存中...", resetToDefault: "重置为默认配置" },
      recovery: {
        title: "修复 API 配置后返回继续创作",
        description: "当前操作因 API 密钥、权限、余额或限流问题失败。保存配置后将自动返回原编辑页面，你可以在那里重新发起生成。",
      },
      messages: {
        loadFailed: "加载设置失败", saveSuccess: "设置保存成功", saveFailed: "保存设置失败",
        resetConfirm: "将把大模型、图像生成和并发等所有配置恢复为环境默认值，已保存的自定义设置将丢失，确定继续吗？",
        resetTitle: "确认重置为默认配置", resetSuccess: "设置已重置", resetFailed: "重置设置失败",
        testServiceTip: "建议在本页底部进行服务测试，验证关键配置",
        resetConfirmBtn: "确定重置", resetCancelBtn: "取消", unknownError: "未知错误",
        testSuccess: "测试成功"
      }
    }
  },
  en: {
    nav: { backToHome: 'Back to Home', backToEditor: 'Back to Editor' },
    settings: {
      title: "Settings",
      subtitle: "Configure application parameters",
      sections: {
        appearance: "Appearance", language: "Interface Language", apiConfig: "Default API Configuration",
        apiConfigDesc: "Used as fallback when a model below has no provider specified",
        modelConfig: "Model Configuration", mineruConfig: "MinerU Configuration", imageConfig: "Image Generation Configuration",
        performanceConfig: "Performance Configuration", outputLanguage: "Output Language Settings",
        textReasoning: "Text Reasoning Mode", imageReasoning: "Image Reasoning Mode",
        baiduOcr: "Baidu Configuration", serviceTest: "Service Test", lazyllmConfig: "LazyLLM Provider Configuration",
        vendorApiKeys: "Vendor API Key Configuration",
        advancedSettings: "Advanced Settings",
        elevenlabs: "ElevenLabs Text-to-Speech",
        about: "About"
      },
      about: {
        version: "Current Version",
        source: "GitHub Project",
        checkUpdate: "Check for Updates",
        checking: "Checking...",
        upToDate: "You're currently on the latest version",
        updateAvailable: "Version update available: {{version}}",
        unknown: "Unable to determine whether this is the latest version",
        failed: "Failed to check for updates",
        resultTitle: "Update Check Result",
        download: "Download",
        close: "Close",
      },
      openaiOAuth: {
        title: "OpenAI Account",
        description: "Log in with your OpenAI account via OAuth to use OpenAI models (e.g. GPT Image) without entering an API key",
        loginBtn: "Login with OpenAI",
        disconnectBtn: "Disconnect",
        connected: "Connected",
        disconnected: "Not connected",
        account: "Account",
        connecting: "Connecting...",
        disconnecting: "Disconnecting...",
        connectFailed: "Connection failed",
        popupBlocked: "The login window was blocked. Allow popups and try again.",
        connectTimeout: "Login timed out. Try again or use the manual callback option.",
        disconnectFailed: "Disconnect failed",
        disconnectSuccess: "OpenAI account disconnected",
        hint: "When connected, select Codex as the provider in model configuration above to use your OpenAI account credits",
        availableModels: "Available Models",
        selectModel: "Select a model...",
        loadingModels: "Loading available models...",
        connectFirst: "Please connect your OpenAI account first",
        manualCallbackLabel: "Connection failed after login?",
        manualCallbackHint: "Copy the full URL from the popup's address bar and paste it below to complete the connection",
        manualCallbackPlaceholder: "Paste callback URL...",
        manualCallbackSubmit: "Submit",
        manualCallbackSuccess: "Connected successfully",
        callbackPortBusy: "Port 1455 is already in use. After logging in, copy the full popup address-bar URL and paste it below.",
      },
      theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
      language: { label: "Interface Language", zh: "中文", en: "English" },
      fields: {
        aiProviderFormat: "AI Provider Format",
        aiProviderFormatDesc: "Select API request format, affects how backend constructs and sends requests. Takes effect after saving.",
        openaiFormat: "OpenAI Format", geminiFormat: "Gemini Format", lazyllmFormat: "LazyLLM Format",
        apiBaseUrl: "API Base URL", apiBaseUrlPlaceholder: "https://api.example.com",
        apiBaseUrlDesc: "Set the base URL for the LLM provider API",
        volcengineBaseUrlHint: "The current Base URL is not the official Volcengine AgentPlans endpoint (https://ark.cn-beijing.volces.com/api/plan/v3); tests or generation may fail",
        volcengineBaseUrlReset: "Use official endpoint",
        apiKey: "API Key", apiKeyPlaceholder: "Enter new API Key",
        apiKeyDesc: "Leave empty to keep current setting, enter new value to update",
        apiKeySet: "Set (length: {{length}})",
        textModel: "Text Model", textModelPlaceholder: "Leave empty to use env config (e.g., gemini-3-flash-preview)",
        textModelDesc: "Model name for generating outlines, descriptions, etc.",
        imageModel: "Image Generation Model", imageModelPlaceholder: "Leave empty to use env config (e.g., imagen-3.0-generate-001)",
        imageModelDesc: "Model name for generating page images",
        imageCaptionModel: "Image Caption Model", imageCaptionModelPlaceholder: "Leave empty to use env config (e.g., gemini-3-flash-preview)",
        imageCaptionModelDesc: "Model for recognizing images in reference files and generating descriptions",
        mineruApiBase: "MinerU API Base", mineruApiBasePlaceholder: "Leave empty to use env config (e.g., https://mineru.net)",
        mineruApiBaseDesc: "MinerU service address for parsing reference files",
        mineruToken: "MinerU Token", mineruTokenPlaceholder: "Enter new MinerU Token",
        mineruTokenDesc: "Leave empty to keep current setting, enter new value to update",
        imageResolution: "Image Resolution (may not work with some OpenAI format proxies)",
        imageResolutionDesc: "Higher resolution generates more detailed images but takes longer",
        enableImageQualityControl: "Enable Quality Control",
        enableImageQualityControlDesc: "When enabled, each generated image is reviewed for garbled text, low-quality illustration, and prompt mismatch before it is saved; rejected images retry automatically and failed attempts are not saved as versions",
        descriptionGenerationMode: "Description Generation Mode", descriptionGenerationModeDesc: "Streaming mode generates all pages in a single AI call for a smoother experience; Parallel mode calls AI independently per page for faster speed",
        descriptionGenerationModeStreaming: "Streaming", descriptionGenerationModeParallel: "Parallel",
        maxDescriptionWorkers: "Max Description Workers", maxDescriptionWorkersDesc: "Maximum concurrent workers for description generation in parallel mode (1-20), higher is faster",
        maxImageWorkers: "Max Image Workers", maxImageWorkersDesc: "Maximum concurrent workers for image generation (1-20), higher is faster",
        defaultOutputLanguage: "Default Output Language", defaultOutputLanguageDesc: "Default language for AI-generated content",
        enableTextReasoning: "Enable Text Reasoning", enableTextReasoningDesc: "When enabled, text generation uses extended thinking for deeper reasoning",
        textThinkingBudget: "Text Thinking Budget", textThinkingBudgetDesc: "Token budget for text reasoning (1-8192), higher values enable deeper reasoning",
        enableImageReasoning: "Enable Image Reasoning", enableImageReasoningDesc: "When enabled, image generation uses chain-of-thought mode for better composition",
        imageThinkingBudget: "Image Thinking Budget", imageThinkingBudgetDesc: "Token budget for image reasoning (1-8192), higher values enable deeper reasoning",
        baiduOcrApiKey: "Baidu API Key", baiduOcrApiKeyPlaceholder: "Enter Baidu API Key",
        baiduOcrApiKeyDesc: "For text recognition in editable PPTX export, leave empty to keep current setting",
        elevenLabsEnabled: "Enable ElevenLabs Text-to-Speech",
        elevenLabsEnabledDesc: "When enabled, video export uses ElevenLabs instead of edge-tts for narration audio, providing more natural voice quality",
        elevenLabsApiKey: "ElevenLabs API Key", elevenLabsApiKeyPlaceholder: "Enter ElevenLabs API Key",
        elevenLabsApiKeyDesc: "Leave empty to keep current setting. Get your API key from the ElevenLabs dashboard",
        applyLink: ", click here to apply",
        textModelSource: "Text Model Provider Format", textModelSourceDesc: "Select the provider format for text generation", textModelSourcePlaceholder: "-- Select --",
        imageModelSource: "Image Model Provider Format", imageModelSourceDesc: "Select the provider format for image generation", imageModelSourcePlaceholder: "-- Select --", imageSourceUnavailable: "This vendor has no image-generation capability; pick another provider",
        imageCaptionModelSource: "Image Caption Model Provider Format", imageCaptionModelSourceDesc: "Select the provider format for image captioning", imageCaptionModelSourcePlaceholder: "-- Select --",
        vendorApiKey: "{{vendor}} API Key", vendorApiKeyPlaceholder: "Enter {{vendor}} API Key",
        vendorApiKeyDesc: "Leave empty to keep current setting, enter new value to update",
        vendorApiKeySet: "Set (length: {{length}})",
        selectPlaceholder: "-- Select --",
        modelProvider: "Provider", modelProviderDesc: "Select an independent provider for this model, leave empty to use default config",
        modelProviderPlaceholder: "-- Use default config --",
        perModelApiBaseUrl: "API Base URL", perModelApiBaseUrlPlaceholder: "Leave empty to use default Base URL",
        perModelApiKey: "API Key", perModelApiKeyPlaceholder: "Enter API Key",
        perModelApiKeyDesc: "Leave empty to keep current setting",
        perModelApiKeySet: "Set (length: {{length}})",
        imageApiProtocol: "Image API Protocol",
        imageApiProtocolDesc: "Select the API path for image generation. Auto detects by model name, or force a specific path",
        imageApiProtocolAuto: "Auto detect",
        imageApiProtocolImages: "images.generate",
        imageApiProtocolChat: "chat.completions",
      },
      apiKeyHelp: {
        title: "How to get an API key",
        step1: "Open {{link}}, then sign in or create an account",
        step2: "Go to Console and first choose Account → Top Up in the left sidebar to add credits",
        step3: "After topping up, choose Develop → API Keys in the left sidebar",
        step4: "Click \"Add key\" on the API Keys page to create a new API key, then copy it into this page",
        linkLabel: "Open AIHubMix →",
        copyLink: "Copy link",
      },
      apiKeyTip: { before: "For quick setup or stable high-concurrency image generation, get an API key from ", linkLabel: "AIHubMix", after: "" },
      apimartKeyHelp: {
        title: "How to get an APIMart API key",
        step1: "Open {{link}}, then sign in or create an APIMart account",
        step2: "Open the APIMart console and complete your account setup",
        step3: "Create a new API key in the console",
        step4: "Copy the API key into this page and save the settings",
        linkLabel: "Open APIMart →",
        copyLink: "Copy link",
      },
      apimartApiKeyTip: { before: "APIMart is selected. Get an API key from ", linkLabel: "APIMart", after: "" },
      providerComparison: {
        apimart: {
          name: "APIMart",
          providerHint: "Only $0.006/image",
          tagline: "Low-cost images · Pay as you go",
          suitedFor: "Best for: frequent image generation, batch workloads, or cost-conscious usage",
          point1: "GPT-Image-2 from $0.006 per image",
          point2: "Generate 160+ images per dollar",
          point3: "Pay as you go with no monthly fee",
          cta: "Use APIMart",
          active: "Current plan",
          link: "Sign up and get an API key →",
          note: "Fills the APIMart endpoint and recommended models automatically",
        },
        volcengine: {
          name: "Volcengine Agent Plan",
          tagline: "Direct access · Cost-effective",
          suitedFor: "Best for: domestic networks, personal use, or budget-conscious users",
          point1: "Direct domestic access, no special network setup",
          point2: "Comparable quality at a lower price than major overseas APIs",
          point3: "Subscription also works for daily use, not only Banana Slides",
          cta: "Choose this plan",
          active: "Current plan",
          link: "View plans and subscribe →",
          note: "Fills the Agent Plan endpoint and recommended models automatically",
        },
      },
      volcenginePromo: {
        providerHint: "Direct access",
        title: "Why choose Volcengine Agent Plan?",
        body: "It is more cost-effective than major overseas model APIs while offering comparable generation quality. The subscription can also be used for everyday work and other compatible tools—not only Banana Slides. The official campaign currently includes Agent Plan and Coding Plan discounts, Doubao model bundles, and free Tokens.",
        cta: "View plans and subscribe",
        copy: "Copy link",
        guideLink: "Volcengine AgentPlans",
        applyModels: "Fill recommended models",
      },
      volcengineKeyHelp: {
        title: "Subscribe and get a Volcengine AgentPlans API Key",
        step1: "Open the official campaign page and subscribe to ModelArk Agent Plan",
        step2: "Go to the Agent Plan console",
        step3: "Create a dedicated API Key in the Agent Plan console",
        step4: "Return here and enter the dedicated Agent Plan API Key",
        apikeyConsoleLabel: "API Key console",
      },
      doubaoVolcenginePromo: {
        providerHint: "Direct access",
        title: "Why choose Doubao / ModelArk?",
        body: "The API key works with Banana Slides, everyday development, and other compatible tools. The official campaign includes Doubao image creation model 5.0, model bundles, Agent Plan and Coding Plan discounts, and free Tokens. Enter a standard ModelArk API Key here, not a dedicated Agent/Coding Plan key.",
        cta: "View official campaign",
        copy: "Copy link",
        guideLink: "official Volcengine campaign page",
        applyModels: "Fill recommended models",
        tokenTitle: "Free Tokens quota claim flow",
        tokenStep1: "Sign in to Volcengine and open the official campaign page",
        tokenStep2: "Click \"Claim now\" on the campaign page",
        tokenStep3: "Go to the ModelArk console, click \"Activate service\", and complete one-click authorization",
        tokenStep4: "Each model can claim 500K Tokens; total quota follows the campaign page. Calls still use a standard ModelArk API Key",
      },
      doubaoKeyHelp: {
        title: "Claim quota and get a standard ModelArk API Key",
        step1: "Open the official campaign page and sign in to Volcengine",
        step2: "To claim free Tokens, click \"Claim now\" on the campaign page, then activate service and complete one-click authorization in the ModelArk console",
        step3: "Activate the Doubao model services you need in ModelArk, then open API Key management and create a standard ModelArk API Key",
        step4: "Return here and enter the standard ModelArk API Key; dedicated Agent/Coding Plan keys do not apply",
      },
      serviceTest: {
        title: "Service Test", description: "Verify key service configurations before use to avoid issues.",
        tip: "Tip: Image generation tests may take several minutes depending on the model, please be patient.",
        startTest: "Start Test", testing: "Testing...", testTimeout: "Test timeout, please retry", testFailed: "Test failed",
        tests: {
          baiduOcr: { title: "Baidu OCR Service", description: "Recognize text in test image, verify BAIDU_API_KEY configuration" },
          textModel: { title: "Text Generation Model", description: "Send short prompt to verify text model and API configuration" },
          captionModel: { title: "Image Caption Model", description: "Generate test image and request model to output description" },
          baiduInpaint: { title: "Baidu Image Inpainting", description: "Use test image for inpainting, verify Baidu inpaint service" },
          imageModel: { title: "Image Generation Model", description: "Generate presentation background from test image (fixed resolution, may take 20-40 seconds)" },
          mineruPdf: { title: "MinerU PDF Parsing", description: "Upload test PDF and wait for parsing result (may take 30-60 seconds)" }
        },
        results: {
          recognizedText: "Recognized: {{text}}", modelReply: "Model reply: {{reply}}",
          captionDesc: "Caption: {{caption}}", imageSize: "Output size: {{width}}x{{height}}",
          parsePreview: "Parse preview: {{preview}}"
        }
      },
      actions: { save: "Save Settings", saveAndReturn: "Save and Return", saving: "Saving...", resetToDefault: "Reset to Default" },
      recovery: {
        title: "Fix the API configuration and return to editing",
        description: "The previous action failed because of an API key, permission, balance, or rate-limit problem. After saving, you will return to the editor and can retry generation there.",
      },
      messages: {
        loadFailed: "Failed to load settings", saveSuccess: "Settings saved successfully", saveFailed: "Failed to save settings",
        resetConfirm: "This will reset all configurations (LLM, image generation, concurrency, etc.) to environment defaults. Custom settings will be lost. Continue?",
        resetTitle: "Confirm Reset to Default", resetSuccess: "Settings reset successfully", resetFailed: "Failed to reset settings",
        testServiceTip: "It's recommended to test services at the bottom of this page to verify configurations",
        resetConfirmBtn: "Confirm Reset", resetCancelBtn: "Cancel", unknownError: "Unknown error",
        testSuccess: "Test passed"
      }
    }
  }
};
import { Button, Input, Card, Loading, Modal, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { OutputLanguage, UpdateCheckInfo } from '@/api/endpoints';
import { OUTPUT_LANGUAGE_OPTIONS } from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';

// 配置项类型定义
type FieldType = 'text' | 'password' | 'number' | 'select' | 'buttons' | 'switch';

interface FieldConfig {
  key: keyof typeof initialFormData;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  sensitiveField?: boolean;  // 是否为敏感字段（如 API Key）
  lengthKey?: keyof SettingsType;  // 用于显示已有长度的 key（如 api_key_length）
  options?: { value: string; label: string }[];  // select 类型的选项
  min?: number;
  max?: number;
  link?: string;  // 申请链接 URL
}

interface SectionConfig {
  title: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface ServiceTestState {
  status: TestStatus;
  message?: string;
  detail?: string;
}

const INFERERA_AFFILIATE_URL = 'https://api.inferera.com/?aff=17EC';
const APIMART_SIGNUP_URL = 'https://go.apimart.ai/gh-banana-slides';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const APIMART_BASE_URL = 'https://api.apimart.ai/v1';
const VOLCENGINE_AGENTPLANS_CN_URL = 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides';
const VOLCENGINE_AGENTPLANS_EN_URL = 'https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=banana-slides&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides';
const VOLCENGINE_AGENTPLANS_APIKEY_URL = 'https://ai.volcengine.com/console/apikey';

// LazyLLM 支持的厂商列表
const LAZYLLM_SOURCES = [
  { value: 'qwen', label: 'Qwen (通义千问)' },
  { value: 'doubao', label: 'Doubao (火山引擎)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm', label: 'GLM (智谱)' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'sensenova', label: 'SenseNova (商汤)' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'ppio', label: 'PPIO (派欧云)' },
  { value: 'aiping', label: 'AIPing (爱拼)' },
];

// 所有可用的提供商选项（Gemini/OpenAI/Codex + LazyLLM 厂商）
const getAllProviderSources = (isZh: boolean) => [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'volcengine', label: isZh ? '火山 Agent Plan' : 'Volcengine Agent Plan' },
  { value: 'doubao', label: isZh ? 'Doubao（豆包）' : 'Doubao / ModelArk' },
  { value: 'codex', label: 'Codex (OpenAI OAuth)' },
  ...LAZYLLM_SOURCES.filter(s => !['openai', 'doubao', 'ppio', 'aiping'].includes(s.value)), // avoid duplicate or non-partner providers
];

// 需要 API Key + Base URL 的提供商（非 LazyLLM 厂商）
const API_KEY_PROVIDERS = new Set(['gemini', 'openai', 'volcengine']);
const APIMART_RECOMMENDED_MODELS = {
  text: 'gpt-5.6-sol',
  image: 'gpt-image-2',
  caption: 'gpt-5.6-luna',
};
const isApimartBaseUrl = (url: string) =>
  url.trim().replace(/\/+$/, '') === APIMART_BASE_URL;
// 火山 Agent Plans（OpenAI 兼容）: 专属 Base URL 与模型名
const VOLCENGINE_AGENTPLANS_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3';
const VOLCENGINE_AGENTPLANS_RECOMMENDED_MODELS = {
  text: 'doubao-seed-2.1-turbo',
  caption: 'doubao-seed-2.1-turbo',
  image: 'doubao-seedream-5.0-lite',
};
// 火山方舟（标准 ModelArk, LazyLLM Doubao 路径）: 使用端点 ID 格式
const VOLCENGINE_MODELARK_RECOMMENDED_MODELS = {
  text: 'doubao-seed-2-1-pro-260628',
  caption: 'doubao-seed-2-1-pro-260628',
  image: 'doubao-seedream-5-0-260128',
};
// 各 provider 的默认端点: 切换到 Agent Plans 时用于识别并清除过时默认值
const KNOWN_DEFAULT_BASE_URLS = new Set([
  '',
  'https://api.inferera.com/v1',
  'https://api.openai.com/v1',
  APIMART_BASE_URL,
  'https://api.inferera.com/gemini',
  'https://generativelanguage.googleapis.com',
  'https://ark.cn-beijing.volces.com/api/v3',
  'https://api.anthropic.com',
]);
// 离开 Agent Plans 时必须清空的火山默认端点（对 openai/gemini 等是过时值）
const VOLCENGINE_DEFAULT_BASE_URLS = new Set([
  'https://ark.cn-beijing.volces.com/api/plan/v3',
  'https://ark.cn-beijing.volces.com/api/v3',
]);

// LazyLLM 厂商名集合
const LAZYLLM_VENDOR_SET = new Set(LAZYLLM_SOURCES.map(s => s.value));

// LazyLLM 0.7.x vendors that actually register an image-generation (text2image)
// supplier; image-model source options are filtered to this set so a selection
// cannot point at a vendor without image capability.
const IMAGE_CAPABLE_LAZYLLM_SOURCES = new Set([
  'qwen', 'doubao', 'siliconflow', 'aiping', 'glm', 'minimax',
]);

// Whether a source value can appear in the image-model source dropdown:
// real OpenAI provider plus LazyLLM vendors that register a text2image
// supplier. Non-LazyLLM sources (gemini/volcengine/codex) always pass.
const isImageModelSourceSelectable = (value: string) =>
  value === 'openai'
  || !LAZYLLM_VENDOR_SET.has(value)
  || IMAGE_CAPABLE_LAZYLLM_SOURCES.has(value);

// 初始表单数据
const initialFormData = {
  ai_provider_format: 'gemini' as string,
  api_base_url: '',
  api_key: '',
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token: '',
  image_resolution: '2K',
  enable_image_quality_control: false,
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh' as OutputLanguage,
  // 推理模式配置（分别控制文本和图像）
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_api_key: '',
  // LazyLLM 配置
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys: {} as Record<string, string>,
  // Per-model API credentials (for gemini/openai per-model overrides)
  text_api_key: '',
  text_api_base_url: '',
  image_api_key: '',
  image_api_base_url: '',
  image_caption_api_key: '',
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'auto',
  // ElevenLabs TTS
  elevenlabs_api_key: '',
};

const isLazyllmVendor = (vendor: string) =>
  LAZYLLM_VENDOR_SET.has(vendor) && vendor !== 'openai';

// When backend returns "lazyllm", infer specific vendor from configured keys
const resolveLazyllmVendor = (format: string, keysInfo?: Record<string, number>): string => {
  if (format !== 'lazyllm') return format;
  if (keysInfo) {
    const vendor = LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value) && keysInfo[s.value]);
    if (vendor) return vendor.value;
  }
  return LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value))?.value || 'deepseek';
};

const GlobalVendorKeyInput: React.FC<{
  vendor: string; formData: typeof initialFormData;
  setFormData: React.Dispatch<React.SetStateAction<typeof initialFormData>>;
  settings: SettingsType | null; t: ReturnType<typeof useT>;
}> = ({ vendor, formData, setFormData, settings, t }) => {
  const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === vendor)?.label || vendor.toUpperCase();
  const keyLength = settings?.lazyllm_api_keys_info?.[vendor] || 0;
  const placeholder = keyLength > 0
    ? t('settings.fields.vendorApiKeySet', { length: keyLength })
    : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });
  return (
    <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
      <Input
        label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
        type="password"
        placeholder={placeholder}
        value={formData.lazyllm_api_keys[vendor] || ''}
        onChange={(e) => {
          setFormData(prev => ({
            ...prev,
            lazyllm_api_keys: { ...prev.lazyllm_api_keys, [vendor]: e.target.value }
          }));
        }}
      />
      <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.vendorApiKeyDesc')}</p>
    </div>
  );
};

type SettingsTranslator = ReturnType<typeof useT>;

interface UpdateResultView {
  status: 'up_to_date' | 'update_available' | 'unknown';
  updateAvailable: boolean;
  version: string;
  downloadUrl?: string;
}

function getLatestVersion(info: UpdateCheckInfo): string {
  const sha = info.latest?.sha;
  if (sha) {
    return sha.length > 7 ? sha.slice(0, 7) : sha;
  }
  return info.latest?.tag || '';
}

function toUpdateResultView(info: UpdateCheckInfo): UpdateResultView {
  return {
    status: info.status,
    updateAvailable: info.update_available,
    version: getLatestVersion(info),
  };
}

function toDesktopUpdateResultView(info: DesktopUpdateCheckResult): UpdateResultView {
  if (info.status === 'update_available' && info.update) {
    return {
      status: 'update_available',
      updateAvailable: true,
      version: info.update.version,
      downloadUrl: info.update.url,
    };
  }

  return {
    status: 'up_to_date',
    updateAvailable: false,
    version: info.latestVersion,
  };
}

function formatUpdateMessage(t: SettingsTranslator, info: UpdateResultView): string {
  if (info.status === 'up_to_date') return t('settings.about.upToDate');
  if (info.status === 'update_available') return t('settings.about.updateAvailable', { version: info.version });
  return t('settings.about.unknown');
}

export const SettingsAbout: React.FC<{ t: SettingsTranslator }> = ({ t }) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateResultView | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError('');
    try {
      if (isDesktop) {
        const response = await (window as any).electronAPI.checkForUpdates() as DesktopUpdateCheckResult;
        setUpdateInfo(toDesktopUpdateResultView(response));
      } else {
        const response = await api.checkForUpdates();
        setUpdateInfo(response.data ? toUpdateResultView(response.data) : null);
      }
      setUpdateDialogOpen(true);
    } catch (error: any) {
      setUpdateInfo(null);
      setUpdateError(error?.response?.data?.error?.message || error?.message || t('settings.about.failed'));
      setUpdateDialogOpen(true);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const showSuccessCheck = updateInfo?.status === 'up_to_date';

  return (
    <>
      <div className="pt-4 border-t border-gray-200 dark:border-border-primary">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-3 flex items-center">
          <Info size={20} />
          <span className="ml-2">{t('settings.sections.about')}</span>
        </h2>
        <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-foreground-tertiary sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div title={appVersion.detail} aria-label={`${t('settings.about.version')} ${appVersion.detail}`}>
              {t('settings.about.version')}: {appVersion.display}
            </div>
            <a
              href="https://github.com/Anionex/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-banana-700 dark:text-banana hover:underline"
            >
              {t('settings.about.source')}
            </a>
            {updateInfo && (
              <div className={updateInfo.updateAvailable ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-foreground-tertiary'}>
                <div>{formatUpdateMessage(t, updateInfo)}</div>
              </div>
            )}
            {updateError && (
              <div className="text-red-600 dark:text-red-400">
                {t('settings.about.failed')}: {updateError}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />}
            onClick={handleCheckUpdate}
            loading={checkingUpdate}
          >
            {checkingUpdate ? t('settings.about.checking') : t('settings.about.checkUpdate')}
          </Button>
        </div>
      </div>

      <Modal isOpen={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} title={t('settings.about.resultTitle')}>
        <div className="space-y-4">
          {updateInfo && (
            <div className="space-y-2 text-sm text-gray-700 dark:text-foreground-secondary">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                {showSuccessCheck && (
                  <CheckCircle
                    size={44}
                    data-testid="update-success-icon"
                    className="text-green-600 dark:text-green-400"
                    aria-hidden="true"
                  />
                )}
                {updateInfo.updateAvailable && (
                  <ArrowUp
                    size={44}
                    data-testid="update-available-icon"
                    className="text-orange-600 dark:text-orange-400"
                    aria-hidden="true"
                  />
                )}
                <p className={updateInfo.updateAvailable
                  ? 'text-xl font-semibold text-orange-600 dark:text-orange-400'
                  : 'text-xl font-semibold text-gray-900 dark:text-foreground-primary'
                }>
                  {formatUpdateMessage(t, updateInfo)}
                </p>
              </div>
            </div>
          )}
          {updateError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('settings.about.failed')}: {updateError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {updateInfo?.downloadUrl && (
              <Button
                size="sm"
                onClick={() => (window as any).electronAPI.openExternal(updateInfo.downloadUrl)}
              >
                {t('settings.about.download')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setUpdateDialogOpen(false)}>
              {t('settings.about.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const formDataFromSettings = (data: SettingsType): typeof initialFormData => {
  const providerFormat = resolveLazyllmVendor(data.ai_provider_format || 'gemini', data.lazyllm_api_keys_info).toLowerCase();
  const textModelSource = (data.text_model_source || '').toLowerCase();
  const imageModelSource = (data.image_model_source || '').toLowerCase();
  const imageCaptionModelSource = (data.image_caption_model_source || '').toLowerCase();

  return {
    ai_provider_format: providerFormat,
    api_base_url: data.api_base_url || '',
    api_key: '',
    image_resolution: data.image_resolution || '2K',
    enable_image_quality_control: data.enable_image_quality_control ?? false,
    max_description_workers: data.max_description_workers || 5,
    max_image_workers: data.max_image_workers || 8,
    text_model: data.text_model || '',
    image_model: data.image_model || '',
    mineru_api_base: data.mineru_api_base || '',
    mineru_token: '',
    image_caption_model: data.image_caption_model || '',
    output_language: data.output_language || 'zh',
    enable_text_reasoning: data.enable_text_reasoning || false,
    text_thinking_budget: data.text_thinking_budget || 1024,
    enable_image_reasoning: data.enable_image_reasoning || false,
    image_thinking_budget: data.image_thinking_budget || 1024,
    baidu_api_key: '',
    text_model_source: textModelSource,
    image_model_source: imageModelSource,
    image_caption_model_source: imageCaptionModelSource,
    lazyllm_api_keys: {},
    text_api_key: '',
    text_api_base_url: data.text_api_base_url || '',
    image_api_key: '',
    image_api_base_url: data.image_api_base_url || '',
    image_caption_api_key: '',
    image_caption_api_base_url: data.image_caption_api_base_url || '',
    openai_image_api_protocol: data.openai_image_api_protocol || 'auto',
    elevenlabs_api_key: '',
  };
};

// Settings 组件 - 纯嵌入模式（可复用）
interface SettingsProps {
  onSaveSuccess?: () => void;
  saveLabel?: string;
}

export const Settings: React.FC<SettingsProps> = ({ onSaveSuccess, saveLabel }) => {
  const t = useT(settingsI18n);
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    show({ message: '链接已复制到剪贴板', type: 'success' });
  };

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [manualCallbackUrl, setManualCallbackUrl] = useState('');
  const [manualCallbackOpen, setManualCallbackOpen] = useState(false);
  const [manualCallbackSubmitting, setManualCallbackSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const oauthMonitorStopRef = useRef<(() => void) | null>(null);
  const oauthAttemptRef = useRef(0);
  const allProviderSources = getAllProviderSources(isZh);
  const globalProviderSources = [
    allProviderSources[0],
    { value: 'apimart', label: 'APIMart' },
    allProviderSources[2],
    allProviderSources[1],
    ...allProviderSources.slice(3),
  ];
  const volcengineAgentPlansUrl = isZh ? VOLCENGINE_AGENTPLANS_CN_URL : VOLCENGINE_AGENTPLANS_EN_URL;
  const volcengineLogoUrl = isZh ? '/volcengine/huoshan.png' : '/volcengine/byteplus.png';
  const usesVolcengineCampaignPromo = formData.ai_provider_format === 'volcengine' || formData.ai_provider_format === 'doubao';
  const usesApimartProvider = formData.ai_provider_format === 'openai' && isApimartBaseUrl(formData.api_base_url);
  const selectedGlobalProvider = usesApimartProvider ? 'apimart' : formData.ai_provider_format;
  const activeVolcenginePromoKey = formData.ai_provider_format === 'doubao'
    ? 'settings.doubaoVolcenginePromo'
    : 'settings.volcenginePromo';
  const activeApiKeyHelpKey = formData.ai_provider_format === 'volcengine'
    ? 'settings.volcengineKeyHelp'
    : formData.ai_provider_format === 'doubao'
      ? 'settings.doubaoKeyHelp'
      : usesApimartProvider
        ? 'settings.apimartKeyHelp'
        : 'settings.apiKeyHelp';
  const activeApiKeyHelpUrl = usesApimartProvider ? APIMART_SIGNUP_URL : INFERERA_AFFILIATE_URL;
  const activeApiKeyTipKey = usesApimartProvider ? 'settings.apimartApiKeyTip' : 'settings.apiKeyTip';
  const stopOAuthMonitor = useCallback(() => {
    oauthAttemptRef.current += 1;
    oauthMonitorStopRef.current?.();
    oauthMonitorStopRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopOAuthMonitor();
    };
  }, [stopOAuthMonitor]);

  useEffect(() => {
    if (settings) {
      try {
        sessionStorage.setItem('banana-settings', JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to persist settings in sessionStorage:', error);
      }
    }
  }, [settings]);

  const applyOAuthStatus = useCallback((connected: boolean, accountId: string | null) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        openai_oauth_connected: connected,
        openai_oauth_account_id: accountId,
      };
    });
  }, []);

  const handleOAuthLogin = async () => {
    stopOAuthMonitor();
    const attemptId = oauthAttemptRef.current;
    setOauthConnecting(true);
    try {
      const resp = await api.getOpenAIOAuthUrl();
      if (attemptId !== oauthAttemptRef.current) return;
      if (resp.success && resp.data?.auth_url) {
        if (resp.data.callback_server_available === false) {
          setManualCallbackOpen(true);
          show({ message: t('settings.openaiOAuth.callbackPortBusy'), type: 'warning' });
        }
        const popup = window.open(resp.data.auth_url, 'openai-oauth', 'width=600,height=700');
        if ((!popup || popup.closed) && !isDesktop) {
          setOauthConnecting(false);
          show({ message: t('settings.openaiOAuth.popupBlocked'), type: 'error' });
          return;
        }

        const monitor = startOpenAIOAuthMonitor({
          desktop: isDesktop,
          popup,
          getStatus: async () => {
            const statusResp = await api.getOpenAIOAuthStatus();
            return statusResp.success && statusResp.data ? statusResp.data : null;
          },
          onConnected: status => {
            oauthMonitorStopRef.current = null;
            setOauthConnecting(false);
            applyOAuthStatus(true, status.account_id || null);
            show({ message: t('settings.openaiOAuth.manualCallbackSuccess'), type: 'success' });
          },
          onFailure: (reason, message) => {
            oauthMonitorStopRef.current = null;
            setOauthConnecting(false);
            const errorMessage = reason === 'timeout'
              ? t('settings.openaiOAuth.connectTimeout')
              : message || t('settings.openaiOAuth.connectFailed');
            show({ message: errorMessage, type: 'error' });
          },
        });
        oauthMonitorStopRef.current = monitor.stop;
      } else {
        setOauthConnecting(false);
        show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
      }
    } catch {
      if (attemptId !== oauthAttemptRef.current) return;
      stopOAuthMonitor();
      setOauthConnecting(false);
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      const resp = await api.disconnectOpenAIOAuth();
      if (resp.success) {
        setSettings(prev => prev ? {
          ...prev,
          openai_oauth_connected: false,
          openai_oauth_account_id: null,
        } : prev);
        show({ message: t('settings.openaiOAuth.disconnectSuccess'), type: 'success' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.disconnectFailed'), type: 'error' });
    }
  };

  const handleManualCallback = async () => {
    if (!manualCallbackUrl.trim()) return;
    setManualCallbackSubmitting(true);
    try {
      const resp = await api.submitOAuthManualCallback(manualCallbackUrl.trim());
      if (resp.success) {
        stopOAuthMonitor();
        setOauthConnecting(false);
        setManualCallbackUrl('');
        setManualCallbackOpen(false);
        applyOAuthStatus(true, resp.data?.account_id || null);
        show({ message: t('settings.openaiOAuth.manualCallbackSuccess'), type: 'success' });
      } else {
        show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    } finally {
      setManualCallbackSubmitting(false);
    }
  };

  // 配置驱动的表单区块定义（使用翻译）
  const settingsSections: SectionConfig[] = [
    // Global API config & Model config are rendered separately above
    {
      title: t('settings.sections.mineruConfig'),
      icon: <FileText size={20} />,
      fields: [
        {
          key: 'mineru_api_base',
          label: t('settings.fields.mineruApiBase'),
          type: 'text',
          placeholder: t('settings.fields.mineruApiBasePlaceholder'),
          description: t('settings.fields.mineruApiBaseDesc'),
        },
        {
          key: 'mineru_token',
          label: t('settings.fields.mineruToken'),
          type: 'password',
          placeholder: t('settings.fields.mineruTokenPlaceholder'),
          sensitiveField: true,
          lengthKey: 'mineru_token_length',
          description: t('settings.fields.mineruTokenDesc'),
          link: 'https://mineru.net/apiManage/token',
        },
      ],
    },
    {
      title: t('settings.sections.imageConfig'),
      icon: <Image size={20} />,
      fields: [
        {
          key: 'image_resolution',
          label: t('settings.fields.imageResolution'),
          type: 'select',
          description: t('settings.fields.imageResolutionDesc'),
          options: [
            { value: '1K', label: '1K (1024px)' },
            { value: '2K', label: '2K (2048px)' },
            { value: '4K', label: '4K (4096px)' },
          ],
        },
        {
          key: 'enable_image_quality_control',
          label: t('settings.fields.enableImageQualityControl'),
          type: 'switch',
          description: t('settings.fields.enableImageQualityControlDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.performanceConfig'),
      icon: <Zap size={20} />,
      fields: [
        {
          key: 'max_description_workers',
          label: t('settings.fields.maxDescriptionWorkers'),
          type: 'number',
          min: 1,
          max: 20,
          description: t('settings.fields.maxDescriptionWorkersDesc'),
        },
        {
          key: 'max_image_workers',
          label: t('settings.fields.maxImageWorkers'),
          type: 'number',
          min: 1,
          max: 20,
          description: t('settings.fields.maxImageWorkersDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.outputLanguage'),
      icon: <Globe size={20} />,
      fields: [
        {
          key: 'output_language',
          label: t('settings.fields.defaultOutputLanguage'),
          type: 'buttons',
          description: t('settings.fields.defaultOutputLanguageDesc'),
          options: OUTPUT_LANGUAGE_OPTIONS,
        },
      ],
    },
    {
      title: t('settings.sections.textReasoning'),
      icon: <Brain size={20} />,
      fields: [
        {
          key: 'enable_text_reasoning',
          label: t('settings.fields.enableTextReasoning'),
          type: 'switch',
          description: t('settings.fields.enableTextReasoningDesc'),
        },
        {
          key: 'text_thinking_budget',
          label: t('settings.fields.textThinkingBudget'),
          type: 'number',
          min: 1,
          max: 8192,
          description: t('settings.fields.textThinkingBudgetDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.imageReasoning'),
      icon: <Brain size={20} />,
      fields: [
        {
          key: 'enable_image_reasoning',
          label: t('settings.fields.enableImageReasoning'),
          type: 'switch',
          description: t('settings.fields.enableImageReasoningDesc'),
        },
        {
          key: 'image_thinking_budget',
          label: t('settings.fields.imageThinkingBudget'),
          type: 'number',
          min: 1,
          max: 8192,
          description: t('settings.fields.imageThinkingBudgetDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.baiduOcr'),
      icon: <FileText size={20} />,
      fields: [
        {
          key: 'baidu_api_key',
          label: t('settings.fields.baiduOcrApiKey'),
          type: 'password',
          placeholder: t('settings.fields.baiduOcrApiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'baidu_api_key_length',
          description: t('settings.fields.baiduOcrApiKeyDesc'),
          link: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
        },
      ],
    },
    {
      title: t('settings.sections.elevenlabs'),
      icon: <Volume2 size={20} />,
      fields: [
        {
          key: 'elevenlabs_api_key',
          label: t('settings.fields.elevenLabsApiKey'),
          type: 'password',
          placeholder: t('settings.fields.elevenLabsApiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'elevenlabs_api_key_length',
          description: t('settings.fields.elevenLabsApiKeyDesc'),
          link: 'https://elevenlabs.io/app/settings/api-keys',
        },
      ],
    },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData(formDataFromSettings(response.data));
      }
    } catch (error: any) {
      console.error('加载设置失败:', error);
      show({
        message: t('settings.messages.loadFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markOpenAIOAuthDisconnected = () => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        openai_oauth_connected: false,
        openai_oauth_account_id: null,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const {
        api_key, mineru_token, baidu_api_key, elevenlabs_api_key, lazyllm_api_keys,
        text_api_key, image_api_key, image_caption_api_key,
        ...otherData
      } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
        ai_provider_format: otherData.ai_provider_format,
      };

      // Only send sensitive fields if user entered a new value
      if (api_key) payload.api_key = api_key;
      if (mineru_token) payload.mineru_token = mineru_token;
      if (baidu_api_key) payload.baidu_api_key = baidu_api_key;
      if (elevenlabs_api_key) payload.elevenlabs_api_key = elevenlabs_api_key;
      if (text_api_key) payload.text_api_key = text_api_key;
      if (image_api_key) payload.image_api_key = image_api_key;
      if (image_caption_api_key) payload.image_caption_api_key = image_caption_api_key;

      // Send lazyllm API keys (only non-empty values)
      const nonEmptyKeys = Object.fromEntries(
        Object.entries(lazyllm_api_keys).filter(([, v]) => v)
      );
      if (Object.keys(nonEmptyKeys).length > 0) {
        payload.lazyllm_api_keys = nonEmptyKeys;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        // Clear all sensitive fields after save
        setFormData(prev => ({
          ...prev,
          api_key: '', mineru_token: '', baidu_api_key: '', elevenlabs_api_key: '',
          lazyllm_api_keys: {},
          text_api_key: '', image_api_key: '', image_caption_api_key: '',
        }));
        if (onSaveSuccess) {
          onSaveSuccess();
        } else {
          show({ message: t('settings.messages.saveSuccess'), type: 'success' });
          show({ message: t('settings.messages.testServiceTip'), type: 'info' });
        }
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      show({
        message: t('settings.messages.saveFailed') + ': ' + (error?.response?.data?.error?.message || error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      t('settings.messages.resetConfirm'),
      async () => {
        setIsSaving(true);
        try {
          const response = await api.resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData(formDataFromSettings(response.data));
            show({ message: t('settings.messages.resetSuccess'), type: 'success' });
          }
        } catch (error: any) {
          console.error('重置设置失败:', error);
          show({
            message: t('settings.messages.resetFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
            type: 'error'
          });
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: t('settings.messages.resetTitle'),
        confirmText: t('settings.messages.resetConfirmBtn'),
        cancelText: t('settings.messages.resetCancelBtn'),
        variant: 'warning',
      }
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };

      // Per-model source key → its API base URL field, for stale-default replacement
      const perModelBaseKeys: Record<string, string> = {
        text_model_source: 'text_api_base_url',
        image_model_source: 'image_api_base_url',
        image_caption_model_source: 'image_caption_api_base_url',
      };

      if (key === 'ai_provider_format') {
        if (value === 'volcengine') {
          // Agent Plans 需要专属端点: 空值或其他 provider 的默认端点会被替换,
          // 用户显式填写的自定义 Base URL 保留
          if (KNOWN_DEFAULT_BASE_URLS.has(next.api_base_url)) {
            next.api_base_url = VOLCENGINE_AGENTPLANS_BASE_URL;
          }
        } else if (VOLCENGINE_DEFAULT_BASE_URLS.has(next.api_base_url)) {
          // 离开 Agent Plans: plan/v3 端点对新 provider 是过时默认值, 清空以
          // 回退到新 provider 的环境变量/默认端点, 自定义 URL 保留
          next.api_base_url = '';
        }
      } else if (perModelBaseKeys[key]) {
        const baseKey = perModelBaseKeys[key];
        if (value === 'volcengine') {
          // 单模型切到 Agent Plans 时同样替换过时的默认端点, 否则该模型的
          // {MODEL}_API_BASE 会优先于 VOLCENGINE_API_BASE 命中旧 provider 端点。
          if (KNOWN_DEFAULT_BASE_URLS.has(next[baseKey])) {
            next[baseKey] = VOLCENGINE_AGENTPLANS_BASE_URL;
          }
        } else if (VOLCENGINE_DEFAULT_BASE_URLS.has(next[baseKey])) {
          // 单模型离开 Agent Plans: 清空过时的 plan/v3 端点, 否则该模型的
          // {MODEL}_API_BASE 仍优先于新 provider 的默认端点
          next[baseKey] = '';
        }
      }

      return next;
    });
  };

  const applyVolcengineRecommendedModels = () => {
    const isAgentPlans = formData.ai_provider_format === 'volcengine';
    const provider = isAgentPlans ? 'volcengine' : 'doubao';
    const models = isAgentPlans ? VOLCENGINE_AGENTPLANS_RECOMMENDED_MODELS : VOLCENGINE_MODELARK_RECOMMENDED_MODELS;
    setFormData(prev => {
      // Agent Plans 需要专属端点: 只替换空值或已知的过时默认端点, 保留用户自定义端点,
      // 否则代理/替代端点部署下 per-model 调用会命中硬编码的 cn-beijing 地址
      const agentPlansBaseOrDefault = (current: string) =>
        KNOWN_DEFAULT_BASE_URLS.has(current) ? VOLCENGINE_AGENTPLANS_BASE_URL : current;
      // per-model 字段为空时继承全局解析后的端点（自定义代理端点同样生效）,
      // 因为 {MODEL}_API_BASE 的解析优先级高于 VOLCENGINE_API_BASE
      const resolvedGlobalBase = agentPlansBaseOrDefault(prev.api_base_url);
      const perModelBase = (current: string) =>
        KNOWN_DEFAULT_BASE_URLS.has(current) ? resolvedGlobalBase : current;
      return {
        ...prev,
        text_model: models.text,
        image_caption_model: models.caption,
        image_model: models.image,
        text_model_source: provider,
        image_caption_model_source: provider,
        image_model_source: provider,
        api_base_url: isAgentPlans ? agentPlansBaseOrDefault(prev.api_base_url) : prev.api_base_url,
        // per-model base 同样只替换过时默认值: 空值/默认值继承全局端点, 自定义值原样保留
        text_api_base_url: isAgentPlans ? perModelBase(prev.text_api_base_url) : prev.text_api_base_url,
        image_caption_api_base_url: isAgentPlans ? perModelBase(prev.image_caption_api_base_url) : prev.image_caption_api_base_url,
        image_api_base_url: isAgentPlans ? perModelBase(prev.image_api_base_url) : prev.image_api_base_url,
        openai_image_api_protocol: 'images',
      };
    });
  };

  const selectVolcenginePlan = () => {
    handleFieldChange('ai_provider_format', 'volcengine');
  };

  const selectApimartProvider = () => {
    setFormData(prev => ({
      ...prev,
      ai_provider_format: 'openai',
      api_base_url: APIMART_BASE_URL,
      text_model: prev.text_model_source ? prev.text_model : APIMART_RECOMMENDED_MODELS.text,
      image_model: prev.image_model_source ? prev.image_model : APIMART_RECOMMENDED_MODELS.image,
      image_caption_model: prev.image_caption_model_source
        ? prev.image_caption_model
        : APIMART_RECOMMENDED_MODELS.caption,
      openai_image_api_protocol: prev.image_model_source ? prev.openai_image_api_protocol : 'images',
    }));
  };

  const selectGlobalProvider = (provider: string) => {
    if (provider === 'apimart') {
      selectApimartProvider();
      return;
    }
    if (usesApimartProvider) {
      setFormData(prev => ({
        ...prev,
        ai_provider_format: provider,
        api_base_url: provider === 'openai'
          ? OPENAI_BASE_URL
          : provider === 'volcengine'
            ? VOLCENGINE_AGENTPLANS_BASE_URL
            : '',
      }));
      return;
    }
    handleFieldChange('ai_provider_format', provider);
  };

  const isApimartPlanActive = usesApimartProvider;
  const isVolcenginePlanActive = formData.ai_provider_format === 'volcengine';

  const providerPromotions = [
    {
      key: 'apimart',
      testId: 'provider-plan-apimart',
      active: isApimartPlanActive,
      name: t('settings.providerComparison.apimart.name'),
      tagline: t('settings.providerComparison.apimart.tagline'),
      suitedFor: t('settings.providerComparison.apimart.suitedFor'),
      points: [
        t('settings.providerComparison.apimart.point1'),
        t('settings.providerComparison.apimart.point2'),
        t('settings.providerComparison.apimart.point3'),
      ],
      cta: t('settings.providerComparison.apimart.cta'),
      activeLabel: t('settings.providerComparison.apimart.active'),
      note: t('settings.providerComparison.apimart.note'),
      onSelect: selectApimartProvider,
      href: APIMART_SIGNUP_URL,
      linkLabel: t('settings.providerComparison.apimart.link'),
    },
    {
      key: 'volcengine',
      testId: 'provider-plan-volcengine',
      active: isVolcenginePlanActive,
      name: t('settings.providerComparison.volcengine.name'),
      tagline: t('settings.providerComparison.volcengine.tagline'),
      suitedFor: t('settings.providerComparison.volcengine.suitedFor'),
      points: [
        t('settings.providerComparison.volcengine.point1'),
        t('settings.providerComparison.volcengine.point2'),
        t('settings.providerComparison.volcengine.point3'),
      ],
      cta: t('settings.providerComparison.volcengine.cta'),
      activeLabel: t('settings.providerComparison.volcengine.active'),
      note: t('settings.providerComparison.volcengine.note'),
      onSelect: selectVolcenginePlan,
      href: volcengineAgentPlansUrl,
      linkLabel: t('settings.providerComparison.volcengine.link'),
    },
  ];

  const updateServiceTest = (key: string, nextState: ServiceTestState) => {
    setServiceTestStates(prev => ({ ...prev, [key]: nextState }));
  };

  const handleServiceTest = async (
    key: string,
    action: (settings?: any) => Promise<any>,
    formatDetail: (data: any) => string
  ) => {
    updateServiceTest(key, { status: 'loading' });
    try {
      // 准备测试时要使用的设置（包括未保存的修改）
      const testSettings: any = {};

      // 只传递用户已填写的非空值
      if (formData.api_key) testSettings.api_key = formData.api_key;
      if (formData.api_base_url) testSettings.api_base_url = formData.api_base_url;
      if (formData.ai_provider_format) {
        testSettings.ai_provider_format = formData.ai_provider_format;
      }
      if (formData.text_model) testSettings.text_model = formData.text_model;
      if (formData.image_model) testSettings.image_model = formData.image_model;
      if (formData.image_caption_model) testSettings.image_caption_model = formData.image_caption_model;
      if (formData.mineru_api_base) testSettings.mineru_api_base = formData.mineru_api_base;
      if (formData.mineru_token) testSettings.mineru_token = formData.mineru_token;
      if (formData.baidu_api_key) testSettings.baidu_api_key = formData.baidu_api_key;
      if (formData.image_resolution) testSettings.image_resolution = formData.image_resolution;

      // Per-model provider source overrides (always send, even empty, to clear saved values)
      testSettings.text_model_source = formData.text_model_source || '';
      testSettings.image_model_source = formData.image_model_source || '';
      testSettings.image_caption_model_source = formData.image_caption_model_source || '';

      // Per-model API credentials
      if (formData.text_api_key) testSettings.text_api_key = formData.text_api_key;
      if (formData.text_api_base_url) testSettings.text_api_base_url = formData.text_api_base_url;
      if (formData.image_api_key) testSettings.image_api_key = formData.image_api_key;
      if (formData.image_api_base_url) testSettings.image_api_base_url = formData.image_api_base_url;
      if (formData.image_caption_api_key) testSettings.image_caption_api_key = formData.image_caption_api_key;
      if (formData.image_caption_api_base_url) testSettings.image_caption_api_base_url = formData.image_caption_api_base_url;

      // 推理模式设置
      if (formData.enable_text_reasoning !== undefined) {
        testSettings.enable_text_reasoning = formData.enable_text_reasoning;
      }
      if (formData.text_thinking_budget !== undefined) {
        testSettings.text_thinking_budget = formData.text_thinking_budget;
      }
      if (formData.enable_image_reasoning !== undefined) {
        testSettings.enable_image_reasoning = formData.enable_image_reasoning;
      }
      if (formData.image_thinking_budget !== undefined) {
        testSettings.image_thinking_budget = formData.image_thinking_budget;
      }

      // 启动异步测试，获取任务ID
      const response = await action(testSettings);
      const taskId = response.data.task_id;

      // isActive tracks whether this test round is still pending — avoids stale closure
      let isActive = true;
      // eslint-disable-next-line prefer-const
      let pollInterval: ReturnType<typeof setInterval>;
      const finish = (nextState: ServiceTestState, toastMsg: string, toastType: 'success' | 'error') => {
        if (!isActive) return;
        isActive = false;
        clearInterval(pollInterval);
        updateServiceTest(key, nextState);
        show({ message: toastMsg, type: toastType });
      };

      // 开始轮询任务状态
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.getTestStatus(taskId);
          const statusData = statusResponse?.data;
          if (!statusData) {
            throw new Error(t('settings.serviceTest.testFailed'));
          }
          const taskStatus = statusData.status;

          if (taskStatus === 'COMPLETED') {
            const detail = formatDetail(statusData.result || {});
            const message = statusData.message || t('settings.messages.testSuccess');
            finish({ status: 'success', message, detail }, message, 'success');
          } else if (taskStatus === 'FAILED') {
            const errorMessage = statusData.error || t('settings.serviceTest.testFailed');
            if (statusData.openai_oauth_disconnected) {
              markOpenAIOAuthDisconnected();
            }
            finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
          }
          // 如果是 PENDING 或 PROCESSING，继续轮询
        } catch (pollError: any) {
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || t('settings.serviceTest.testFailed');
          finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
        }
      }, 2000); // 每2秒轮询一次

      // 设置最大轮询时间（2分钟）
      setTimeout(() => {
        finish({ status: 'error', message: t('settings.serviceTest.testTimeout') }, t('settings.serviceTest.testTimeout'), 'error');
      }, 600000); // 10 分钟，覆盖 gpt-image-2 等慢模型的生成时间

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || t('common.unknownError');
      updateServiceTest(key, { status: 'error', message: errorMessage });
      show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] as string | number | boolean;

    if (field.type === 'buttons' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFieldChange(field.key, option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  value === option.value
                    ? option.value === 'openai'
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                      : option.value === 'lazyllm'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                    : 'bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {field.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            {!(value as string) && (
              <option value="" disabled>
                {field.placeholder || t('settings.fields.selectPlaceholder')}
              </option>
            )}
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    // switch 类型 - 开关切换
    if (field.type === 'switch') {
      const isEnabled = Boolean(value);
      return (
        <div key={field.key}>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary">
              {field.label}
            </label>
            <button
              type="button"
              onClick={() => handleFieldChange(field.key, !isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 ${
                isEnabled ? 'bg-banana-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-background-secondary transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    // text, password, number 类型
    const placeholder = field.sensitiveField && settings && field.lengthKey && (settings[field.lengthKey] as number) > 0
      ? t('settings.fields.apiKeySet', { length: settings[field.lengthKey] as string | number })
      : field.placeholder || '';

    // 判断是否禁用（思考负载字段在对应开关关闭时禁用）
    let isDisabled = false;
    if (field.key === 'text_thinking_budget') {
      isDisabled = !formData.enable_text_reasoning;
    } else if (field.key === 'image_thinking_budget') {
      isDisabled = !formData.enable_image_reasoning;
    }

    return (
      <div key={field.key} className={isDisabled ? 'opacity-50' : ''}>
        <Input
          label={field.label}
          type={field.type === 'number' ? 'number' : field.type}
          placeholder={placeholder}
          value={value as string | number}
          onChange={(e) => {
            const newValue = field.type === 'number' 
              ? parseInt(e.target.value) || (field.min ?? 0)
              : e.target.value;
            handleFieldChange(field.key, newValue);
          }}
          min={field.min}
          max={field.max}
          disabled={isDisabled}
        />
        {(field.description || field.link) && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {field.description}
            {field.link && (
              <a href={field.link} target="_blank" rel="noopener noreferrer" className="text-banana-500 hover:underline">{t('settings.fields.applyLink')}</a>
            )}
          </p>
        )}
      </div>
    );
  };

  // 模型配置项定义：每种模型类型的 key、source key、api key/base key、标签等
  const modelConfigItems = [
    {
      modelKey: 'text_model' as keyof typeof initialFormData,
      sourceKey: 'text_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'text_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'text_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'text_api_key_length' as keyof SettingsType,
      label: t('settings.fields.textModel'),
      placeholder: t('settings.fields.textModelPlaceholder'),
      description: t('settings.fields.textModelDesc'),
      sourceLabel: t('settings.fields.textModelSource'),
    },
    {
      modelKey: 'image_model' as keyof typeof initialFormData,
      sourceKey: 'image_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'image_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'image_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'image_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageModel'),
      placeholder: t('settings.fields.imageModelPlaceholder'),
      description: t('settings.fields.imageModelDesc'),
      sourceLabel: t('settings.fields.imageModelSource'),
    },
    {
      modelKey: 'image_caption_model' as keyof typeof initialFormData,
      sourceKey: 'image_caption_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'image_caption_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'image_caption_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'image_caption_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageCaptionModel'),
      placeholder: t('settings.fields.imageCaptionModelPlaceholder'),
      description: t('settings.fields.imageCaptionModelDesc'),
      sourceLabel: t('settings.fields.imageCaptionModelSource'),
    },
  ];

  // 渲染单个模型配置组（模型名 + 提供商选择 + 条件凭证）
  const renderModelConfigGroup = (item: typeof modelConfigItems[0]) => {
    const sourceValue = formData[item.sourceKey] as string;
    const isApiKeyProvider = API_KEY_PROVIDERS.has(sourceValue);
    const isLazyllm = sourceValue && isLazyllmVendor(sourceValue);
    // 'openai' in source dropdown means OpenAI format (API key provider), not lazyllm openai vendor
    // lazyllm openai vendor is handled separately

    return (
      <div key={item.modelKey} className="pb-6 border-b border-gray-200 dark:border-border-primary last:border-b-0 last:pb-0 space-y-3">
        {/* 模型名称 */}
        <Input
          label={item.label}
          type="text"
          placeholder={item.placeholder}
          value={formData[item.modelKey] as string}
          onChange={(e) => handleFieldChange(item.modelKey, e.target.value)}
        />
        {item.description && (
          <p className="-mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{item.description}</p>
        )}

        {/* 提供商选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {item.sourceLabel}
          </label>
          <select
            data-testid={`${String(item.sourceKey)}-select`}
            value={sourceValue}
            onChange={(e) => handleFieldChange(item.sourceKey, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            <option value="">{t('settings.fields.modelProviderPlaceholder')}</option>
            {allProviderSources
              .filter(option =>
                item.sourceKey !== 'image_model_source'
                || isImageModelSourceSelectable(option.value)
              )
              .map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'codex' && !settings?.openai_oauth_connected}
                >
                  {option.label}{option.value === 'codex' && !settings?.openai_oauth_connected ? ` (${t('settings.openaiOAuth.disconnected')})` : ''}
                </option>
              ))
              .concat(
                // A previously saved image source may no longer be selectable
                // (vendor without image capability). Keep it visible so users
                // can see the current value instead of a silently-empty
                // dropdown that would round-trip the stale value on save.
                item.sourceKey === 'image_model_source'
                && formData.image_model_source
                && (
                  !allProviderSources.some(o => o.value === formData.image_model_source)
                  || !isImageModelSourceSelectable(formData.image_model_source)
                )
                  ? [(
                    <option key={formData.image_model_source} value={formData.image_model_source}>
                      {LAZYLLM_SOURCES.find(s => s.value === formData.image_model_source)?.label || formData.image_model_source} ({t('settings.fields.imageSourceUnavailable')})
                    </option>
                  )]
                  : []
              )}
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.fields.modelProviderDesc')}
          </p>
        </div>

        {/* Gemini/OpenAI/Volcengine 提供商：显示 API Key + Base URL */}
        {isApiKeyProvider && (
          <div className="space-y-3 pl-3 border-l-2 border-banana-300 dark:border-banana-600">
            <Input
              label={t('settings.fields.perModelApiBaseUrl')}
              type="text"
              placeholder={t('settings.fields.perModelApiBaseUrlPlaceholder')}
              value={formData[item.apiBaseKey] as string}
              onChange={(e) => handleFieldChange(item.apiBaseKey, e.target.value)}
            />
            <div>
              <Input
                label={t('settings.fields.perModelApiKey')}
                type="password"
                placeholder={
                  settings && (settings[item.apiKeyLengthKey] as number) > 0
                    ? t('settings.fields.perModelApiKeySet', { length: settings[item.apiKeyLengthKey] as number })
                    : t('settings.fields.perModelApiKeyPlaceholder')
                }
                value={formData[item.apiKeyKey] as string}
                onChange={(e) => handleFieldChange(item.apiKeyKey, e.target.value)}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.perModelApiKeyDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Image API Protocol: for image model when effective provider is OpenAI-compatible */}
        {item.sourceKey === 'image_model_source' && (
          sourceValue === 'openai'
          || sourceValue === 'volcengine'
          || (!sourceValue && ['openai', 'volcengine'].includes(formData.ai_provider_format))
        ) && (
          <div className="pl-3 border-l-2 border-banana-300 dark:border-banana-600">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
              {t('settings.fields.imageApiProtocol')}
            </label>
            <select
              data-testid="openai-image-api-protocol-select"
              value={formData.openai_image_api_protocol}
              onChange={(e) => handleFieldChange('openai_image_api_protocol', e.target.value)}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
            >
              <option value="auto">{t('settings.fields.imageApiProtocolAuto')}</option>
              <option value="images">{t('settings.fields.imageApiProtocolImages')}</option>
              <option value="chat">{t('settings.fields.imageApiProtocolChat')}</option>
            </select>
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('settings.fields.imageApiProtocolDesc')}
            </p>
          </div>
        )}

        {/* LazyLLM 厂商：显示厂商 API Key */}
        {isLazyllm && (() => {
          const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === sourceValue)?.label || sourceValue.toUpperCase();
          const keyLength = settings?.lazyllm_api_keys_info?.[sourceValue] || 0;
          const placeholder = keyLength > 0
            ? t('settings.fields.vendorApiKeySet', { length: keyLength })
            : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });
          return (
            <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
              <Input
                label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
                type="password"
                placeholder={placeholder}
                value={formData.lazyllm_api_keys[sourceValue] || ''}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    lazyllm_api_keys: { ...prev.lazyllm_api_keys, [sourceValue]: e.target.value }
                  }));
                }}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.vendorApiKeyDesc')}
              </p>
            </div>
          );
        })()}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading message={t('common.loading')} />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      {ConfirmDialog}
      <div className="space-y-8">
        {/* 默认 API 配置区块 */}
        <div data-testid="global-api-config-section">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
            <Key size={20} />
            <span className="ml-2">{t('settings.sections.apiConfig')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.sections.apiConfigDesc')}</p>
          <div className="space-y-3">
            {/* 默认提供商胶囊选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                {t('settings.fields.aiProviderFormat')}
              </label>
              <div
                role="radiogroup"
                aria-label={t('settings.fields.aiProviderFormat')}
                data-testid="global-provider-pills"
                className="flex flex-wrap gap-2"
              >
                {globalProviderSources.map((option) => {
                  const isSelected = selectedGlobalProvider === option.value;
                  const isDisabled = option.value === 'codex' && !settings?.openai_oauth_connected;
                  const hint = option.value === 'volcengine'
                    ? t('settings.volcenginePromo.providerHint')
                    : option.value === 'apimart'
                      ? t('settings.providerComparison.apimart.providerHint')
                      : null;
                  const hoverPlanKey = option.value === 'apimart' || option.value === 'volcengine'
                    ? option.value
                    : null;
                  const hoverPlan = hoverPlanKey
                    ? providerPromotions.find(plan => plan.key === hoverPlanKey) ?? null
                    : null;

                  return (
                    <div key={option.value} className="group relative">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-describedby={hoverPlan ? `${hoverPlan.testId}-popover` : undefined}
                        disabled={isDisabled}
                        data-provider={option.value}
                        onClick={() => selectGlobalProvider(option.value)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 dark:focus:ring-offset-background-primary ${
                          isSelected
                            ? 'border-banana-500 bg-banana-400 font-medium text-gray-950 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-banana-300 hover:bg-banana-50 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-secondary dark:hover:border-banana-700 dark:hover:bg-banana-950/30'
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        <span>{option.label}</span>
                        {hoverPlan && (
                          <span
                            aria-hidden="true"
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                              hoverPlan.key === 'apimart'
                                ? 'bg-violet-100 text-violet-600 dark:bg-violet-950/70 dark:text-violet-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                            }`}
                          >
                            <Sparkles size={10} className="animate-pulse" />
                          </span>
                        )}
                        {hint && (
                          <span className={`text-[11px] ${isSelected ? 'text-gray-800' : 'text-amber-700 dark:text-amber-300'}`}>
                            {hint}
                          </span>
                        )}
                        {isDisabled && (
                          <span className="text-[11px]">{t('settings.openaiOAuth.disconnected')}</span>
                        )}
                      </button>

                      {hoverPlan && (
                        <div
                          id={`${hoverPlan.testId}-popover`}
                          data-testid={hoverPlan.testId}
                          className="pointer-events-none invisible absolute left-0 top-full z-50 w-[22rem] max-w-[calc(100vw-3rem)] translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
                        >
                          <div className={`rounded-xl border bg-white p-4 shadow-xl dark:bg-background-secondary ${
                            hoverPlan.key === 'apimart'
                              ? 'border-violet-200 dark:border-violet-900'
                              : 'border-amber-200 dark:border-amber-900'
                          }`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-foreground-primary">{hoverPlan.name}</p>
                                <p className={`mt-0.5 text-xs font-medium ${
                                  hoverPlan.key === 'apimart'
                                    ? 'text-violet-600 dark:text-violet-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}>
                                  {hoverPlan.tagline}
                                </p>
                              </div>
                              {hoverPlan.active && (
                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-foreground-secondary">
                                  {hoverPlan.activeLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-foreground-tertiary">{hoverPlan.suitedFor}</p>
                            <ul className="mt-3 space-y-1.5">
                              {hoverPlan.points.map(point => (
                                <li key={point} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-foreground-secondary">
                                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-[11px] text-gray-400 dark:text-foreground-tertiary">{hoverPlan.note}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button
                                variant={hoverPlan.active ? 'secondary' : 'primary'}
                                size="sm"
                                disabled={hoverPlan.active}
                                onClick={hoverPlan.onSelect}
                              >
                                {hoverPlan.active ? hoverPlan.activeLabel : hoverPlan.cta}
                              </Button>
                              <a
                                href={hoverPlan.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs font-medium underline-offset-2 hover:underline ${
                                  hoverPlan.key === 'apimart'
                                    ? 'text-violet-600 hover:text-violet-700 dark:text-violet-300'
                                    : 'text-amber-700 hover:text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                {hoverPlan.linkLabel}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.aiProviderFormatDesc')}</p>
            </div>

            {/* Gemini/OpenAI/Volcengine: API Key + Base URL */}
            {API_KEY_PROVIDERS.has(formData.ai_provider_format) && (
              <div className="space-y-3 pl-3 border-l-2 border-banana-300 dark:border-banana-600">
                <Input
                  label={t('settings.fields.apiBaseUrl')}
                  type="text"
                  placeholder={t('settings.fields.apiBaseUrlPlaceholder')}
                  value={formData.api_base_url}
                  onChange={(e) => handleFieldChange('api_base_url', e.target.value)}
                />
                <p className="-mt-2 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiBaseUrlDesc')}</p>
                {formData.ai_provider_format === 'volcengine' &&
                  formData.api_base_url &&
                  formData.api_base_url !== VOLCENGINE_AGENTPLANS_BASE_URL && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/40">
                      <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">{t('settings.fields.volcengineBaseUrlHint')}</p>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('api_base_url', VOLCENGINE_AGENTPLANS_BASE_URL)}
                        className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        {t('settings.fields.volcengineBaseUrlReset')}
                      </button>
                    </div>
                  )}
                <div>
                  <Input
                    label={t('settings.fields.apiKey')}
                    type="password"
                    placeholder={
                      settings && (settings.api_key_length as number) > 0
                        ? t('settings.fields.apiKeySet', { length: settings.api_key_length })
                        : t('settings.fields.apiKeyPlaceholder')
                    }
                    value={formData.api_key}
                    onChange={(e) => handleFieldChange('api_key', e.target.value)}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiKeyDesc')}</p>
                </div>
              </div>
            )}

            {/* LazyLLM 厂商: 厂商 API Key */}
            {isLazyllmVendor(formData.ai_provider_format) && (
              <GlobalVendorKeyInput vendor={formData.ai_provider_format} formData={formData} setFormData={setFormData} settings={settings} t={t} />
            )}
          </div>

          {usesVolcengineCampaignPromo ? (
            <div data-testid="volcengine-campaign-promo" className="mt-3 pl-4 border-l-4 border-amber-300 dark:border-amber-600">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={volcengineAgentPlansUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img
                    src={volcengineLogoUrl}
                    alt={isZh ? '火山引擎' : 'BytePlus'}
                    className="h-9 w-auto max-w-[160px] object-contain"
                  />
                </a>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary">
                    {t(`${activeVolcenginePromoKey}.title`)}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {t(`${activeVolcenginePromoKey}.body`)}{' '}
                    <a href={volcengineAgentPlansUrl} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium">
                      {t(`${activeVolcenginePromoKey}.cta`)}
                    </a>
                  </p>
                  <div className="pt-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary flex items-center gap-1.5">
                      <HelpCircle size={15} className="text-amber-500" />
                      {t(`${activeApiKeyHelpKey}.title`)}
                    </p>
                    <ol className="mt-1 text-sm text-gray-700 dark:text-foreground-secondary space-y-1 list-decimal list-inside">
                      <li>
                        {t(`${activeApiKeyHelpKey}.step1`)}{' '}
                        <span className="inline-flex items-center gap-2">
                          <a
                            href={volcengineAgentPlansUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium"
                          >
                            {t(`${activeVolcenginePromoKey}.guideLink`)}
                          </a>
                          <button
                            onClick={() => copyToClipboard(volcengineAgentPlansUrl)}
                            className="text-xs px-2 py-0.5 rounded transition-colors bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                          >
                            {t(`${activeVolcenginePromoKey}.copy`)}
                          </button>
                        </span>
                      </li>
                      <li>{t(`${activeApiKeyHelpKey}.step2`)}</li>
                      <li>
                        {t(`${activeApiKeyHelpKey}.step3`)}
                        {formData.ai_provider_format === 'volcengine' && (
                          <span className="inline-flex items-center gap-2">
                            <a
                              href={VOLCENGINE_AGENTPLANS_APIKEY_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium"
                            >
                              {t(`${activeApiKeyHelpKey}.apikeyConsoleLabel`)}
                            </a>
                            <button
                              onClick={() => copyToClipboard(VOLCENGINE_AGENTPLANS_APIKEY_URL)}
                              className="text-xs px-2 py-0.5 rounded transition-colors bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                            >
                              {t(`${activeVolcenginePromoKey}.copy`)}
                            </button>
                          </span>
                        )}
                      </li>
                      <li>{t(`${activeApiKeyHelpKey}.step4`)}</li>
                    </ol>
                  </div>
                  <div className="pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={applyVolcengineRecommendedModels}
                    >
                      {t(`${activeVolcenginePromoKey}.applyModels`)}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
              <p className="text-sm text-gray-700 dark:text-foreground-secondary">
                {t(`${activeApiKeyTipKey}.before`)}
                <a href={activeApiKeyHelpUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">{t(`${activeApiKeyTipKey}.linkLabel`)}</a>
                {t(`${activeApiKeyTipKey}.after`)}
              </p>
            </div>
          )}

          {/* API Key 获取指南 */}
          {!usesVolcengineCampaignPromo && (
            <div className="mt-2 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
              <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary flex items-center gap-1.5 mb-2">
                <HelpCircle size={15} className="text-blue-500" />
                {t(`${activeApiKeyHelpKey}.title`)}
              </p>
              <ol className="text-sm text-gray-700 dark:text-foreground-secondary space-y-1 list-decimal list-inside ml-1">
                <li>
                  {t(`${activeApiKeyHelpKey}.step1`, { link: '{{link}}' }).split('{{link}}')[0]}
                  <span className="inline-flex items-center gap-2">
                    <a
                      href={activeApiKeyHelpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      {t(`${activeApiKeyHelpKey}.linkLabel`)}
                    </a>
                    <button
                      onClick={() => copyToClipboard(activeApiKeyHelpUrl)}
                      className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors"
                    >
                      {t(`${activeApiKeyHelpKey}.copyLink`)}
                    </button>
                  </span>
                  {t(`${activeApiKeyHelpKey}.step1`, { link: '{{link}}' }).split('{{link}}')[1]}
                </li>
                <li>{t(`${activeApiKeyHelpKey}.step2`)}</li>
                <li>{t(`${activeApiKeyHelpKey}.step3`)}</li>
                <li>{t(`${activeApiKeyHelpKey}.step4`)}</li>
              </ol>
            </div>
          )}
        </div>

        {/* 模型配置区块 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.sections.modelConfig')}</span>
          </h2>
          <div className="space-y-4">
            {modelConfigItems.map(renderModelConfigGroup)}
          </div>
        </div>

        {/* 其余配置区块（配置驱动，排除性能配置和推理模式） */}
        <div className="space-y-8">
          {settingsSections.filter((section) =>
            section.title !== t('settings.sections.performanceConfig') &&
            section.title !== t('settings.sections.textReasoning') &&
            section.title !== t('settings.sections.imageReasoning')
          ).map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}
        </div>

        {/* 高级设置（折叠区域） */}
        <div className="border-t border-gray-200 dark:border-border-primary pt-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center justify-between px-0 py-3 text-left hover:opacity-80 transition-opacity"
          >
            <span className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
              {t('settings.sections.advancedSettings')}
            </span>
            <ChevronDown
              size={20}
              className={`text-gray-500 dark:text-foreground-tertiary transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advancedOpen && (
            <div className="pb-4 space-y-8">
              {isDesktop && <DataStorageSettings />}

              {/* OpenAI OAuth 连接区块 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
                  <Link2 size={20} />
                  <span className="ml-2">{t('settings.openaiOAuth.title')}</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.openaiOAuth.description')}</p>
                <div className="p-4 border border-gray-200 dark:border-border-primary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${settings?.openai_oauth_connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                          {settings?.openai_oauth_connected ? t('settings.openaiOAuth.connected') : t('settings.openaiOAuth.disconnected')}
                        </span>
                        {settings?.openai_oauth_connected && settings?.openai_oauth_account_id && (
                          <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                            ({settings.openai_oauth_account_id})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {settings?.openai_oauth_connected ? (
                        <button
                          onClick={handleOAuthDisconnect}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          {t('settings.openaiOAuth.disconnectBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={handleOAuthLogin}
                          disabled={oauthConnecting}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          {oauthConnecting ? t('settings.openaiOAuth.connecting') : t('settings.openaiOAuth.loginBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-foreground-tertiary">{t('settings.openaiOAuth.hint')}</p>
                  {!settings?.openai_oauth_connected && (
                    <div className="mt-3">
                      <button
                        onClick={() => setManualCallbackOpen(v => !v)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('settings.openaiOAuth.manualCallbackLabel')}
                      </button>
                      {manualCallbackOpen && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t('settings.openaiOAuth.manualCallbackHint')}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualCallbackUrl}
                              onChange={(e) => setManualCallbackUrl(e.target.value)}
                              placeholder={t('settings.openaiOAuth.manualCallbackPlaceholder')}
                              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary placeholder-gray-400"
                            />
                            <button
                              onClick={handleManualCallback}
                              disabled={manualCallbackSubmitting || !manualCallbackUrl.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                              {t('settings.openaiOAuth.manualCallbackSubmit')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 并发性能配置 + 推理模式 */}
              {settingsSections.filter((section) =>
                section.title === t('settings.sections.performanceConfig') ||
                section.title === t('settings.sections.textReasoning') ||
                section.title === t('settings.sections.imageReasoning')
              ).map((section) => (
                <div key={section.title}>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                    {section.icon}
                    <span className="ml-2">{section.title}</span>
                  </h2>
                  <div className="space-y-4">
                    {section.fields.map((field) => renderField(field))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 服务测试区 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.serviceTest.title')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.serviceTest.description')}
          </p>
          <div className="pl-4 border-l-4 border-yellow-300 dark:border-yellow-600">
            <p className="text-sm text-gray-700 dark:text-foreground-secondary flex items-start gap-1.5">
              <Lightbulb size={15} className="flex-shrink-0 mt-0.5" />
              {t('settings.serviceTest.tip')}
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                key: 'baidu-ocr',
                titleKey: 'settings.serviceTest.tests.baiduOcr.title',
                descriptionKey: 'settings.serviceTest.tests.baiduOcr.description',
                resultKey: 'settings.serviceTest.results.recognizedText',
                action: api.testBaiduOcr,
                formatDetail: (data: any) => (data?.recognized_text ? t('settings.serviceTest.results.recognizedText', { text: data.recognized_text }) : ''),
              },
              {
                key: 'text-model',
                titleKey: 'settings.serviceTest.tests.textModel.title',
                descriptionKey: 'settings.serviceTest.tests.textModel.description',
                resultKey: 'settings.serviceTest.results.modelReply',
                action: api.testTextModel,
                formatDetail: (data: any) => (data?.reply ? t('settings.serviceTest.results.modelReply', { reply: data.reply }) : ''),
              },
              {
                key: 'caption-model',
                titleKey: 'settings.serviceTest.tests.captionModel.title',
                descriptionKey: 'settings.serviceTest.tests.captionModel.description',
                resultKey: 'settings.serviceTest.results.captionDesc',
                action: api.testCaptionModel,
                formatDetail: (data: any) => (data?.caption ? t('settings.serviceTest.results.captionDesc', { caption: data.caption }) : ''),
              },
              {
                key: 'baidu-inpaint',
                titleKey: 'settings.serviceTest.tests.baiduInpaint.title',
                descriptionKey: 'settings.serviceTest.tests.baiduInpaint.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testBaiduInpaint,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'image-model',
                titleKey: 'settings.serviceTest.tests.imageModel.title',
                descriptionKey: 'settings.serviceTest.tests.imageModel.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testImageModel,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'mineru-pdf',
                titleKey: 'settings.serviceTest.tests.mineruPdf.title',
                descriptionKey: 'settings.serviceTest.tests.mineruPdf.description',
                resultKey: 'settings.serviceTest.results.parsePreview',
                action: api.testMineruPdf,
                formatDetail: (data: any) => (data?.content_preview ? t('settings.serviceTest.results.parsePreview', { preview: data.content_preview }) : data?.message || ''),
              },
            ].map((item) => {
              const testState = serviceTestStates[item.key] || { status: 'idle' as TestStatus };
              const isLoadingTest = testState.status === 'loading';
              return (
                <div
                  key={item.key}
                  className="py-4 border-b border-gray-200 dark:border-border-primary last:border-b-0 space-y-2"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-gray-800 dark:text-foreground-primary">{t(item.titleKey)}</div>
                      <div className="text-sm text-gray-500 dark:text-foreground-tertiary">{t(item.descriptionKey)}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isLoadingTest}
                      onClick={() => handleServiceTest(item.key, item.action, item.formatDetail)}
                    >
                      {isLoadingTest ? t('settings.serviceTest.testing') : t('settings.serviceTest.startTest')}
                    </Button>
                  </div>
                  {testState.status === 'success' && (
                    <p className="text-sm text-green-600">
                      {testState.message}{testState.detail ? `｜${testState.detail}` : ''}
                    </p>
                  )}
                  {testState.status === 'error' && (
                    <p className="text-sm text-red-600">
                      {testState.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border-primary">
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} />}
            onClick={handleReset}
            disabled={isSaving}
          >
            {t('settings.actions.resetToDefault')}
          </Button>
          <Button
            variant="primary"
            icon={<Save size={18} />}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? t('settings.actions.saving') : saveLabel || t('settings.actions.save')}
          </Button>
        </div>

        <SettingsAbout t={t} />
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
const SCROLL_SHOW_THRESHOLD = 300;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(settingsI18n);
  const [showTop, setShowTop] = useState(false);
  const navigationState = location.state as {
    from?: unknown;
    recovery?: unknown;
    sourceState?: unknown;
  } | null;
  const recoveryFrom = navigationState?.recovery === API_ERROR_RECOVERY
    && typeof navigationState.from === 'string'
    && navigationState.from.startsWith('/')
    && !navigationState.from.startsWith('//')
    ? navigationState.from
    : null;
  const hasInAppBackHistory = typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
    ? window.history.state.idx > 0
    : false;
  const canNavigateBack = hasInAppBackHistory || Boolean((location.state as { from?: string } | null)?.from);

  const returnFromRecovery = () => {
    if (!recoveryFrom) return;

    const sourceState = navigationState?.sourceState
      && typeof navigationState.sourceState === 'object'
      && !Array.isArray(navigationState.sourceState)
      ? navigationState.sourceState as Record<string, unknown>
      : {};
    navigate(recoveryFrom, {
      replace: true,
      state: { ...sourceState, apiSettingsRecovered: true },
    });
  };

  const handleBack = () => {
    if (recoveryFrom) {
      returnFromRecovery();
      return;
    }
    if (canNavigateBack) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleRecoverySaveSuccess = () => {
    returnFromRecovery();
  };

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > SCROLL_SHOW_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-border-primary">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={handleBack}
                  className="mr-4"
                >
                  {recoveryFrom ? t('nav.backToEditor') : t('nav.backToHome')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
                    {t('settings.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            {recoveryFrom && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertCircle size={20} className="mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-semibold">{t('settings.recovery.title')}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                    {t('settings.recovery.description')}
                  </p>
                </div>
              </div>
            )}

            <Settings
              onSaveSuccess={recoveryFrom ? handleRecoverySaveSuccess : undefined}
              saveLabel={recoveryFrom ? t('settings.actions.saveAndReturn') : undefined}
            />
          </div>
        </Card>
      </div>

      {showTop && (
        <button
          data-testid="back-to-top-button"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-banana-500 text-white shadow-lg hover:bg-banana-600 transition-all z-50"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};
