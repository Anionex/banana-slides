# AI 服务配置说明

本项目支持多种AI服务提供商，目前已集成：
- **Google Gemini** (默认)
- **OpenAI** (GPT-4 + DALL-E)

## 架构设计

项目采用了抽象服务层设计，所有AI服务都继承自 `BaseAIService`，这使得添加新的服务提供商变得非常简单。

### 核心组件

1. **BaseAIService** - 抽象基类，定义统一的AI服务接口
2. **GeminiService** - Google Gemini实现
3. **OpenAIService** - OpenAI实现
4. **AIServiceFactory** - 工厂模式，根据配置创建对应的服务实例
5. **AIServiceRegistry** - 服务注册器，支持动态注册新的服务提供商

## 配置方式

### 方式一：使用 Google Gemini（默认）

在 `.env` 文件中配置：

```bash
# AI服务提供商选择
AI_PROVIDER=google

# Google Gemini API配置
GOOGLE_API_KEY=your_gemini_api_key_here
GOOGLE_API_BASE=  # 可选，如果使用代理
```

### 方式二：使用 OpenAI

在 `.env` 文件中配置：

```bash
# AI服务提供商选择
AI_PROVIDER=openai

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE=  # 可选，如果使用自定义API端点
```

### 支持的 API Base URL

#### OpenAI兼容端点示例
```bash
# 官方OpenAI
OPENAI_API_BASE=https://api.openai.com/v1

# Azure OpenAI
OPENAI_API_BASE=https://your-resource.openai.azure.com/openai/deployments/your-deployment

# 其他兼容OpenAI API的服务
OPENAI_API_BASE=https://your-custom-endpoint.com/v1
```

## 服务对比

| 功能 | Google Gemini | OpenAI |
|------|---------------|---------|
| 文本生成 | ✅ gemini-2.5-flash | ✅ gpt-4o |
| 图片生成 | ✅ gemini-3-pro-image-preview | ✅ DALL-E 3 |
| 参考图片支持 | ✅ 原生支持多图 | ⚠️ 通过GPT-4V分析后增强提示词 |
| 思考模式 | ✅ Thinking Budget | ❌ |
| 多模态输入 | ✅ 原生支持 | ✅ 通过Vision API |
| 图片编辑 | ✅ 直接编辑 | ⚠️ 重新生成 |

### 注意事项

#### Google Gemini
- **优势**：原生支持多图参考，Thinking模式提升生成质量
- **限制**：需要Google API访问权限

#### OpenAI
- **优势**：GPT-4o文本质量高，DALL-E 3图片质量优秀
- **限制**：
  - DALL-E不直接支持参考图片（通过GPT-4V分析参考图后增强提示词）
  - 图片编辑需要重新生成（而非直接编辑）
  - 每次API调用成本相对较高

## 如何添加新的AI服务提供商

得益于抽象设计，添加新服务只需3步：

### 1. 创建服务实现类

在 `backend/services/` 下创建新文件，例如 `anthropic_service.py`：

```python
from .base_ai_service import BaseAIService
from typing import List, Dict, Optional

class AnthropicService(BaseAIService):
    """Claude AI service implementation"""
    
    def __init__(self, api_key: str, api_base: Optional[str] = None):
        super().__init__(api_key, api_base)
        # 初始化你的客户端
        self.client = ...
    
    # 实现所有抽象方法
    def generate_outline(self, project_context) -> List[Dict]:
        # 你的实现
        pass
    
    # ... 实现其他方法
```

### 2. 注册服务提供商

在 `backend/services/ai_service_factory.py` 中注册：

```python
from .anthropic_service import AnthropicService

# 在文件底部添加
AIServiceRegistry.register('anthropic', AnthropicService)
AIServiceRegistry.register('claude', AnthropicService)  # 别名
```

### 3. 添加配置支持

在 `backend/config.py` 中添加配置项：

```python
# Anthropic配置
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
ANTHROPIC_API_BASE = os.getenv('ANTHROPIC_API_BASE', '')
```

在 `ai_service_factory.py` 的 `create_ai_service_from_config` 函数中添加配置映射：

```python
elif provider == 'anthropic':
    api_key = config.get('ANTHROPIC_API_KEY')
    api_base = config.get('ANTHROPIC_API_BASE')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is required")
```

完成！现在用户可以通过设置 `AI_PROVIDER=anthropic` 来使用新服务了。

## 代码示例

### 使用工厂创建服务

```python
from services import create_ai_service_from_config
from flask import current_app

# 自动根据配置创建对应的服务
ai_service = create_ai_service_from_config(current_app.config)

# 使用统一接口
outline = ai_service.generate_outline(project_context)
image = ai_service.generate_image(prompt, ref_image_path)
```

### 直接创建特定服务

```python
from services import create_ai_service

# 创建Gemini服务
gemini = create_ai_service('google', api_key='your_key')

# 创建OpenAI服务
openai = create_ai_service('openai', api_key='your_key', api_base='https://api.openai.com/v1')
```

## 环境变量完整示例

### Google Gemini配置示例

```bash
# .env
AI_PROVIDER=google
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_API_BASE=
```

### OpenAI配置示例

```bash
# .env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_API_BASE=https://api.openai.com/v1
```

### 同时配置多个（可快速切换）

```bash
# .env
# 当前使用的provider
AI_PROVIDER=openai

# Google配置（备用）
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GOOGLE_API_BASE=

# OpenAI配置（当前）
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_API_BASE=https://api.openai.com/v1
```

## 故障排查

### 问题：ValueError: OPENAI_API_KEY is required
**解决**：确保在 `.env` 文件中设置了 `OPENAI_API_KEY` 且重启了服务

### 问题：OpenAI API返回401错误
**解决**：检查API Key是否正确，是否有足够的配额

### 问题：Google Gemini API超时
**解决**：检查网络连接，必要时配置 `GOOGLE_API_BASE` 使用代理

### 问题：图片生成失败
**解决**：
- Gemini: 检查参考图片路径是否正确
- OpenAI: 检查提示词是否符合DALL-E内容政策

## 性能优化建议

1. **批量操作**：使用异步任务处理大量页面生成
2. **缓存策略**：相同提示词的结果可以缓存
3. **成本控制**：
   - OpenAI按token计费，注意提示词长度
   - Gemini有免费额度，适合开发测试

## 技术支持

如需添加更多AI服务提供商或遇到问题，请参考：
- 代码：`backend/services/base_ai_service.py`
- 示例：`backend/services/gemini_service.py` 或 `backend/services/openai_service.py`

