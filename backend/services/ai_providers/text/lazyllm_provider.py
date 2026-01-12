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
from .base import TextProvider
from config import get_config

class LazyLLMTextProvider(TextProvider):
    """Text generation using lazyllm"""
    def __init__(self, source: str = 'deepseek', model: str = "deepseek-v3-1-terminus", api_key: str = None):
        """
        Initialize lazyllm text provider

        Args:
            source: text model provider, support qwen,doubao,deepseek,siliconflow,glm...
            model: Model name to use
            api_key: qwen/doubao/siliconflow/... API key
            type: Category of the online service. Defaults to ``llm``.
        """
        try:
            import lazyllm
        except ImportError as e:
            raise ImportError(
                "LazyLLM and its related dependencies are not detected. Please add 'lazyllm>=0.7.2' to the [project.optional-dependencies] section in pyproject.toml, "
                "or run the command: uv pip install '.[sdk]' to reinstall the dependencies." 
            ) from e
        self.client = lazyllm.OnlineModule(
            source = source, 
            model = model, 
            api_key = api_key,
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
        return message
