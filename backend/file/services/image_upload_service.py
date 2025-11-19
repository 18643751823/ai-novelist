import os
import uuid
from pathlib import Path
from typing import Dict, Any, List
import base64
from fastapi import UploadFile, HTTPException
import aiofiles
from config import settings

class ImageUploadService:
    def __init__(self):
        # 上传目录相对于backend/data目录，使用绝对路径
        backend_dir = Path(__file__).parent.parent.parent
        self.upload_dir = backend_dir / "data" / "uploads"
        self.allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'}
        self.max_file_size = 5 * 1024 * 1024  # 5MB
        
        # 确保上传目录存在
        self.ensure_upload_dir()

    def ensure_upload_dir(self):
        """确保上传目录存在"""
        try:
            self.upload_dir.mkdir(parents=True, exist_ok=True)
            print(f"上传目录已准备就绪: {self.upload_dir}")
        except Exception as e:
            print(f"创建上传目录失败: {e}")
            raise

    def generate_filename(self, original_filename: str) -> str:
        """生成唯一的文件名"""
        ext = Path(original_filename).suffix.lower()
        if ext not in self.allowed_extensions:
            ext = '.png'  # 默认使用 png 格式
        
        timestamp = int(os.times().elapsed * 1000)
        random_str = uuid.uuid4().hex[:8]
        return f"image_{timestamp}_{random_str}{ext}"

    def is_allowed_file(self, filename: str) -> bool:
        """检查文件类型是否允许"""
        ext = Path(filename).suffix.lower()
        return ext in self.allowed_extensions

    async def upload_file(self, file: UploadFile) -> Dict[str, Any]:
        """上传单个文件"""
        try:
            # 检查文件类型
            if not self.is_allowed_file(file.filename):
                raise HTTPException(
                    status_code=400, 
                    detail=f"不支持的文件类型。仅支持 {', '.join(self.allowed_extensions)} 格式。"
                )

            # 检查文件大小
            content = await file.read()
            if len(content) > self.max_file_size:
                raise HTTPException(
                    status_code=400,
                    detail="文件大小超过5MB限制"
                )

            # 生成唯一文件名
            filename = self.generate_filename(file.filename)
            file_path = self.upload_dir / filename

            # 保存文件
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)

            # 返回文件信息
            return {
                "success": True,
                "data": {
                    "filename": filename,
                    "url": f"http://{settings.HOST}:{settings.PORT}/uploads/{filename}",
                    "path": str(file_path),
                    "size": len(content),
                    "original_name": file.filename
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

    async def upload_from_buffer(self, buffer_data: bytes, filename: str = None) -> Dict[str, Any]:
        """从缓冲区上传图片（用于剪贴板粘贴）"""
        try:
            # 检查文件大小
            if len(buffer_data) > self.max_file_size:
                raise HTTPException(
                    status_code=400,
                    detail="文件大小超过5MB限制"
                )

            # 生成文件名
            if not filename:
                filename = self.generate_filename("paste.png")
            else:
                filename = self.generate_filename(filename)

            file_path = self.upload_dir / filename

            # 保存文件
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(buffer_data)

            # 返回文件信息
            return {
                "success": True,
                "data": {
                    "filename": filename,
                    "url": f"http://{settings.HOST}:{settings.PORT}/uploads/{filename}",
                    "path": str(file_path),
                    "size": len(buffer_data)
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")

    async def upload_from_base64(self, base64_data: str, filename: str = None) -> Dict[str, Any]:
        """从 base64 数据上传图片"""
        try:
            # 解析 base64 数据
            if ',' in base64_data:
                # 处理 data:image/png;base64, 格式
                base64_data = base64_data.split(',')[1]
            
            buffer_data = base64.b64decode(base64_data)
            return await self.upload_from_buffer(buffer_data, filename)

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Base64 数据解析失败: {str(e)}")

    async def list_uploaded_files(self) -> List[Dict[str, Any]]:
        """列出已上传的文件"""
        try:
            files = []
            for file_path in self.upload_dir.glob("*"):
                if file_path.is_file() and self.is_allowed_file(file_path.name):
                    stat = file_path.stat()
                    files.append({
                        "filename": file_path.name,
                        "url": f"http://{settings.HOST}:{settings.PORT}/uploads/{file_path.name}",
                        "path": str(file_path),
                        "size": stat.st_size,
                        "created_time": stat.st_ctime
                    })
            return files
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

    async def delete_file(self, filename: str) -> Dict[str, Any]:
        """删除上传的文件"""
        try:
            file_path = self.upload_dir / filename
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                return {"success": True, "message": "文件删除成功"}
            else:
                raise HTTPException(status_code=404, detail="文件不存在")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"文件删除失败: {str(e)}")


# 创建全局实例
image_upload_service = ImageUploadService()