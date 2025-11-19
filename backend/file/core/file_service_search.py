"""
文件服务搜索和排序类
包含文件搜索、排序等功能
"""

import os
from typing import List, Optional, Dict, Any
import logging

from ..models import FileItem
from ..services.ripgrep_service import ripgrep_service
from ..managers.sort_config_manager import sort_config_manager
from ..utils.file_tree_builder import file_tree_builder


logger = logging.getLogger(__name__)


class FileServiceSearch:
    def __init__(self, novel_dir: str):
        self.novel_dir = novel_dir

    async def search_files(self, query: str) -> List[FileItem]:
        """搜索文件 - 使用ripgrep进行内容搜索"""
        try:
            # 使用ripgrep搜索文件内容
            search_results = await ripgrep_service.regex_search_files(
                self.novel_dir, self.novel_dir, query, "*"
            )
            
            # 解析搜索结果
            parsed_results = ripgrep_service.parse_search_results(search_results, self.novel_dir)
            
            # 转换为FileItem格式
            file_items = []
            for result in parsed_results:
                file_path = result["path"]
                full_path = os.path.join(self.novel_dir, file_path)
                
                if os.path.exists(full_path):
                    stat = os.stat(full_path)
                    file_items.append(FileItem(
                        id=file_path,
                        name=result["name"],
                        path=full_path,
                        type="file",
                        content=result["preview"],
                        created_at=stat.st_ctime,
                        updated_at=stat.st_mtime
                    ))
            
            return file_items
        except Exception as e:
            logger.error(f"Error searching files: {str(e)}")
            # 如果ripgrep失败，回退到文件名搜索
            return await self._fallback_search(query)

    async def _fallback_search(self, query: str) -> List[FileItem]:
        """回退搜索 - 仅搜索文件名"""
        try:
            results = []
            for root, dirs, files in os.walk(self.novel_dir):
                # 搜索文件名
                for item in dirs + files:
                    if query.lower() in item.lower():
                        item_path = os.path.join(root, item)
                        stat = os.stat(item_path)
                        
                        item_type = "folder" if os.path.isdir(item_path) else "file"
                        content = None
                        if item_type == "file":
                            try:
                                import aiofiles
                                async with aiofiles.open(item_path, 'r', encoding='utf-8') as f:
                                    content = await f.read()
                            except:
                                content = None
                        
                        relative_id = os.path.relpath(item_path, self.novel_dir)
                        results.append(FileItem(
                            id=relative_id,
                            name=item,
                            path=item_path,
                            type=item_type,
                            content=content,
                            created_at=stat.st_ctime,
                            updated_at=stat.st_mtime
                        ))
            
            return results
        except Exception as e:
            logger.error(f"Error in fallback search: {str(e)}")
            return []

    async def update_file_order(self, file_paths: List[str], directory_path: str = ""):
        """更新文件顺序（仅文件）"""
        try:
            logger.info(f"Updated file order for directory '{directory_path}': {file_paths}")
            
            # 确保排序配置管理器已初始化
            if not sort_config_manager.config_path:
                await sort_config_manager.initialize(self.novel_dir)
            
            # 调用排序配置管理器来保存自定义文件排序
            await sort_config_manager.set_custom_file_order(directory_path, file_paths)
            
            logger.info(f"文件排序顺序已保存到配置文件，目录: {directory_path}")
            
        except Exception as e:
            logger.error(f"Error updating file order: {str(e)}")
            raise

    async def update_folder_order(self, folder_paths: List[str], directory_path: str = ""):
        """更新文件夹顺序（仅文件夹）"""
        try:
            logger.info(f"Updated folder order for directory '{directory_path}': {folder_paths}")
            
            # 确保排序配置管理器已初始化
            if not sort_config_manager.config_path:
                await sort_config_manager.initialize(self.novel_dir)
            
            # 调用排序配置管理器来保存自定义文件夹排序
            await sort_config_manager.set_custom_folder_order(directory_path, folder_paths)
            
            logger.info(f"文件夹排序顺序已保存到配置文件，目录: {directory_path}")
            
        except Exception as e:
            logger.error(f"Error updating folder order: {str(e)}")
            raise

    async def list_novel_files(self) -> Dict[str, Any]:
        """列出novel目录下所有文件"""
        try:
            file_tree_result = await file_tree_builder.get_file_tree(self.novel_dir)
            
            if file_tree_result["success"]:
                files = await file_tree_builder.flatten_file_tree(file_tree_result["tree"])
                return {"success": True, "files": files}
            else:
                logger.error(f"获取novel文件列表失败: {file_tree_result.get('error')}")
                return {"success": False, "error": file_tree_result.get('error')}
        except Exception as error:
            logger.error(f"列出novel文件时发生异常: {error}")
            return {"success": False, "error": str(error)}

    async def search_novel_files(self, search_query: str) -> Dict[str, Any]:
        """搜索novel文件夹中的文件内容"""
        try:
            logger.info(f"搜索novel目录: {self.novel_dir}, 查询: {search_query}")
            
            # 使用ripgrep搜索文件内容
            search_results = await ripgrep_service.regex_search_files(
                self.novel_dir, self.novel_dir, search_query, "*"
            )
            
            # 解析搜索结果
            results = ripgrep_service.parse_search_results(search_results, self.novel_dir)
            return {"success": True, "results": results}
        except Exception as error:
            logger.error(f"搜索novel文件时发生异常: {error}")
            return {"success": False, "error": str(error)}