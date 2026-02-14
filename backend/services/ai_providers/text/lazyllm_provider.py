"""
Lazyllm framework for text generation
Supports modes:
- Qwen
- Deepseek
- doubao
- GLM
- MINIMAX
- sensenova
- ...
"""
from .base import TextProvider, strip_think_tags
from ..lazyllm_env import ensure_lazyllm_namespace_key

class LazyLLMTextProvider(TextProvider):
    """Text generation using lazyllm"""
    def __init__(self, source: str = 'deepseek', model: str = "deepseek-v3-1-terminus"):
        """
        Initialize lazyllm text provider

        Args:
            source: text model provider, support qwen,doubao,deepseek,siliconflow,glm...
            model: Model name to use
            type: Category of the online service. Defaults to ``llm``.
        """
        try:
            import lazyllm
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "lazyllm is required when AI_PROVIDER_FORMAT=lazyllm. "
                "Please install backend dependencies including lazyllm."
            ) from exc

        ensure_lazyllm_namespace_key(source, namespace='BANANA')
        self.client = lazyllm.namespace('BANANA').OnlineModule(
            source = source, 
            model = model, 
            type = 'llm',
            )
        
    def generate_text(self, prompt, thinking_budget = 1000):
        """
        Generate text using Lazyllm framework
        
        Args:
            prompt: The input prompt
            thinking_budget: Not used in Lazyllm, kept for interface compatibility
            
        Returns:
            Generated text
        """
        message = self.client(prompt)
        return strip_think_tags(message)
