"""
嵌入模型API
提供获取嵌入模型维度等功能的API端点
"""

import os
import json
from typing import Dict, Any, Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from .emb_service import prepare_emb, load_config, list_available_tables, delete_table, update_table_metadata, prepare_doc, create_db

# 创建路由器
router = APIRouter(prefix="/api/embedding", tags=["embedding"])

class EmbeddingDimensionsRequest(BaseModel):
    """获取嵌入维度请求模型"""
    model_id: str

class EmbeddingDimensionsResponse(BaseModel):
    """嵌入维度响应模型"""
    success: bool
    dimensions: int
    message: str
    model_id: Optional[str] = None

@router.get("/dimensions/{model_id:path}", response_model=EmbeddingDimensionsResponse)
async def get_embedding_dimensions(model_id: str):
    """
    获取指定嵌入模型的维度
    
    Args:
        model_id: 模型ID
        
    Returns:
        嵌入维度响应
    """
    try:
        
        # 加载配置
        config = load_config()
        
        # 确定嵌入URL和api_key
        embedding_url = config.get("embeddingUrl", "http://127.0.0.1:4000")
        print(f"url传的是啥？{embedding_url}")
        api_key = config.get("embeddingApiKey","sk-123")
        print(f"api传对了吗？{api_key}")
        
        # 尝试通过实际API调用获取维度
        try:
            # 准备嵌入模型
            embeddings = prepare_emb(model_id, embedding_url, api_key)
            # 发送测试请求获取嵌入向量
            test_text = "test"
            embedding_vector = embeddings.embed_query(test_text)
            
            # 获取向量长度作为维度
            dimensions = len(embedding_vector)
            
            # 保存维度信息到store.json
            await save_embedding_dimensions_to_config(model_id, dimensions)
            print(f"获取到维度{dimensions}")
            return EmbeddingDimensionsResponse(
                success=True,
                dimensions=dimensions,
                message=f"成功获取模型 {model_id} 的嵌入维度",
                model_id=model_id
            )
            
        except Exception as api_error:
            # 如果API调用失败，尝试返回默认维度
            dimensions = 1024
            
            # 保存默认维度信息到store.json
            await save_embedding_dimensions_to_config(model_id, dimensions)
            
            return EmbeddingDimensionsResponse(
                success=True,
                dimensions=dimensions,
                message=f"无法确定模型 {model_id} 的维度，使用默认值1024",
                model_id=model_id
            )
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取嵌入维度失败: {str(e)}"
        )

async def save_embedding_dimensions_to_config(model_id: str, dimensions: int):
    """
    保存嵌入模型维度到配置文件
    
    Args:
        model_id: 模型ID
        dimensions: 维度值
    """
    try:
        # 加载当前配置
        config = load_config()
        
        # 确保config是一个字典
        if not isinstance(config, dict):
            config = {}
        
        # embeddingDimensions应该是一个字典，只存储当前使用的模型的维度信息
        # 每次保存时先清空现有数据，只保留当前模型的维度
        config["embeddingDimensions"] = {}
            
        # 保存模型维度
        config["embeddingDimensions"][model_id] = dimensions
        
        # 保存到文件
        config_file = Path(__file__).parent.parent / "config" / "store.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
        print(f"已保存模型 {model_id} 的维度 {dimensions} 到配置文件")
        
    except Exception as e:
        print(f"保存嵌入维度到配置文件失败: {e}")

# RAG分块设置相关API
class ChunkSettingsResponse(BaseModel):
    """RAG分块设置响应模型"""
    success: bool
    chunkSize: int
    chunkOverlap: int
    message: str

class ChunkSettingsRequest(BaseModel):
    """RAG分块设置请求模型"""
    chunkSize: int
    chunkOverlap: int

@router.get("/rag/chunk-settings", response_model=ChunkSettingsResponse)
async def get_rag_chunk_settings():
    """
    获取RAG分块设置
    
    Returns:
        RAG分块设置响应
    """
    try:
        # 加载配置
        config = load_config()
        
        # 获取分块设置
        chunk_size = config.get("ragChunkSize", 400)
        chunk_overlap = config.get("ragChunkOverlap", 50)
        
        return ChunkSettingsResponse(
            success=True,
            chunkSize=chunk_size,
            chunkOverlap=chunk_overlap,
            message="RAG分块设置获取成功"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取RAG分块设置失败: {str(e)}"
        )

# 知识库文件列表相关API
class KnowledgeBaseFilesResponse(BaseModel):
    """知识库文件列表响应模型"""
    success: bool
    files: list
    message: str

@router.get("/rag/files", response_model=KnowledgeBaseFilesResponse)
async def list_knowledge_base_files():
    """
    列出知识库中的所有文件
    
    Returns:
        知识库文件列表响应
    """
    try:
        # 加载配置
        config = load_config()
        
        # 确定嵌入URL和api_key
        embedding_url = config.get("embeddingUrl", "http://127.0.0.1:4000")
        api_key = config.get("embeddingApiKey","sk-123")
        embedding_model = config.get("embeddingModel", "")
        
        # 数据库路径 - 与emb_service.py保持一致
        import os
        from pathlib import Path
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 如果有嵌入模型，准备嵌入实例以获取详细信息
        embeddings = None
        if embedding_model:
            print(f"准备读取文件的嵌入模型：{embedding_model}")
            try:
                embeddings = prepare_emb(embedding_model, embedding_url, api_key)
            except Exception as e:
                print(f"准备嵌入模型失败，将只显示基本表信息: {e}")
        
        # 获取可用表列表
        tables = list_available_tables(db_path, embeddings)
        
        # 转换为前端期望的格式
        files = []
        for table in tables:
            files.append({
                "id": table["table_name"],  # 使用表名作为ID
                "name": table["original_filename"],  # 显示原始文件名
                "table_name": table["table_name"],  # 表名
                "created_at": table.get("created_at", "未知"),  # 创建时间
                "total_chunks": table.get("total_chunks", 0)  # 片段数量
            })
        
        return KnowledgeBaseFilesResponse(
            success=True,
            files=files,
            message="知识库文件列表获取成功"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取知识库文件列表失败: {str(e)}"
        )

