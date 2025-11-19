"""
文件服务文件夹操作类
包含文件夹创建、移动、复制等操作
"""

import os
import shutil
import aiofiles
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ..models import FileItem
from ..utils.path_validator import PathValidator
from ..managers.event_manager import file_event_manager


logger = logging.getLogger(__name__)


class FileServiceFolders:
    def __init__(self, novel_dir: str):
        self.novel_dir = novel_dir
        self.path_validator = PathValidator(novel_dir)

    async def create_folder(self, name: str, parent_path: str = "") -> FileItem:
        """创建文件夹 - 添加自动重命名功能"""
        try:
            # 构建目标目录
            target_dir = os.path.join(self.novel_dir, parent_path)
            
            # 生成唯一的文件夹名
            unique_name = await self._generate_unique_name(target_dir, name, True)
            
            # 创建文件夹
            folder_path = os.path.join(target_dir, unique_name)
            os.makedirs(folder_path, exist_ok=True)
            
            stat = os.stat(folder_path)
            # 返回相对于novel目录的相对路径作为id
            relative_id = os.path.relpath(folder_path, self.novel_dir)
            
            file_item = FileItem(
                id=relative_id,
                name=unique_name,
                path=folder_path,
                type="folder",
                created_at=datetime.fromtimestamp(stat.st_ctime),
                updated_at=datetime.fromtimestamp(stat.st_mtime)
            )
            
            # 触发文件夹创建事件
            await file_event_manager.emit_file_created(relative_id, file_item.dict())
            
            return file_item
        except Exception as e:
            logger.error(f"Error creating folder: {str(e)}")
            raise

    async def rename_item(self, old_path: str, new_name: str):
        """重命名文件或文件夹"""
        try:
            # 确保路径在novel目录内
            if not old_path.startswith(self.novel_dir):
                old_path = os.path.join(self.novel_dir, old_path)
            
            # 验证路径安全性
            clean_old_path = self.path_validator.normalize_path(old_path)
            if not self.path_validator.is_safe_path(clean_old_path):
                raise ValueError(f"不安全的文件路径: {old_path}")
            
            parent_dir = os.path.dirname(old_path)
            new_path = os.path.join(parent_dir, new_name)
            
            os.rename(old_path, new_path)
            logger.info(f"Renamed {old_path} to {new_path}")
            
            # 触发文件重命名事件
            relative_old_path = os.path.relpath(old_path, self.novel_dir)
            relative_new_path = os.path.relpath(new_path, self.novel_dir)
            await file_event_manager.emit_file_renamed(relative_old_path, relative_new_path)
            
        except Exception as e:
            logger.error(f"Error renaming item: {str(e)}")
            raise

    async def move_item(self, source_path: str, target_path: str):
        """移动文件或文件夹"""
        try:
            # 确保路径在novel目录内
            if not source_path.startswith(self.novel_dir):
                source_path = os.path.join(self.novel_dir, source_path)
            if not target_path.startswith(self.novel_dir):
                target_path = os.path.join(self.novel_dir, target_path)
            
            # 验证路径安全性
            clean_source = self.path_validator.normalize_path(source_path)
            clean_target = self.path_validator.normalize_path(target_path)
            if not self.path_validator.is_safe_path(clean_source) or not self.path_validator.is_safe_path(clean_target):
                raise ValueError(f"不安全的文件路径")
            
            # 如果目标是目录，将源移动到目标目录下
            if os.path.isdir(target_path):
                target_path = os.path.join(target_path, os.path.basename(source_path))
            
            shutil.move(source_path, target_path)
            logger.info(f"Moved {source_path} to {target_path}")
            
            # 触发文件移动事件
            relative_source = os.path.relpath(source_path, self.novel_dir)
            relative_target = os.path.relpath(target_path, self.novel_dir)
            await file_event_manager.emit_file_moved(relative_source, relative_target)
            
        except Exception as e:
            logger.error(f"Error moving item: {str(e)}")
            raise

    async def copy_item(self, source_path: str, target_path: str):
        """复制文件或文件夹"""
        try:
            # 确保路径在novel目录内
            if not source_path.startswith(self.novel_dir):
                source_path = os.path.join(self.novel_dir, source_path)
            if not target_path.startswith(self.novel_dir):
                target_path = os.path.join(self.novel_dir, target_path)
            
            # 验证路径安全性
            clean_source = self.path_validator.normalize_path(source_path)
            clean_target = self.path_validator.normalize_path(target_path)
            if not self.path_validator.is_safe_path(clean_source) or not self.path_validator.is_safe_path(clean_target):
                raise ValueError(f"不安全的文件路径")
            
            # 检查源路径是否存在
            if not os.path.exists(source_path):
                raise FileNotFoundError(f"源路径不存在: {source_path}")
            
            # 如果目标是目录，将源复制到目标目录下
            if os.path.isdir(target_path):
                source_name = os.path.basename(source_path)
                target_dir = target_path
                # 生成唯一的名称以避免冲突
                unique_name = await self._generate_unique_name(target_dir, source_name, os.path.isdir(source_path))
                target_path = os.path.join(target_dir, unique_name)
            else:
                # 如果目标是文件路径，确保父目录存在
                target_dir = os.path.dirname(target_path)
                os.makedirs(target_dir, exist_ok=True)
                
                # 如果目标已存在，生成唯一名称
                if os.path.exists(target_path):
                    target_dir = os.path.dirname(target_path)
                    source_name = os.path.basename(source_path)
                    unique_name = await self._generate_unique_name(target_dir, source_name, os.path.isdir(source_path))
                    target_path = os.path.join(target_dir, unique_name)
            
            # 执行复制操作
            if os.path.isdir(source_path):
                shutil.copytree(source_path, target_path, dirs_exist_ok=True)
            else:
                shutil.copy2(source_path, target_path)
            
            logger.info(f"Copied {source_path} to {target_path}")
            
            # 触发文件复制事件
            relative_source = os.path.relpath(source_path, self.novel_dir)
            relative_target = os.path.relpath(target_path, self.novel_dir)
            await file_event_manager.emit_file_created(relative_target, {"path": relative_target})
            
        except Exception as e:
            logger.error(f"Error copying item: {str(e)}")
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