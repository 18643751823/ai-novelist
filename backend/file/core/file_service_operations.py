"""
文件服务操作类
包含文件创建、读取、更新、删除等核心操作
"""

import os
import shutil
import aiofiles
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from config import settings
from ..models import FileItem
from ..utils.path_validator import PathValidator
from ..managers.event_manager import file_event_manager
from ..utils.content_previewer import ContentPreviewer


logger = logging.getLogger(__name__)


class FileServiceOperations:
    def __init__(self, novel_dir: str):
        self.novel_dir = novel_dir
        self.path_validator = PathValidator(novel_dir)
        self.content_previewer = ContentPreviewer()

    async def create_chapter(self, name: str, content: str = "", parent_path: str = "") -> FileItem:
        """创建章节 - 添加自动重命名功能"""
        try:
            # 确保文件名有.md扩展名
            if not name.endswith('.md'):
                name += '.md'
            
            # 验证文件扩展名
            allowed_extensions = ['.md', '.txt']
            if not self.path_validator.validate_file_extension(name, allowed_extensions):
                raise ValueError(f"不支持的文件扩展名: {name}")
            
            # 构建目标目录
            target_dir = os.path.join(self.novel_dir, parent_path)
            
            # 生成唯一的文件名
            unique_name = await self._generate_unique_name(target_dir, name, False)
            
            # 确保目录存在
            os.makedirs(target_dir, exist_ok=True)
            
            # 写入文件内容
            file_path = os.path.join(target_dir, unique_name)
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(content)
            
            # 获取文件信息
            stat = os.stat(file_path)
            # 返回相对于novel目录的相对路径作为id
            relative_id = os.path.relpath(file_path, self.novel_dir)
            
            file_item = FileItem(
                id=relative_id,
                name=unique_name,
                path=file_path,
                type="file",
                content=content,
                created_at=datetime.fromtimestamp(stat.st_ctime),
                updated_at=datetime.fromtimestamp(stat.st_mtime)
            )
            
            # 触发文件创建事件
            await file_event_manager.emit_file_created(relative_id, file_item.dict())
            
            return file_item
            
        except Exception as e:
            logger.error(f"Error creating chapter '{name}': {str(e)}")
            logger.error(f"File path attempted: {os.path.join(self.novel_dir, parent_path, name)}")
            raise

    async def get_chapter_content(self, chapter_id: str) -> str:
        """获取章节内容"""
        try:
            # 处理前端发送的路径格式
            clean_path = self.path_validator.normalize_path(chapter_id)
            
            # 验证路径安全性
            if not self.path_validator.is_safe_path(clean_path):
                raise ValueError(f"不安全的文件路径: {chapter_id}")
                
            full_path = self.path_validator.get_full_path(clean_path)
            
            async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            return content
        except Exception as e:
            logger.error(f"Error getting chapter content: {str(e)}")
            raise

    async def update_chapter_content(self, chapter_id: str, content: str):
        """更新章节内容"""
        try:
            # 处理前端发送的路径格式
            clean_path = self.path_validator.normalize_path(chapter_id)
            
            # 验证路径安全性
            if not self.path_validator.is_safe_path(clean_path):
                raise ValueError(f"不安全的文件路径: {chapter_id}")
                
            full_path = self.path_validator.get_full_path(clean_path)
            
            # 读取旧内容用于事件
            old_content = ""
            if os.path.exists(full_path):
                async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
                    old_content = await f.read()
            
            async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
                await f.write(content)
            logger.info(f"Chapter {full_path} updated successfully")
            
            # 触发文件更新事件
            await file_event_manager.emit_file_updated(clean_path, old_content, content)
            
        except Exception as e:
            logger.error(f"Error updating chapter content: {str(e)}")
            raise

    async def delete_chapter(self, chapter_id: str):
        """删除章节"""
        try:
            # 处理前端发送的路径格式
            clean_path = self.path_validator.normalize_path(chapter_id)
            
            # 验证路径安全性
            if not self.path_validator.is_safe_path(clean_path):
                raise ValueError(f"不安全的文件路径: {chapter_id}")
                
            full_path = self.path_validator.get_full_path(clean_path)
            
            if os.path.exists(full_path):
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path)
                    logger.info(f"Folder {full_path} deleted successfully")
                else:
                    os.remove(full_path)
                    logger.info(f"File {full_path} deleted successfully")
                    
                # 触发文件删除事件
                await file_event_manager.emit_file_deleted(clean_path)
            else:
                raise FileNotFoundError(f"Chapter not found: {full_path}")
        except Exception as e:
            logger.error(f"Error deleting chapter: {str(e)}")
            raise

    async def _generate_unique_name(self, target_dir: str, original_name: str, is_folder: bool = False) -> str:
        """生成唯一的文件或文件夹名称"""
        import os.path
        
        # 分离文件名和扩展名
        if is_folder:
            base_name = original_name
            ext_name = ""
        else:
            base_name, ext_name = os.path.splitext(original_name)
        
        counter = 0
        unique_name = original_name
        
        while True:
            if counter == 0:
                current_name = original_name
            else:
                current_name = f"{base_name}-副本{counter}{ext_name}"
            
            full_path = os.path.join(target_dir, current_name)
            
            # 检查文件或文件夹是否存在
            if not os.path.exists(full_path):
                unique_name = current_name
                break
            
            counter += 1
        
        return unique_name