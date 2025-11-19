import json
from pathlib import Path
from typing import Optional, Dict, Any, TypedDict
import sys
import os
sys.path.append(os.path.dirname(__file__))
from prompts import sys_prompts

class AISettings:
    """
    AI Agent 配置系统 - 从 store.json 读取AI相关配置
    """
    
    def __init__(self):
        # 从ai_agent目录向上找到config目录
        self._config_file = Path(__file__).parent.parent / "config" / "store.json"
        
        # AI模型配置,超时暂时调大一点
        self.model: str = "deepseek-chat"
        self.temperature: float = 0.7
        self.max_tokens: int = 4096
        self.timeout: int = 300
        
        # API密钥配置（在属性中动态获取）
        self.api_key = None  # 将在属性中动态获取
        self.base_url = self._get_config("deepseekApiUrl", "https://api.deepseek.com")
        
        # 多模型支持配置
        self.ENABLE_DEEPSEEK: bool = True
        self.ENABLE_OLLAMA: bool = True
        self.ENABLE_OPENROUTER: bool = True
        self.ENABLE_ALIYUN: bool = True
        self.ENABLE_SILICONFLOW: bool = True
        self.ENABLE_GEMINI: bool = True
        self.ENABLE_ZHIPUAI: bool = True
        self.ENABLE_KIMI: bool = True
    
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        if not self._config_file.exists():
            return {}
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    
    def _get_config(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        config = self._load_config()
        value = config.get(key, default)
        
        # 处理嵌套的配置结构
        if isinstance(value, dict):
            if 'value' in value:
                return value['value']
            elif 'success' in value and 'value' in value:
                return value['value']
        
        return value
    
    @property
    def DEEPSEEK_API_KEY(self) -> Optional[str]:
        """DeepSeek API密钥（动态加载）"""
        api_key = self._get_config("deepseekApiKey")
        if not api_key:
            print("警告: DeepSeek API密钥未设置，请检查config/store.json")
        return api_key
    
    @property
    def OPENROUTER_API_KEY(self) -> Optional[str]:
        """OpenRouter API密钥（动态加载）"""
        return self._get_config("openrouterApiKey")
    
    @property
    def ALIYUN_API_KEY(self) -> Optional[str]:
        """阿里云API密钥（动态加载）"""
        return self._get_config("aliyunApiKey")
    
    @property
    def SILICONFLOW_API_KEY(self) -> Optional[str]:
        """硅基流动API密钥（动态加载）"""
        return self._get_config("siliconflowApiKey")
    
    @property
    def GEMINI_API_KEY(self) -> Optional[str]:
        """Google Gemini API密钥（动态加载）"""
        return self._get_config("geminiApiKey")
    
    @property
    def ZHIPUAI_API_KEY(self) -> Optional[str]:
        """智谱AI API密钥（动态加载）"""
        return self._get_config("zhipuaiApiKey")
    
    @property
    def KIMI_API_KEY(self) -> Optional[str]:
        """Kimi API密钥（动态加载）"""
        return self._get_config("kimiApiKey")
    
    
    @property
    def OLLAMA_MODELS(self) -> list:
        """Ollama可用模型列表（动态加载）"""
        return self._get_config("ollamaModels", [])
    
    def get_api_key_for_provider(self, provider: str) -> Optional[str]:
        """根据提供商获取对应的API密钥"""
        provider_keys = {
            "deepseek": self.DEEPSEEK_API_KEY,
            "openrouter": self.OPENROUTER_API_KEY,
            "aliyun": self.ALIYUN_API_KEY,
            "siliconflow": self.SILICONFLOW_API_KEY,
            "gemini": self.GEMINI_API_KEY,
            "zhipuai": self.ZHIPUAI_API_KEY,
            "kimi": self.KIMI_API_KEY,
        }
        return provider_keys.get(provider)
    
    def get_base_url_for_provider(self, provider: str) -> Optional[str]:
        """根据提供商获取对应的base_url"""
        if provider == "deepseek":
            return self.base_url
        elif provider == "ollama":
            return self.OLLAMA_BASE_URL
        # 其他提供商使用默认base_url
        return None
    
    @property
    def DEFAULT_MODEL(self) -> str:
        """默认模型（动态加载）"""
        return self._get_config("selectedModel", "deepseek-chat")
    
    @property
    def OLLAMA_BASE_URL(self) -> str:
        """Ollama服务地址（动态加载）"""
        return self._get_config("ollamaBaseUrl", "http://127.0.0.1:11434")
    
    @property
    def CURRENT_MODE(self) -> str:
        """当前模式（动态加载）"""
        return self._get_config("currentMode", "outline")
    
    def get_prompt_for_mode(self, mode: str = None) -> str:
        """获取指定模式的提示词"""
        if mode is None:
            mode = self.CURRENT_MODE
        
        custom_prompts = self._get_config("customPrompts", {})
        custom_prompt = custom_prompts.get(mode, "")
        
        # 如果自定义提示词为空，返回默认提示词
        if custom_prompt:
            return custom_prompt
        
        # 根据模式返回对应的默认提示词
        default_prompts = {
            "outline": sys_prompts.OUTLINE_PROMPT,
            "writing": sys_prompts.WRITING_PROMPT,
            "adjustment": sys_prompts.ADJUSTMENT_PROMPT
        }
        
        # 返回对应模式的默认提示词，如果模式不存在则返回大纲提示词
        return default_prompts.get(mode, sys_prompts.OUTLINE_PROMPT)
    
    def get_max_tokens_for_mode(self, mode: str = None) -> int:
        """获取指定模式的最大token数"""
        if mode is None:
            mode = self.CURRENT_MODE
        
        # 获取模式特定的AI参数配置
        ai_parameters = self._get_config("aiParameters", {})
        mode_params = ai_parameters.get(mode, {})
        
        # 如果模式有特定的max_tokens配置，使用它
        if "max_tokens" in mode_params:
            return mode_params["max_tokens"]
        
        # 否则使用全局默认值
        return self.max_tokens

# 定义状态类型
class State(TypedDict):
    """包含消息和总结的状态"""
    messages: list  # 移除 add_messages 注解，完全手动管理
    summary: str  # 对话总结

# 创建全局AI设置实例
ai_settings = AISettings()