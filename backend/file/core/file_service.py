"""
文件服务主类
整合所有文件操作功能
"""

import os
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from config import settings
from ..models import FileItem
from .file_service_operations import FileServiceOperations
from .file_service_folders import FileServiceFolders
from .file_service_search import FileServiceSearch
from ..utils.file_tree_builder import file_tree_builder
from ..utils.content_previewer import ContentPreviewer


logger = logging.getLogger(__name__)


class FileService:
    def __init__(self):
        self.novel_dir = settings.NOVEL_DIR
        
        # 初始化各个功能模块
        self.operations = FileServiceOperations(self.novel_dir)
        self.folders = FileServiceFolders(self.novel_dir)
        self.search = FileServiceSearch(self.novel_dir)
        self.content_previewer = ContentPreviewer()
        
        logger.info(f"FileService initialized with novel directory: {self.novel_dir}")
        
        # 确保novel目录存在
        os.makedirs(self.novel_dir, exist_ok=True)

    # 文件操作相关方法
    async def create_chapter(self, name: str, content: str = "", parent_path: str = "") -> FileItem:
        """创建章节"""
        return await self.operations.create_chapter(name, content, parent_path)

    async def get_chapter_content(self, chapter_id: str) -> str:
        """获取章节内容"""
        return await self.operations.get_chapter_content(chapter_id)

    async def update_chapter_content(self, chapter_id: str, content: str):
        """更新章节内容"""
        await self.operations.update_chapter_content(chapter_id, content)

    async def delete_chapter(self, chapter_id: str):
        """删除章节"""
        await self.operations.delete_chapter(chapter_id)

    # 文件夹操作相关方法
    async def create_folder(self, name: str, parent_path: str = "") -> FileItem:
        """创建文件夹"""
        return await self.folders.create_folder(name, parent_path)

    async def rename_item(self, old_path: str, new_name: str):
        """重命名文件或文件夹"""
        await self.folders.rename_item(old_path, new_name)

    async def move_item(self, source_path: str, target_path: str):
        """移动文件或文件夹"""
        await self.folders.move_item(source_path, target_path)

    async def copy_item(self, source_path: str, target_path: str):
        """复制文件或文件夹"""
        await self.folders.copy_item(source_path, target_path)

    # 搜索和排序相关方法
    async def search_files(self, query: str) -> List[FileItem]:
        """搜索文件"""
        return await self.search.search_files(query)

    async def update_file_order(self, file_paths: List[str], directory_path: str = ""):
        """更新文件顺序（仅文件）"""
        await self.search.update_file_order(file_paths, directory_path)

    async def update_folder_order(self, folder_paths: List[str], directory_path: str = ""):
        """更新文件夹顺序（仅文件夹）"""
        await self.search.update_folder_order(folder_paths, directory_path)

    async def list_novel_files(self) -> Dict[str, Any]:
        """列出novel目录下所有文件"""
        return await self.search.list_novel_files()

    async def search_novel_files(self, search_query: str) -> Dict[str, Any]:
        """搜索novel文件夹中的文件内容"""
        return await self.search.search_novel_files(search_query)

    # 基础文件操作
    async def read_file(self, file_path: str) -> str:
        """读取文件内容"""
        return await self.operations.get_chapter_content(file_path)

    async def write_file(self, file_path: str, content: str):
        """写入文件内容"""
        await self.operations.update_chapter_content(file_path, content)

    # 章节列表相关方法
    async def list_chapters(self) -> List[Dict]:
        """获取章节列表 - 直接返回文件树结构"""
        try:
            file_tree_result = await file_tree_builder.get_file_tree(self.novel_dir)
            if file_tree_result["success"]:
                # 直接返回文件树结构，保持嵌套格式
                return file_tree_result["tree"]
            else:
                logger.error(f"获取文件树失败: {file_tree_result.get('error')}")
                return []
        except Exception as e:
            logger.error(f"Error listing chapters: {str(e)}")
            raise
