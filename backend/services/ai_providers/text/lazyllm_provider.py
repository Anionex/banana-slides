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
import threading
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

        self._source = source
        self._model = model
        self._vlm_client = None
        self._vlm_lock = threading.Lock()
        ensure_lazyllm_namespace_key(source, namespace='BANANA')
        # Omit type so lazyllm auto-detects LLM vs VLM from the model name.
        # VLM-only models (e.g. qwen-vl-max) are auto-set to VLM; regular
        # LLM models default to LLM. This avoids the AssertionError lazyllm
        # raises when type='llm' is passed explicitly for a VLM model.
        self.client = lazyllm.namespace('BANANA').OnlineModule(
            source=source,
            model=model,
        )
        # Detect VLM-only status from the type lazyllm actually assigned.
        LLMType = type(self.client._type)
        self._is_vlm_only = (self.client._type == LLMType.VLM)

    def generate_text(self, prompt, thinking_budget = 1000):
        message = self.client(prompt)
        return strip_think_tags(message)

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        if self._is_vlm_only:
            # Reuse the VLM client created during __init__
            message = self.client(prompt, lazyllm_files=[image_path])
            return strip_think_tags(message)
        if self._vlm_client is None:
            with self._vlm_lock:
                if self._vlm_client is None:
                    import lazyllm
                    ensure_lazyllm_namespace_key(self._source, namespace='BANANA')
                    self._vlm_client = lazyllm.namespace('BANANA').OnlineModule(
                        source=self._source, model=self._model, type='vlm',
                    )
        message = self._vlm_client(prompt, lazyllm_files=[image_path])
        return strip_think_tags(message)
