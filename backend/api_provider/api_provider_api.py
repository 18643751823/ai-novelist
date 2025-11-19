#!/usr/bin/env python3
"""
API Provider API 路由
提供模型提供商配置、模型列表获取等API端点
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

from .provider_manager import (
    APIProviderManager,
    ProviderConfig,
    ModelInfo,
    ModelConfig
)

# 创建路由器
router = APIRouter(prefix="/api/provider", tags=["API Provider"])

# 创建管理器实例
manager = APIProviderManager()

# 请求模型
class CustomProviderRequest(BaseModel):
    name: str
    base_url: str
    api_key: Optional[str] = None

class AddModelRequest(BaseModel):
    provider_id: str
    model_id: str
    api_key: Optional[str] = None

class AddCustomModelRequest(BaseModel):
    model_id: str
    base_url: str
    api_key: Optional[str] = None

class SaveApiKeyRequest(BaseModel):
    provider_id: str
    api_key: str

# API端点
@router.get("/providers", response_model=Dict[str, Any])
async def get_providers():
    """获取所有预设提供商"""
    try:
        providers = manager.get_providers()
        result = {}
        for provider_id, config in providers.items():
            result[provider_id] = {
                "name": config.name,
                "base_url": config.base_url,
                "models_endpoint": config.models_endpoint,
                "model_id_prefix": config.model_id_prefix,
                "description": config.description,
                "is_local": config.is_local,
                "has_saved_api_key": bool(config.saved_api_key),
                "saved_api_key": config.saved_api_key
            }
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取提供商列表失败: {str(e)}")

@router.get("/custom-providers", response_model=Dict[str, Any])
async def get_custom_providers():
    """获取所有自定义提供商"""
    try:
        custom_providers = manager.get_custom_providers()
        result = {}
        for provider_id, config in custom_providers.items():
            result[provider_id] = {
                "name": config.name,
                "base_url": config.base_url,
                "models_endpoint": config.models_endpoint,
                "model_id_prefix": config.model_id_prefix,
                "description": config.description,
                "has_saved_api_key": bool(config.saved_api_key),
                "saved_api_key": config.saved_api_key
            }
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取自定义提供商列表失败: {str(e)}")

@router.get("/models/{provider_id}", response_model=Dict[str, Any])
async def get_provider_models(
    provider_id: str,
    api_key: Optional[str] = Query(None, description="API密钥，非本地模型需要")
):
    """获取指定提供商的模型列表"""
    try:
        models = manager.get_provider_models(provider_id, api_key)
        
        result = []
        for model in models:
            model_data = {
                "id": model.id,
                "name": model.name,
                "provider": model.provider
            }
            if model.type:
                model_data["type"] = model.type
            if model.description:
                model_data["description"] = model.description
            result.append(model_data)
        
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")

@router.post("/custom-models", response_model=Dict[str, Any])
async def get_custom_provider_models(request: CustomProviderRequest):
    """获取自定义提供商的模型列表"""
    try:
        models = manager.get_custom_provider_models(
            request.name, 
            request.base_url, 
            request.api_key
        )
        result = []
        for model in models:
            model_data = {
                "id": model.id,
                "name": model.name,
                "provider": model.provider
            }
            if model.base_url:
                model_data["base_url"] = model.base_url
            if model.api_key:
                model_data["api_key"] = model.api_key
            result.append(model_data)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取自定义提供商模型列表失败: {str(e)}")

@router.post("/custom-providers", response_model=Dict[str, Any])
async def save_custom_provider(request: CustomProviderRequest):
    """保存自定义提供商"""
    try:
        success = manager.save_custom_provider(
            request.name, 
            request.base_url, 
            request.api_key
        )
        if success:
            return {"success": True, "message": f"已保存自定义提供商: {request.name}"}
        else:
            raise HTTPException(status_code=500, detail="保存自定义提供商失败")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存自定义提供商失败: {str(e)}")

@router.delete("/custom-providers/{provider_id}", response_model=Dict[str, Any])
async def delete_custom_provider(provider_id: str):
    """删除自定义提供商"""
    try:
        success = manager.delete_custom_provider(provider_id)
        if success:
            return {"success": True, "message": f"已删除自定义提供商: {provider_id}"}
        else:
            raise HTTPException(status_code=404, detail=f"自定义提供商 {provider_id} 不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除自定义提供商失败: {str(e)}")

@router.post("/models", response_model=Dict[str, Any])
async def add_model_to_config(request: AddModelRequest):
    """将模型添加到配置中"""
    try:
        success = manager.add_model_to_config(
            request.provider_id, 
            request.model_id, 
            request.api_key
        )
        if success:
            return {"success": True, "message": f"已添加模型: {request.model_id}"}
        else:
            raise HTTPException(status_code=500, detail="添加模型失败")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加模型失败: {str(e)}")

@router.post("/custom-models/config", response_model=Dict[str, Any])
async def add_custom_model_to_config(request: AddCustomModelRequest):
    """将自定义模型添加到配置中"""
    try:
        success = manager.add_custom_model_to_config(
            request.model_id, 
            request.base_url, 
            request.api_key
        )
        if success:
            return {"success": True, "message": f"已添加自定义模型: {request.model_id}"}
        else:
            raise HTTPException(status_code=500, detail="添加自定义模型失败")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"添加自定义模型失败: {str(e)}")

@router.delete("/models/{model_name}", response_model=Dict[str, Any])
async def remove_model_from_config(model_name: str):
    """从配置中移除模型"""
    try:
        success = manager.remove_model_from_config(model_name)
        if success:
            return {"success": True, "message": f"已删除模型: {model_name}"}
        else:
            raise HTTPException(status_code=404, detail=f"模型 {model_name} 不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除模型失败: {str(e)}")

@router.get("/config/models", response_model=Dict[str, Any])
async def get_configured_models():
    """获取当前配置的模型列表"""
    try:
        models = manager.get_configured_models()
        return {"success": True, "data": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置模型列表失败: {str(e)}")

@router.post("/api-key", response_model=Dict[str, Any])
async def save_api_key(request: SaveApiKeyRequest):
    """将API密钥保存到预设配置中"""
    try:
        success = manager.save_api_key_to_preset(
            request.provider_id, 
            request.api_key
        )
        if success:
            return {"success": True, "message": "API密钥已保存"}
        else:
            raise HTTPException(status_code=500, detail="保存API密钥失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存API密钥失败: {str(e)}")