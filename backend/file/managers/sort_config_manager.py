"""
排序配置管理器
负责管理章节排序的持久化配置（基于JSON配置排序）
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


class SortConfigManager:
    def __init__(self):
        self.config_path = None
        self.config = {
            "version": "2.0.0",  # 版本升级，支持文件和文件夹独立排序
            "sortEnabled": True,  # 是否启用排序
            "customOrders": {}   # 自定义排序配置 { [directoryPath]: { files: [fileId1, fileId2, ...], folders: [folderId1, folderId2, ...] } }
        }

    async def initialize(self, novel_dir_path: str):
        """初始化配置管理器"""
        self.config_path = Path(novel_dir_path) / ".sort-config.json"
        await self.load_config()

    async def load_config(self):
        """加载配置"""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    loaded_config = json.load(f)

                
                print("[SortConfigManager] 排序配置已加载")
            else:
                # 配置文件不存在，使用默认配置
                print("[SortConfigManager] 排序配置文件不存在，使用默认配置")
                await self.save_config()
        except Exception as e:
            print(f"[SortConfigManager] 加载排序配置失败: {e}")

    async def save_config(self):
        """保存配置"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            print("[SortConfigManager] 排序配置已保存")
        except Exception as e:
            print(f"[SortConfigManager] 保存排序配置失败: {e}")

    def get_custom_file_order(self, directory_path: str) -> Optional[List[str]]:
        """获取目录的自定义文件排序"""
        clean_path = self.normalize_path(directory_path)
        return self.config["customOrders"].get(clean_path, {}).get("files")

    def get_custom_folder_order(self, directory_path: str) -> Optional[List[str]]:
        """获取目录的自定义文件夹排序"""
        clean_path = self.normalize_path(directory_path)
        return self.config["customOrders"].get(clean_path, {}).get("folders")

    async def set_custom_file_order(self, directory_path: str, file_ids: List[str]):
        """设置目录的自定义文件排序"""
        clean_path = self.normalize_path(directory_path)
        
        if clean_path not in self.config["customOrders"]:
            self.config["customOrders"][clean_path] = {}
        
        self.config["customOrders"][clean_path]["files"] = file_ids
        self.config["customOrders"][clean_path]["lastUpdated"] = datetime.now().isoformat()
        
        await self.save_config()

    async def set_custom_folder_order(self, directory_path: str, folder_ids: List[str]):
        """设置目录的自定义文件夹排序"""
        clean_path = self.normalize_path(directory_path)
        
        if clean_path not in self.config["customOrders"]:
            self.config["customOrders"][clean_path] = {}
        
        self.config["customOrders"][clean_path]["folders"] = folder_ids
        self.config["customOrders"][clean_path]["lastUpdated"] = datetime.now().isoformat()
        
        await self.save_config()

    async def clear_custom_file_order(self, directory_path: str):
        """清除目录的自定义文件排序"""
        clean_path = self.normalize_path(directory_path)
        if clean_path in self.config["customOrders"]:
            if "files" in self.config["customOrders"][clean_path]:
                del self.config["customOrders"][clean_path]["files"]
                # 如果该目录下没有其他排序配置，删除整个目录配置
                if not self.config["customOrders"][clean_path]:
                    del self.config["customOrders"][clean_path]
            await self.save_config()

    async def clear_custom_folder_order(self, directory_path: str):
        """清除目录的自定义文件夹排序"""
        clean_path = self.normalize_path(directory_path)
        if clean_path in self.config["customOrders"]:
            if "folders" in self.config["customOrders"][clean_path]:
                del self.config["customOrders"][clean_path]["folders"]
                # 如果该目录下没有其他排序配置，删除整个目录配置
                if not self.config["customOrders"][clean_path]:
                    del self.config["customOrders"][clean_path]
            await self.save_config()

    async def clear_all_custom_orders(self, directory_path: str):
        """清除目录的所有自定义排序"""
        clean_path = self.normalize_path(directory_path)
        if clean_path in self.config["customOrders"]:
            del self.config["customOrders"][clean_path]
            await self.save_config()

    def is_sort_enabled(self) -> bool:
        """获取排序启用状态"""
        return self.config["sortEnabled"]

    async def set_sort_enabled(self, enabled: bool):
        """设置排序启用状态"""
        self.config["sortEnabled"] = enabled
        await self.save_config()

    def apply_custom_order(self, items: List[Dict], directory_path: str) -> List[Dict]:
        """应用自定义排序到项目列表（文件和文件夹独立排序）"""
        # 检查是否启用排序
        if not self.config["sortEnabled"]:
            return items

        # 分离文件夹和文件
        folders = [item for item in items if item.get("isFolder", False)]
        files = [item for item in items if not item.get("isFolder", False)]

        # 获取自定义排序配置
        custom_folder_order = self.get_custom_folder_order(directory_path)
        custom_file_order = self.get_custom_file_order(directory_path)

        # 创建项目ID到项目的映射
        item_map = {item["id"]: item for item in items}

        # 处理文件夹排序
        if custom_folder_order:
            sorted_folders = []
            remaining_folders = set(folder["id"] for folder in folders)

            # 首先添加自定义顺序中的文件夹
            for folder_id in custom_folder_order:
                if folder_id in item_map and item_map[folder_id].get("isFolder", False):
                    sorted_folders.append(item_map[folder_id])
                    remaining_folders.discard(folder_id)

            # 然后添加剩余的文件夹（按默认排序）
            remaining_folder_array = [item_map[folder_id] for folder_id in remaining_folders if folder_id in item_map]
            default_sorted_folders = sorted(remaining_folder_array, key=lambda item: item["title"])
            final_sorted_folders = sorted_folders + default_sorted_folders
        else:
            # 没有自定义文件夹排序，使用默认排序
            final_sorted_folders = sorted(folders, key=lambda item: item["title"])

        # 处理文件排序
        if custom_file_order:
            sorted_files = []
            remaining_files = set(file["id"] for file in files)

            # 首先添加自定义顺序中的文件
            for file_id in custom_file_order:
                if file_id in item_map and not item_map[file_id].get("isFolder", False):
                    sorted_files.append(item_map[file_id])
                    remaining_files.discard(file_id)

            # 然后添加剩余的文件（按默认排序）
            remaining_file_array = [item_map[file_id] for file_id in remaining_files if file_id in item_map]
            default_sorted_files = sorted(remaining_file_array, key=lambda item: item["title"])
            final_sorted_files = sorted_files + default_sorted_files
        else:
            # 没有自定义文件排序，使用默认排序
            final_sorted_files = sorted(files, key=lambda item: item["title"])

        # 合并结果：文件夹在前，文件在后
        return final_sorted_folders + final_sorted_files

    def sort_items_default(self, items: List[Dict]) -> List[Dict]:
        """默认排序（按字母排序）"""
        if not items or not isinstance(items, list):
            return []

        print(f'[SortConfigManager] 开始默认排序，项目数量: {len(items)}')

        # 分离文件夹和文件，分别排序
        folders = [item for item in items if item.get("isFolder", False)]
        files = [item for item in items if not item.get("isFolder", False)]

        # 文件夹按标题排序
        sorted_folders = sorted(folders, key=lambda item: item["title"])
        
        # 文件按标题排序
        sorted_files = sorted(files, key=lambda item: item["title"])

        # 合并结果（文件夹在前，文件在后）
        sorted_items = sorted_folders + sorted_files

        print(f'[SortConfigManager] 排序后项目列表: {[{"title": item["title"], "isFolder": item.get("isFolder", False), "id": item["id"]} for item in sorted_items]}')
        
        return sorted_items

    def normalize_path(self, file_path: str) -> str:
        """规范化路径"""
        return file_path.replace("\\", "/").replace("./", "")

    def get_config(self) -> Dict[str, Any]:
        """获取所有配置信息（用于调试）"""
        return self.config.copy()


# 创建单例实例
sort_config_manager = SortConfigManager()