# 删除知识库文件相关API
class DeleteKnowledgeBaseFileRequest(BaseModel):
    """删除知识库文件请求模型"""
    table_name: str

class DeleteKnowledgeBaseFileResponse(BaseModel):
    """删除知识库文件响应模型"""
    success: bool
    message: str

@router.delete("/rag/files/{table_name}", response_model=DeleteKnowledgeBaseFileResponse)
async def delete_knowledge_base_file(table_name: str):
    """
    删除指定的知识库文件
    
    Args:
        table_name: 要删除的表名
        
    Returns:
        删除结果响应
    """
    try:
        # 数据库路径 - 与emb_service.py保持一致
        import os
        from pathlib import Path
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 调用删除函数
        result = delete_table(db_path, table_name)
        
        if result:
            return DeleteKnowledgeBaseFileResponse(
                success=True,
                message=f"知识库文件 '{table_name}' 删除成功"
            )
        else:
            return DeleteKnowledgeBaseFileResponse(
                success=False,
                message=f"知识库文件 '{table_name}' 删除失败，表可能不存在"
            )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除知识库文件失败: {str(e)}"
        )

# 重命名知识库文件相关API
class RenameKnowledgeBaseFileResponse(BaseModel):
    """重命名知识库文件响应模型"""
    success: bool
    message: str

@router.put("/rag/files/{table_name}/rename", response_model=RenameKnowledgeBaseFileResponse)
async def rename_knowledge_base_file(table_name: str, new_name: str = Query(...)):
    """
    重命名指定的知识库文件（仅更新元数据中的original_filename）
    
    Args:
        table_name: 要重命名的表名
        new_name: 新的文件名
        
    Returns:
        重命名结果响应
    """
    try:
        # 加载配置
        config = load_config()
        
        # 确定嵌入URL和api_key
        embedding_url = config.get("embeddingUrl", "http://127.0.0.1:4000")
        api_key = config.get("embeddingApiKey","sk-123")
        embedding_model = config.get("embeddingModel", "")
        
        # 数据库路径 - 与emb_service.py保持一致
        import os
        from pathlib import Path
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 准备嵌入模型实例
        embeddings = None
        if embedding_model:
            try:
                embeddings = prepare_emb(embedding_model, embedding_url, api_key)
            except Exception as e:
                print(f"准备嵌入模型失败: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"准备嵌入模型失败: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="未配置嵌入模型，无法重命名文件"
            )
        
        # 调用更新元数据函数，只更新original_filename字段
        result = update_table_metadata(db_path, table_name, embeddings, {'original_filename': new_name})
        
        if result:
            return RenameKnowledgeBaseFileResponse(
                success=True,
                message=f"知识库文件显示名称已更新为 '{new_name}'"
            )
        else:
            return RenameKnowledgeBaseFileResponse(
                success=False,
                message=f"知识库文件重命名失败，表 '{table_name}' 可能不存在"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"重命名知识库文件失败: {str(e)}"
        )

# 添加文件到知识库相关API
class AddFileToKnowledgeBaseResponse(BaseModel):
    """添加文件到知识库响应模型"""
    success: bool
    message: str
    table_name: Optional[str] = None

@router.post("/rag/files", response_model=AddFileToKnowledgeBaseResponse)
async def add_file_to_knowledge_base(file: UploadFile = File(...)):
    """
    添加文件到知识库
    
    Args:
        file: 上传的文件
        
    Returns:
        添加结果响应
    """
    try:
        # 加载配置
        config = load_config()
        
        # 确定嵌入URL和api_key
        embedding_url = config.get("embeddingUrl", "http://127.0.0.1:4000")
        api_key = config.get("embeddingApiKey","sk-123")
        embedding_model = config.get("embeddingModel", "")
        
        if not embedding_model:
            raise HTTPException(
                status_code=400,
                detail="未配置嵌入模型，请先配置嵌入模型"
            )
        
        # 数据库路径 - 与emb_service.py保持一致
        import os
        from pathlib import Path
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
        
        # 创建临时目录保存上传的文件
        temp_dir = os.path.join(os.path.dirname(__file__), "..", "data", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        # 保存上传的文件到临时目录
        temp_file_path = os.path.join(temp_dir, file.filename)
        with open(temp_file_path, "wb") as temp_file:
            content = await file.read()
            temp_file.write(content)
        
        try:
            # 准备嵌入模型
            embeddings = prepare_emb(embedding_model, embedding_url, api_key)
            
            # 获取RAG分块设置
            chunk_size = config.get("ragChunkSize", 400)
            chunk_overlap = config.get("ragChunkOverlap", 50)
            
            # 准备文档
            documents = prepare_doc(temp_file_path, chunk_size, chunk_overlap)
            
            # 创建数据库
            table_name = create_db(documents, embeddings, db_path)
            
            return AddFileToKnowledgeBaseResponse(
                success=True,
                message=f"文件 '{file.filename}' 已成功添加到知识库",
                table_name=table_name
            )
            
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"添加文件到知识库失败: {str(e)}"
        )