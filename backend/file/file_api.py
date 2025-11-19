"""
文件管理API模块
为前端提供文件操作、文件夹管理、搜索等功能的RESTful API
"""

import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .core.file_service import FileService
from .services.image_upload_service import image_upload_service
from .models import FileItem

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/file", tags=["File Management"])

# 创建全局文件服务实例
file_service = FileService()

# 数据模型
class CreateChapterRequest(BaseModel):
    """创建章节请求模型"""
    name: str
    content: str = ""
    parent_path: str = ""

class CreateFolderRequest(BaseModel):
    """创建文件夹请求模型"""
    name: str
    parent_path: str = ""

class RenameItemRequest(BaseModel):
    """重命名项目请求模型"""
    old_path: str
    new_name: str

class MoveItemRequest(BaseModel):
    """移动项目请求模型"""
    source_path: str
    target_path: str

class CopyItemRequest(BaseModel):
    """复制项目请求模型"""
    source_path: str
    target_path: str

class SearchFilesRequest(BaseModel):
    """搜索文件请求模型"""
    query: str

class UpdateFileOrderRequest(BaseModel):
    """更新文件顺序请求模型"""
    file_paths: List[str]
    directory_path: str = ""

class UpdateFolderOrderRequest(BaseModel):
    """更新文件夹顺序请求模型"""
    folder_paths: List[str]
    directory_path: str = ""

# 文件操作API端点
@router.post("/chapters", summary="创建章节")
async def create_chapter(request: CreateChapterRequest):
    """创建新章节"""
    try:
        chapter = await file_service.create_chapter(
            name=request.name,
            content=request.content,
            parent_path=request.parent_path
        )
        return {
            "success": True,
            "data": chapter.dict()
        }
    except Exception as e:
        logger.error(f"创建章节失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建章节失败: {str(e)}")

@router.get("/chapters/{chapter_id}", summary="获取章节内容")
async def get_chapter_content(chapter_id: str):
    """获取章节内容"""
    try:
        content = await file_service.get_chapter_content(chapter_id)
        return {
            "success": True,
            "data": {
                "id": chapter_id,
                "content": content
            }
        }
    except Exception as e:
        logger.error(f"获取章节内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取章节内容失败: {str(e)}")

@router.put("/chapters/{chapter_id}", summary="更新章节内容")
async def update_chapter_content(chapter_id: str, request: Dict[str, Any]):
    """更新章节内容"""
    try:
        content = request.get("content", "")
        await file_service.update_chapter_content(chapter_id, content)
        return {
            "success": True,
            "message": "章节内容更新成功"
        }
    except Exception as e:
        logger.error(f"更新章节内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新章节内容失败: {str(e)}")

@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: str):
    """删除章节"""
    try:
        await file_service.delete_chapter(chapter_id)
        return {
            "success": True,
            "message": "章节删除成功"
        }
    except Exception as e:
        logger.error(f"删除章节失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除章节失败: {str(e)}")

# 文件夹操作API端点
@router.post("/folders", summary="创建文件夹")
async def create_folder(request: CreateFolderRequest):
    """创建新文件夹"""
    try:
        folder = await file_service.create_folder(
            name=request.name,
            parent_path=request.parent_path
        )
        return {
            "success": True,
            "data": folder.dict()
        }
    except Exception as e:
        logger.error(f"创建文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建文件夹失败: {str(e)}")

@router.post("/rename", summary="重命名文件或文件夹")
async def rename_item(request: RenameItemRequest):
    """重命名文件或文件夹"""
    try:
        await file_service.rename_item(request.old_path, request.new_name)
        return {
            "success": True,
            "message": "重命名成功"
        }
    except Exception as e:
        logger.error(f"重命名失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重命名失败: {str(e)}")

