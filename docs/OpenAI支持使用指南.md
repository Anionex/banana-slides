# OpenAI 支持使用指南

## ✅ 已完成

Banana Slides 现已支持 OpenAI API！你可以使用 **Google Gemini** 或 **OpenAI (GPT-4o + DALL-E 3)** 作为 AI 服务提供商。

## 🚀 快速开始

### 1. 选择你的 AI 服务提供商

在 `.env` 文件中配置：

#### 使用 Google Gemini (默认)
```bash
AI_PROVIDER=google
GOOGLE_API_KEY=your_gemini_api_key
```

#### 使用 OpenAI
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_BASE=https://api.openai.com/v1
```

### 2. 安装依赖（如果还没安装）
```bash
cd /mnt/d/Desktop/banana-slides
uv pip install openai
```

### 3. 启动服务
```bash
cd backend && uv run app.py
```

就这么简单！🎉

## 📊 服务对比

| 特性 | Google Gemini | OpenAI |
|------|---------------|---------|
| 文本质量 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 图片质量 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 参考图片 | ✅ 原生多图 | ⚠️ GPT-4V分析 |
| 成本 | 💰 较低 | 💰💰 较高 |
| 速度 | ⚡ 快 | ⚡ 中等 |

## 💡 使用建议

- **开发测试**: 推荐使用 **Google Gemini**（有免费额度）
- **生产环境**: 根据预算和质量需求选择
- **图片生成**: **OpenAI DALL-E 3** 质量稍优
- **文本生成**: 两者质量相当，Gemini 速度更快

## 🔧 高级配置

### 使用自定义 API 端点

```bash
# OpenAI 兼容服务
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_API_BASE=https://your-custom-endpoint.com/v1

# Azure OpenAI
OPENAI_API_BASE=https://your-resource.openai.azure.com/openai/deployments/your-deployment
```

### 同时配置多个服务（快速切换）

在 `.env` 文件中：
```bash
# 当前使用
AI_PROVIDER=openai

# Google 配置（备用）
GOOGLE_API_KEY=xxx
GOOGLE_API_BASE=

# OpenAI 配置（当前）
OPENAI_API_KEY=xxx
OPENAI_API_BASE=https://api.openai.com/v1
```

只需修改 `AI_PROVIDER` 即可切换！

## 📚 更多文档

- **详细配置**: `docs/AI服务配置说明.md`
- **环境变量**: `docs/环境变量配置示例.md`
- **示例文件**: `.env.example`

## 🐛 常见问题

### Q: 如何测试配置是否正确？
```bash
cd backend
python test_ai_service.py
```

### Q: 如何切换服务提供商？
修改 `.env` 中的 `AI_PROVIDER=openai` 或 `AI_PROVIDER=google`，重启服务。

### Q: OpenAI 图片生成支持参考图片吗？
是的，但通过 GPT-4V 分析参考图片后生成增强提示词，而非直接使用参考图片。

### Q: 成本如何？
- **Gemini**: 有免费额度，适合开发测试
- **OpenAI**: 按 token 计费，需要预充值

## 🎯 架构亮点

采用**抽象服务层**设计，添加新的 AI 服务提供商只需 3 步：

1. 创建服务类（继承 `BaseAIService`）
2. 注册服务（`AIServiceRegistry.register()`）
3. 添加配置（在 `config.py` 中）

未来可轻松支持：Anthropic Claude、Cohere、本地模型等。

---

**版本**: v1.0  
**更新时间**: 2025-12-09

