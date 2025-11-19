"""
文件树构建器
负责构建层次化文件树结构，支持自定义排序
"""

import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..managers.sort_config_manager import sort_config_manager


# 检查排序配置管理器是否已初始化
is_sort_config_initialized = False


def add_display_prefixes(items: List[Dict]) -> List[Dict]:
    """为项目添加显示前缀（文件和文件夹独立编号）"""
    if not items or not isinstance(items, list):
        return items

    # 分离文件夹和文件
    folders = [item for item in items if item.get("isFolder", False)]
    files = [item for item in items if not item.get("isFolder", False)]

    # 为文件夹添加数字前缀（从1开始）
    folders_with_prefix = []
    for index, folder in enumerate(folders):
        folders_with_prefix.append({
            **folder,
            "displayPrefix": str(index + 1)
        })

    # 为文件添加数字前缀（从1开始，独立于文件夹）
    files_with_prefix = []
    for index, file in enumerate(files):
        files_with_prefix.append({
            **file,
            "displayPrefix": str(index + 1)
        })

    # 合并结果（文件夹在前，文件在后）
    return folders_with_prefix + files_with_prefix


def sort_items(items: List[Dict], directory_path: str = "") -> List[Dict]:
    """对项目列表进行排序（支持自定义排序）"""
    if not items or not isinstance(items, list):
        print(f"[file-tree-builder] sortItems: 传入空数组或无效数据，返回空数组")
        return []

    print(f"[file-tree-builder] sortItems: 开始排序目录 {directory_path}，项目数量: {len(items)}")
    print(f"[file-tree-builder] sortItems: 原始项目: {[{'title': item['title'], 'isFolder': item.get('isFolder', False)} for item in items]}")

    # 首先应用自定义排序
    custom_sorted = sort_config_manager.apply_custom_order(items, directory_path)
    
    print(f"[file-tree-builder] sortItems: 自定义排序结果 === 原始项目: {custom_sorted is items}")
    print(f"[file-tree-builder] sortItems: 排序是否启用: {sort_config_manager.is_sort_enabled()}")
    
    # 如果没有自定义排序或排序被禁用，使用默认排序
    if custom_sorted is items or not sort_config_manager.is_sort_enabled():
        print(f"[file-tree-builder] sortItems: 使用默认排序")
        default_sorted = sort_config_manager.sort_items_default(custom_sorted)  # 使用 customSorted 而不是 items
        result = add_display_prefixes(default_sorted)
        print(f"[file-tree-builder] sortItems: 默认排序完成，结果数量: {len(result)}")
        return result
    
    # 为自定义排序后的项目添加显示前缀
    print(f"[file-tree-builder] sortItems: 使用自定义排序")
    result = add_display_prefixes(custom_sorted)
    print(f"[file-tree-builder] sortItems: 自定义排序完成，结果数量: {len(result)}")
    return result


async def read_directory_recursive(dir_path: str, base_dir_path: str) -> List[Dict]:
    """递归读取目录结构"""
    print(f"[file-tree-builder] readDirectoryRecursive: 正在读取目录: {dir_path}")
    
    try:
        entries = os.listdir(dir_path)
    except Exception as e:
        print(f"[file-tree-builder] 读取目录失败 {dir_path}: {e}")
        return []

    print(f"[file-tree-builder] readDirectoryRecursive: 目录 {dir_path} 读取到的条目: {entries}")
    result = []

    for entry_name in entries:
        # 忽略隐藏文件和文件夹
        if entry_name.startswith('.') or entry_name.startswith('$'):
            print(f"[file-tree-builder] readDirectoryRecursive: 忽略条目: {entry_name}")
            continue

        full_path = os.path.join(dir_path, entry_name)
        relative_path = os.path.relpath(full_path, base_dir_path)

        if os.path.isdir(full_path):
            children = await read_directory_recursive(full_path, base_dir_path)
            result.append({
                "id": relative_path.replace("\\", "/"),  # 统一路径分隔符
                "title": entry_name,
                "isFolder": True,
                "children": sort_items(children, relative_path)  # 对子项进行排序
            })
        else:
            result.append({
                "id": relative_path.replace("\\", "/"),  # 统一路径分隔符
                "title": entry_name,
                "isFolder": False
            })

    # 对当前层级的项目进行排序
    current_dir_path = "" if dir_path == base_dir_path else os.path.relpath(dir_path, base_dir_path).replace("\\", "/")
    print(f"[file-tree-builder] readDirectoryRecursive: 准备排序目录 {current_dir_path}，项目数量: {len(result)}")
    sorted_result = sort_items(result, current_dir_path)
    print(f"[file-tree-builder] readDirectoryRecursive: 排序完成，返回项目数量: {len(sorted_result)}")
    return sorted_result


async def get_file_tree(absolute_path_to_dir: str) -> Dict[str, Any]:
    """获取指定目录的文件树"""
    try:
        print(f"[file-tree-builder] getFileTree: 开始构建文件树，路径: {absolute_path_to_dir}")
        
        global is_sort_config_initialized
        # 确保排序配置管理器已初始化
        if not is_sort_config_initialized:
            print(f"[file-tree-builder] getFileTree: 初始化排序配置管理器")
            await sort_config_manager.initialize(absolute_path_to_dir)
            is_sort_config_initialized = True
        
        # 确保目录存在
        os.makedirs(absolute_path_to_dir, exist_ok=True)
        
        tree = await read_directory_recursive(absolute_path_to_dir, absolute_path_to_dir)
        print(f"[file-tree-builder] getFileTree: 文件树构建完成，根节点数量: {len(tree)}")
        return {"success": True, "tree": tree}
    except Exception as error:
        print(f"[file-tree-builder] 获取文件树失败: {error}")
        return {"success": False, "error": str(error)}


async def flatten_file_tree(nodes: List[Dict]) -> List[str]:
    """将文件树扁平化为文件路径数组"""
    file_paths = []
    for node in nodes:
        if not node.get("isFolder", False):  # 如果不是文件夹，那就是文件
            file_paths.append(node["id"])  # 使用 node["id"] 来获取文件路径
        elif node.get("isFolder", False) and node.get("children"):  # 如果是文件夹且有子节点
            file_paths.extend(await flatten_file_tree(node["children"]))
    return file_paths


class FileTreeBuilder:
    """文件树构建器类（为了向后兼容）"""
    
    async def get_file_tree(self, absolute_path_to_dir: str) -> Dict[str, Any]:
        """获取指定目录的文件树"""
        return await get_file_tree(absolute_path_to_dir)
    
    async def flatten_file_tree(self, nodes: List[Dict]) -> List[str]:
        """将文件树扁平化为文件路径数组"""
        return await flatten_file_tree(nodes)


# 创建单例实例
file_tree_builder = FileTreeBuilder()