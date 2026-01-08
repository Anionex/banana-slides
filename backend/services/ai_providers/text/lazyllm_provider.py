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
import logging
import lazyllm
from tenacity import retry, stop_after_attempt, wait_exponential
from .base import TextProvider
from config import get_config

class LazyllmTextProvider(TextProvider):
    """Text generation using lazyllm"""
    def __init__(self, source: str = 'deepseek', model: str = "deepseek-v3-1-terminus", api_key: str = None):
        """
        Initialize lazyllm text provider

        Args:
            source: text model provider, support qwen,doubao,deepseek,siliconflow,glm...
            model: Model name to use
            api_key: qwen/doubao/siliconflow/... API key
        """
        self.client = lazyllm.OnlineModule(
            source = source, 
            model = model, 
            api_key = api_key,
            type = 'llm', # 指定模型类型:本文生成模型
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

        