"""
AI配置API模块
为前端提供AI相关配置的RESTful API
包括API密钥管理、模型选择、提供商配置、提示词配置等
"""

import json
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/ai-config", tags=["AI Config"])

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

class SelectedModelRequest(BaseModel):
    """选中模型请求模型"""
    selectedModel: str
    selectedProvider: str = ""

class SelectedModelResponse(BaseModel):
    """选中模型响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, str]] = None

class ProviderConfigResponse(BaseModel):
    """提供商配置响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class DefaultPromptsResponse(BaseModel):
    """默认提示词响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, str]] = None

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

# API密钥相关API
@router.get("/api-key", response_model=StoreValueResponse, summary="获取API密钥")
async def get_api_key():
    """
    获取API密钥配置
    """
    try:
        config = load_store_config()
        
        # 返回所有API密钥配置
        api_keys = {
            "deepseekApiKey": config.get("deepseekApiKey", ""),
            "openrouterApiKey": config.get("openrouterApiKey", ""),
            "siliconflowApiKey": config.get("siliconflowApiKey", ""),
            "aliyunApiKey": config.get("aliyunApiKey", ""),
            "zhipuaiApiKey": config.get("zhipuaiApiKey", ""),
            "kimiApiKey": config.get("kimiApiKey", ""),
            "geminiApiKey": config.get("geminiApiKey", "")
        }
        
        return StoreValueResponse(
            success=True,
            message="获取API密钥成功",
            data=api_keys
        )
        
    except Exception as e:
        logger.error(f"获取API密钥失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取API密钥失败: {str(e)}")

# 选中的模型相关API
@router.get("/selected-model", response_model=SelectedModelResponse, summary="获取选中的模型")
async def get_selected_model():
    """
    获取当前选中的模型和提供商
    """
    try:
        config = load_store_config()
        
        selected_model_data = {
            "selectedModel": config.get("selectedModel", ""),
            "selectedProvider": config.get("selectedProvider", "")
        }
        
        return SelectedModelResponse(
            success=True,
            message="获取选中模型成功",
            data=selected_model_data
        )
        
    except Exception as e:
        logger.error(f"获取选中模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取选中模型失败: {str(e)}")

@router.post("/selected-model", response_model=SelectedModelResponse, summary="设置选中的模型")
async def set_selected_model(request: SelectedModelRequest):
    """
    设置当前选中的模型和提供商
    
    - **selectedModel**: 选中的模型ID
    - **selectedProvider**: 选中的提供商ID
    """
    try:
        config = load_store_config()
        config["selectedModel"] = request.selectedModel
        config["selectedProvider"] = request.selectedProvider
        save_store_config(config)
        
        selected_model_data = {
            "selectedModel": request.selectedModel,
            "selectedProvider": request.selectedProvider
        }
        
        return SelectedModelResponse(
            success=True,
            message="设置选中模型成功",
            data=selected_model_data
        )
        
    except Exception as e:
        logger.error(f"设置选中模型失败: {e}")
        raise HTTPException(status_code=500, detail=f"设置选中模型失败: {str(e)}")

# 提供商配置相关API
@router.get("/provider-config", response_model=ProviderConfigResponse, summary="获取提供商配置")
async def get_provider_config():
    """
    获取所有提供商配置
    """
    try:
        config = load_store_config()
        
        return ProviderConfigResponse(
            success=True,
            message="获取提供商配置成功",
            data=config
        )
        
    except Exception as e:
        logger.error(f"获取提供商配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取提供商配置失败: {str(e)}")

@router.post("/provider-config", response_model=ProviderConfigResponse, summary="保存提供商配置")
async def save_provider_config(config_data: Dict[str, Any]):
    """
    保存提供商配置
    
    - **config_data**: 提供商配置数据
    """
    try:
        save_store_config(config_data)
        
        return ProviderConfigResponse(
            success=True,
            message="保存提供商配置成功",
            data=config_data
        )
        
    except Exception as e:
        logger.error(f"保存提供商配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存提供商配置失败: {str(e)}")

# 默认提示词相关API
@router.get("/default-prompts", response_model=DefaultPromptsResponse, summary="获取默认提示词")
async def get_default_prompts():
    """
    获取所有默认提示词配置
    """
    try:
        # 导入默认提示词
        from .prompts.sys_prompts import (
            OUTLINE_PROMPT,
            WRITING_PROMPT,
            ADJUSTMENT_PROMPT
        )
        
        default_prompts = {
            "outline": OUTLINE_PROMPT,
            "writing": WRITING_PROMPT,
            "adjustment": ADJUSTMENT_PROMPT
        }
        
        return DefaultPromptsResponse(
            success=True,
            message="获取默认提示词成功",
            data=default_prompts
        )
        
    except Exception as e:
        logger.error(f"获取默认提示词失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取默认提示词失败: {str(e)}")