@router.post("/move", summary="移动文件或文件夹")
async def move_item(request: MoveItemRequest):
    """移动文件或文件夹"""
    try:
        await file_service.move_item(request.source_path, request.target_path)
        return {
            "success": True,
            "message": "移动成功"
        }
    except Exception as e:
        logger.error(f"移动失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"移动失败: {str(e)}")

@router.post("/copy", summary="复制文件或文件夹")
async def copy_item(request: CopyItemRequest):
    """复制文件或文件夹"""
    try:
        await file_service.copy_item(request.source_path, request.target_path)
        return {
            "success": True,
            "message": "复制成功"
        }
    except Exception as e:
        logger.error(f"复制失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"复制失败: {str(e)}")

# 搜索和排序API端点
@router.post("/search", summary="搜索文件")
async def search_files(request: SearchFilesRequest):
    """搜索文件"""
    try:
        files = await file_service.search_files(request.query)
        return {
            "success": True,
            "data": [file.dict() for file in files]
        }
    except Exception as e:
        logger.error(f"搜索文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"搜索文件失败: {str(e)}")

@router.post("/order/files", summary="更新文件顺序")
async def update_file_order(request: UpdateFileOrderRequest):
    """更新文件顺序"""
    try:
        await file_service.update_file_order(
            request.file_paths,
            request.directory_path
        )
        return {
            "success": True,
            "message": "文件顺序更新成功"
        }
    except Exception as e:
        logger.error(f"更新文件顺序失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新文件顺序失败: {str(e)}")

@router.post("/order/folders", summary="更新文件夹顺序")
async def update_folder_order(request: UpdateFolderOrderRequest):
    """更新文件夹顺序"""
    try:
        await file_service.update_folder_order(
            request.folder_paths,
            request.directory_path
        )
        return {
            "success": True,
            "message": "文件夹顺序更新成功"
        }
    except Exception as e:
        logger.error(f"更新文件夹顺序失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新文件夹顺序失败: {str(e)}")

# 文件列表API端点
@router.get("/list", summary="获取文件列表")
async def list_novel_files():
    """获取novel目录下所有文件"""
    try:
        result = await file_service.list_novel_files()
        return result
    except Exception as e:
        logger.error(f"获取文件列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

@router.get("/tree", summary="获取文件树")
async def get_file_tree():
    """获取文件树结构"""
    try:
        chapters = await file_service.list_chapters()
        return {
            "success": True,
            "data": chapters
        }
    except Exception as e:
        logger.error(f"获取文件树失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件树失败: {str(e)}")

# 图片上传API端点
@router.post("/upload/image", summary="上传图片")
async def upload_image(file: UploadFile = FastAPIFile(...)):
    """上传图片文件"""
    try:
        result = await image_upload_service.upload_file(file)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"图片上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")

@router.post("/upload/image/base64", summary="上传Base64图片")
async def upload_base64_image(request: Dict[str, Any]):
    """上传Base64格式的图片"""
    try:
        base64_data = request.get("data", "")
        filename = request.get("filename")
        result = await image_upload_service.upload_from_base64(base64_data, filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Base64图片上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Base64图片上传失败: {str(e)}")

@router.get("/upload/images", summary="获取已上传图片列表")
async def list_uploaded_images():
    """获取已上传的图片列表"""
    try:
        files = await image_upload_service.list_uploaded_files()
        return {
            "success": True,
            "data": files
        }
    except Exception as e:
        logger.error(f"获取图片列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取图片列表失败: {str(e)}")

@router.delete("/upload/images/{filename}", summary="删除上传的图片")
async def delete_uploaded_image(filename: str):
    """删除已上传的图片"""
    try:
        result = await image_upload_service.delete_file(filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除图片失败: {str(e)}")

# 基础文件操作API端点
@router.get("/read/{file_path:path}", summary="读取文件")
async def read_file(file_path: str):
    """读取文件内容"""
    try:
        content = await file_service.read_file(file_path)
        return {
            "success": True,
            "data": {
                "path": file_path,
                "content": content
            }
        }
    except Exception as e:
        logger.error(f"读取文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")

@router.put("/write/{file_path:path}", summary="写入文件")
async def write_file(file_path: str, request: Dict[str, Any]):
    """写入文件内容"""
    try:
        content = request.get("content", "")
        await file_service.write_file(file_path, content)
        return {
            "success": True,
            "message": "文件写入成功"
        }
    except Exception as e:
        logger.error(f"写入文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"写入文件失败: {str(e)}")