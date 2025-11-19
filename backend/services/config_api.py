"""
配置存储API模块
为前端提供配置存储的RESTful API
"""

import json
import logging
import yaml
from typing import Any, Dict, Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/config", tags=["Config"])

# 数据模型
class StoreValueRequest(BaseModel):
    """存储值请求模型"""
    key: str
    value: Any

class StoreValueResponse(BaseModel):
    """存储值响应模型"""
    success: bool
    message: str
    data: Optional[Any] = None

def load_store_config():
    """加载存储配置"""
    try:
        with open("config/store.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("配置文件不存在，创建默认配置")
        default_config = {}
        save_store_config(default_config)
        return default_config
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"加载配置文件失败: {str(e)}")

def save_store_config(config: Dict[str, Any]):
    """保存存储配置"""
    try:
        with open("config/store.json", "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"保存配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置文件失败: {str(e)}")

# API端点
@router.get("/store", response_model=StoreValueResponse, summary="获取存储值")
async def get_store_value(key: str):
    """
    根据键名获取存储值
    
    - **key**: 存储键名
    """
    try:
        config = load_store_config()
        value = config.get(key)
        
        return StoreValueResponse(
            success=True,
            message="获取存储值成功",
            data=value
        )
        
    except Exception as e:
        logger.error(f"获取存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取存储值失败: {str(e)}")

@router.post("/store", response_model=StoreValueResponse, summary="设置存储值")
async def set_store_value(request: StoreValueRequest):
    """
    设置存储值
    
    - **key**: 存储键名
    - **value**: 存储值
    """
    try:
        config = load_store_config()
        config[request.key] = request.value
        save_store_config(config)
        
        return StoreValueResponse(
            success=True,
            message="设置存储值成功",
            data=request.value
        )
        
    except Exception as e:
        logger.error(f"设置存储值失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置存储值失败: {str(e)}")

@router.get("/model-url", response_model=StoreValueResponse, summary="获取模型对应的URL")
async def get_model_url(model_name: str):
    """
    根据模型名称获取对应的API URL
    
    - **model_name**: 模型名称
    """
    try:
        # 加载配置文件
        config_file = Path(__file__).parent.parent / "api_provider" / "config.yaml"
        preset_config_file = Path(__file__).parent.parent / "api_provider" / "preset_models.yaml"
        
        # 首先检查config.yaml
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                
            # 在model_list中查找模型
            if 'model_list' in config:
                for model in config['model_list']:
                    if model.get('model_name') == model_name:
                        url = model.get('litellm_params', {}).get('api_base', '')
                        return StoreValueResponse(
                            success=True,
                            message="获取模型URL成功",
                            data=url
                        )
        
        # 如果config.yaml中没有找到，检查preset_models.yaml
        if preset_config_file.exists():
            with open(preset_config_file, 'r', encoding='utf-8') as f:
                preset_config = yaml.safe_load(f)
                
            # 在providers中查找匹配的提供商
            if 'providers' in preset_config:
                for provider_name, provider_config in preset_config['providers'].items():
                    model_prefix = provider_config.get('model_id_prefix', '')
                    if model_name.startswith(model_prefix):
                        url = provider_config.get('base_url', '')
                        return StoreValueResponse(
                            success=True,
                            message="获取模型URL成功",
                            data=url
                        )
        
        # 如果都没有找到，返回默认URL
        return StoreValueResponse(
            success=True,
            message="未找到模型URL，返回默认URL",
            data="http://127.0.0.1:4000"
        )
        
    except Exception as e:
        logger.error(f"获取模型URL失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模型URL失败: {str(e)}")

@router.get("/model-api-key", response_model=StoreValueResponse, summary="获取模型对应的API密钥")
async def get_model_api_key(model_name: str):
    """
    根据模型名称获取对应的API密钥
    
    - **model_name**: 模型名称
    """
    try:
        # 加载配置文件
        config_file = Path(__file__).parent.parent / "api_provider" / "config.yaml"
        preset_config_file = Path(__file__).parent.parent / "api_provider" / "preset_models.yaml"
        
        # 首先检查config.yaml
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                
            # 在model_list中查找模型
            if 'model_list' in config:
                for model in config['model_list']:
                    if model.get('model_name') == model_name:
                        api_key = model.get('litellm_params', {}).get('api_key', '')
                        return StoreValueResponse(
                            success=True,
                            message="获取模型API密钥成功",
                            data=api_key
                        )
        
        # 如果config.yaml中没有找到，检查preset_models.yaml
        if preset_config_file.exists():
            with open(preset_config_file, 'r', encoding='utf-8') as f:
                preset_config = yaml.safe_load(f)
                
            # 在providers中查找匹配的提供商
            if 'providers' in preset_config:
                for provider_name, provider_config in preset_config['providers'].items():
                    model_prefix = provider_config.get('model_id_prefix', '')
                    if model_name.startswith(model_prefix):
                        api_key = provider_config.get('saved_api_key', '')
                        return StoreValueResponse(
                            success=True,
                            message="获取模型API密钥成功",
                            data=api_key
                        )
        
        # 如果都没有找到，返回空字符串
        return StoreValueResponse(
            success=True,
            message="未找到模型API密钥",
            data=""
        )
        
    except Exception as e:
        logger.error(f"获取模型API密钥失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取模型API密钥失败: {str(e)}")
