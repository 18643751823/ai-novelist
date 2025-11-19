#!/usr/bin/env python3
"""
API Provider 管理器
提供模型提供商配置、模型列表获取等功能
"""

import os
import yaml
import json
import requests
from typing import Dict, List, Optional, Any
from pathlib import Path
from pydantic import BaseModel

class ProviderConfig(BaseModel):
    """提供商配置模型"""
    name: str
    base_url: str
    models_endpoint: str = "/models"
    model_id_prefix: str = ""
    description: str = ""
    is_local: bool = False
    saved_api_key: Optional[str] = None

class ModelInfo(BaseModel):
    """模型信息模型"""
    id: str
    name: str
    provider: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None

class ModelConfig(BaseModel):
    """模型配置模型"""
    model_name: str
    litellm_params: Dict[str, Any]
    model_info: Optional[Dict[str, Any]] = None

class APIProviderManager:
    """API Provider 管理器"""
    
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.config_file = self.script_dir / "config.yaml"
        self.preset_file = self.script_dir / "preset_models.yaml"
        self.presets = self._load_presets()
        self.current_config = self._load_config()
    
    def _load_presets(self) -> Dict[str, Any]:
        """加载预设模型提供商配置"""
        try:
            with open(self.preset_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f"加载预设配置失败: {e}")
            return {}
    
    def _save_presets(self) -> bool:
        """保存预设配置到preset_models.yaml"""
        try:
            with open(self.preset_file, 'w', encoding='utf-8') as f:
                yaml.dump(self.presets, f, default_flow_style=False,
                         allow_unicode=True, indent=2)
            return True
        except Exception as e:
            print(f"保存预设配置失败: {e}")
            return False
    
    def _load_config(self) -> Dict[str, Any]:
        """加载当前配置"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f) or {}
                    # 确保model_list是一个列表，而不是None
                    if config.get("model_list") is None:
                        config["model_list"] = []
                    return config
            return {"model_list": []}
        except Exception as e:
            print(f"加载当前配置失败: {e}")
            return {"model_list": []}
    
    def _save_config(self) -> bool:
        """保存配置到config.yaml"""
        try:
            # 手动构建正确的YAML格式，确保model_name在开头
            config_lines = ["model_list:"]
            
            model_list = self.current_config.get("model_list", [])
            # 确保model_list是一个列表，而不是None
            if model_list is None:
                model_list = []
            
            for model in model_list:
                model_name = model.get("model_name", "")
                litellm_params = model.get("litellm_params", {})
                
                # 添加模型名称
                config_lines.append(f"  - model_name: {model_name}")
                
                # 添加litellm_params
                config_lines.append("    litellm_params:")
                
                # 添加model参数
                model_param = litellm_params.get("model", "")
                if model_param:
                    config_lines.append(f"      model: {model_param}")
                
                # 添加api_base参数
                api_base = litellm_params.get("api_base", "")
                if api_base:
                    config_lines.append(f"      api_base: {api_base}")
                
                # 添加api_key参数
                api_key = litellm_params.get("api_key", "")
                if api_key:
                    config_lines.append(f"      api_key: {api_key}")
                
                # 添加其他参数
                for key, value in litellm_params.items():
                    if key not in ["model", "api_base", "api_key"]:
                        config_lines.append(f"      {key}: {value}")
                
                # 添加model_info（如果存在）
                model_info = model.get("model_info", {})
                if model_info:
                    config_lines.append("    model_info:")
                    for key, value in model_info.items():
                        config_lines.append(f"      {key}: {value}")
            
            # 写入文件
            with open(self.config_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(config_lines))
            
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False
    
    def get_providers(self) -> Dict[str, ProviderConfig]:
        """获取所有预设提供商"""
        providers = {}
        for provider_id, provider_info in self.presets.get('providers', {}).items():
            providers[provider_id] = ProviderConfig(**provider_info)
        return providers
    
    def get_custom_providers(self) -> Dict[str, ProviderConfig]:
        """获取所有自定义提供商"""
        custom_providers = {}
        for provider_id, provider_info in self.presets.get('custom_providers', {}).items():
            custom_providers[provider_id] = ProviderConfig(**provider_info)
        return custom_providers
    
    def get_provider_models(self, provider_id: str, api_key: str = None) -> List[ModelInfo]:
        """获取指定提供商的模型列表"""
        providers = self.presets.get('providers', {})
        if provider_id not in providers:
            return []
        
        provider_info = providers[provider_id]
        base_url = provider_info.get('base_url', '')
        models_endpoint = provider_info.get('models_endpoint', '')
        model_id_prefix = provider_info.get('model_id_prefix', '')
        is_local = provider_info.get('is_local', False)
        provider_name = provider_info.get('name', provider_id)
        
        try:
            if provider_id == "gemini":
                # Gemini特殊处理 - 使用官方API获取模型列表
                return self._get_gemini_models_from_api(api_key, base_url, models_endpoint, model_id_prefix, provider_name)
            elif provider_id == "aliyun":
                # 阿里云特殊处理 - 需要同时获取聊天模型和嵌入模型
                return self._get_aliyun_models(api_key, base_url, models_endpoint, model_id_prefix, provider_name)
            elif is_local:
                # Ollama本地模型
                response = requests.get(f"{base_url}{models_endpoint}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    models = []
                    for model_data in data.get("models", []):
                        model_name = model_data.get("name", "")
                        models.append(ModelInfo(
                            id=f"{model_id_prefix}{model_name}",
                            name=f"Ollama {model_name}",
                            provider=provider_id
                        ))
                    return models
            else:
                # 云端API模型
                if not api_key:
                    raise ValueError("需要API密钥才能获取模型列表")
                
                headers = {"Authorization": f"Bearer {api_key}"}
                response = requests.get(f"{base_url}{models_endpoint}",
                                     headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    models = []
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        models.append(ModelInfo(
                            id=f"{model_id_prefix}{model_id}",
                            name=f"{provider_name} {model_id}",
                            provider=provider_id
                        ))
                    return models
                else:
                    raise Exception(f"HTTP {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取模型列表时出错: {e}")
    
    def _get_gemini_models_from_api(self, api_key: str, base_url: str, models_endpoint: str, model_id_prefix: str, provider_name: str) -> List[ModelInfo]:
        """从Gemini官方API获取模型列表"""
        try:
            if not api_key:
                raise ValueError("需要API密钥才能获取Gemini模型列表")
            
            # Gemini API使用不同的认证方式
            headers = {"x-goog-api-key": api_key}
            
            # 构建完整的模型列表URL
            models_url = f"{base_url}{models_endpoint}?key={api_key}"
            
            response = requests.get(models_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                models = []
                
                # Gemini API返回的模型列表可能在不同的字段中
                models_list = data.get("models", [])
                
                for model_data in models_list:
                    model_name = model_data.get("name", "")
                    # 从完整路径中提取模型名称
                    if "/" in model_name:
                        model_name = model_name.split("/")[-1]
                    
                    # 获取模型显示名称
                    display_name = model_data.get("displayName", model_name)
                    description = model_data.get("description", "")
                    
                    models.append(ModelInfo(
                        id=f"{model_id_prefix}{model_name}",
                        name=f"{provider_name} {display_name}",
                        provider="gemini",
                        description=description
                    ))
                
                return models
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Gemini网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取Gemini模型列表时出错: {e}")
    
    def _get_aliyun_models(self, api_key: str, base_url: str, models_endpoint: str, model_id_prefix: str, provider_name: str) -> List[ModelInfo]:
        """获取阿里云模型列表，包括聊天模型和嵌入模型"""
        try:
            if not api_key:
                raise ValueError("需要API密钥才能获取阿里云模型列表")
            
            models = []
            headers = {"Authorization": f"Bearer {api_key}"}
            
            # 1. 获取聊天模型列表
            try:
                response = requests.get(f"{base_url}{models_endpoint}", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        # 过滤掉嵌入模型，因为它们需要不同的API端点
                        if not model_id.startswith("text-embedding"):
                            models.append(ModelInfo(
                                id=f"{model_id_prefix}{model_id}",
                                name=f"{provider_name} {model_id}",
                                provider="aliyun",
                                type="chat"
                            ))
            except Exception as e:
                print(f"获取阿里云聊天模型失败: {e}")
            
            # 2. 添加阿里云嵌入模型（根据官方文档）
            embedding_models = [
                ModelInfo(
                    id=f"{model_id_prefix}text-embedding-v4",
                    name=f"{provider_name} text-embedding-v4",
                    provider="aliyun",
                    type="embedding",
                    description="阿里云文本嵌入模型v4，支持多种向量维度"
                ),
                ModelInfo(
                    id=f"{model_id_prefix}text-embedding-v3",
                    name=f"{provider_name} text-embedding-v3",
                    provider="aliyun",
                    type="embedding",
                    description="阿里云文本嵌入模型v3，支持多种向量维度"
                ),
                ModelInfo(
                    id=f"{model_id_prefix}text-embedding-v2",
                    name=f"{provider_name} text-embedding-v2",
                    provider="aliyun",
                    type="embedding",
                    description="阿里云文本嵌入模型v2，向量维度1536"
                ),
                ModelInfo(
                    id=f"{model_id_prefix}text-embedding-v1",
                    name=f"{provider_name} text-embedding-v1",
                    provider="aliyun",
                    type="embedding",
                    description="阿里云文本嵌入模型v1"
                )
            ]
            
            models.extend(embedding_models)
            
            return models
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"阿里云网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取阿里云模型列表时出错: {e}")
    
    def get_custom_provider_models(self, name: str, base_url: str, api_key: str) -> List[ModelInfo]:
        """获取自定义提供商的模型列表"""
        try:
            models_endpoint = "/models"
            model_id_prefix = "openai/"  # 所有自定义提供商使用openai/前缀
            
            # 构建请求头
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            # 发送请求
            response = requests.get(f"{base_url}{models_endpoint}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                models = []
                
                # 处理响应数据
                for model_data in data.get("data", []):
                    model_id = model_data.get("id", "")
                    if model_id:
                        # 确保模型ID使用openai/前缀
                        if not model_id.startswith("openai/"):
                            final_model_id = f"{model_id_prefix}{model_id}"
                        else:
                            final_model_id = model_id
                        
                        models.append(ModelInfo(
                            id=final_model_id,
                            name=f"{name} {model_id}",
                            provider="custom",
                            base_url=base_url,
                            api_key=api_key
                        ))
                
                return models
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取自定义提供商模型列表时出错: {e}")
    
    def save_custom_provider(self, name: str, base_url: str, api_key: str) -> bool:
        """保存自定义提供商"""
        if not name:
            raise ValueError("请输入提供商名称")
        
        if not base_url:
            raise ValueError("请输入API基础URL")
        
        # 确保custom_providers存在
        if 'custom_providers' not in self.presets:
            self.presets['custom_providers'] = {}
        
        # 生成唯一的提供商ID
        provider_id = f"custom_{name.lower().replace(' ', '_')}"
        
        # 保存提供商配置
        self.presets['custom_providers'][provider_id] = {
            'name': name,
            'base_url': base_url,
            'models_endpoint': '/models',
            'model_id_prefix': 'openai/',  # 所有自定义提供商使用openai/前缀
            'description': f'自定义提供商: {name}',
            'saved_api_key': api_key
        }
        
        # 保存到文件
        return self._save_presets()
    
    def delete_custom_provider(self, provider_id: str) -> bool:
        """删除自定义提供商"""
        custom_providers = self.presets.get('custom_providers', {})
        if provider_id in custom_providers:
            del custom_providers[provider_id]
            return self._save_presets()
        return False
    
    def add_model_to_config(self, provider_id: str, model_id: str, api_key: str = None) -> bool:
        """将模型添加到配置中"""
        providers = self.presets.get('providers', {})
        if provider_id not in providers:
            return False
        
        provider_info = providers[provider_id]
        
        # 需要使用openai前缀的提供商列表
        openai_prefix_providers = ["deepseek", "aliyun", "zhipuai", "siliconflow", "kimi"]
        
        # 处理模型ID前缀
        final_model_id = model_id
        if provider_id in openai_prefix_providers:
            # 如果当前模型ID不是以openai/开头，则替换前缀
            if not model_id.startswith("openai/"):
                # 移除原有的前缀（如果有）
                if "/" in model_id:
                    model_name_only = model_id.split("/", 1)[1]
                else:
                    model_name_only = model_id
                final_model_id = f"openai/{model_name_only}"
        
        # 构建模型配置 - 确保model_name在顶层
        model_config = {
            "model_name": final_model_id,
            "litellm_params": {
                "model": final_model_id
            }
        }
        
        # 添加API密钥（如果不是本地模型）
        if not provider_info.get('is_local', False) and api_key:
            model_config["litellm_params"]["api_key"] = api_key
        
        # 添加base_url（如果存在）
        base_url = provider_info.get('base_url', '')
        if base_url:
            model_config["litellm_params"]["api_base"] = base_url
        
        # 检查是否已存在
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        for existing_model in model_list:
            if existing_model.get("model_name") == final_model_id:
                raise ValueError(f"模型 {final_model_id} 已存在于配置中")
        
        # 添加到配置
        model_list.append(model_config)
        self.current_config["model_list"] = model_list
        
        return self._save_config()
    
    def add_custom_model_to_config(self, model_id: str, base_url: str, api_key: str) -> bool:
        """将自定义模型添加到配置中"""
        # 确保模型ID使用openai/前缀
        final_model_id = model_id
        if not model_id.startswith("openai/"):
            final_model_id = f"openai/{model_id}"
        
        # 构建模型配置 - 确保model_name在顶层
        model_config = {
            "model_name": final_model_id,
            "litellm_params": {
                "model": final_model_id
            },
            "model_info": {
                "provider": "openaicompatible"
            }
        }
        
        # 添加API密钥（如果提供）
        if api_key:
            model_config["litellm_params"]["api_key"] = api_key
        
        # 添加base_url（如果提供）
        if base_url:
            model_config["litellm_params"]["api_base"] = base_url
        
        # 检查是否已存在
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        for existing_model in model_list:
            if existing_model.get("model_name") == final_model_id:
                raise ValueError(f"模型 {final_model_id} 已存在于配置中")
        
        # 添加到配置
        model_list.append(model_config)
        self.current_config["model_list"] = model_list
        
        return self._save_config()
    
    def remove_model_from_config(self, model_name: str) -> bool:
        """从配置中移除模型"""
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        original_length = len(model_list)
        
        # 过滤掉要删除的模型
        model_list = [model for model in model_list
                     if model.get("model_name") != model_name]
        
        if len(model_list) == original_length:
            return False
        
        self.current_config["model_list"] = model_list
        return self._save_config()
    
    def get_configured_models(self) -> List[Dict[str, Any]]:
        """获取当前配置的模型列表"""
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        result = []
        for model in model_list:
            model_name = model.get("model_name", "")
            litellm_params = model.get("litellm_params", {})
            model_info = model.get("model_info", {})
            
            # 尝试从model_info获取提供商，如果没有则从api_base推断
            provider = model_info.get("provider", "")
            if not provider:
                # 从api_base推断提供商
                api_base = litellm_params.get("api_base", "")
                provider = self._infer_provider_from_api_base(api_base)
            elif provider == "openaicompatible":
                # 如果是自定义提供商，显示为"自定义提供商"
                provider = "自定义提供商"
            
            model_id = litellm_params.get("model", model_name)
            
            result.append({
                "model_name": model_name,
                "provider": provider,
                "model_id": model_id
            })
        
        return result
    
    def _infer_provider_from_api_base(self, api_base: str) -> str:
        """根据api_base推断提供商"""
        if not api_base:
            return "未知"
        
        # 定义API基础URL与提供商的映射
        provider_mapping = {
            "api.deepseek.com": "DeepSeek",
            "dashscope.aliyuncs.com": "阿里云",
            "open.bigmodel.cn": "智谱AI",
            "api.siliconflow.cn": "硅基流动",
            "api.moonshot.cn": "Kimi",
            "openrouter.ai": "OpenRouter",
            "127.0.0.1:11434": "Ollama",
            "localhost:11434": "Ollama",
            "generativelanguage.googleapis.com": "Google Gemini"
        }
        
        # 检查API基础URL中是否包含已知提供商的域名
        for domain, provider_name in provider_mapping.items():
            if domain in api_base:
                return provider_name
        
        # 如果没有匹配到已知提供商，返回"未知"
        return "未知"
    
    def save_api_key_to_preset(self, provider_id: str, api_key: str) -> bool:
        """将API密钥保存到预设配置中"""
        providers = self.presets.get('providers', {})
        if provider_id in providers:
            provider_info = providers[provider_id]
            # 只为非本地提供商保存API密钥
            if not provider_info.get('is_local', False):
                provider_info['saved_api_key'] = api_key
                return self._save_presets()
        return False