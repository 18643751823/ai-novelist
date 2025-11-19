"""
文件路径验证器
负责验证文件路径的安全性和有效性
"""

import os
from pathlib import Path
from typing import List


class PathValidator:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
            
    def normalize_path(self, path: str) -> str:
        """规范化路径"""
        if path.startswith('./'):
            path = path[2:]
        return path.replace('\\', '/')
            
    def get_full_path(self, relative_path: str) -> Path:
        """获取完整路径"""
        clean_path = self.normalize_path(relative_path)
        return self.base_dir / clean_path
        
    def validate_file_extension(self, filename: str, allowed_extensions: List[str]) -> bool:
        """验证文件扩展名"""
        if not allowed_extensions:
            return True
            
        file_ext = Path(filename).suffix.lower()
        return file_ext in [ext.lower() for ext in allowed_extensions]
        
    def validate_file_size(self, file_path: str, max_size: int) -> bool:
        """验证文件大小"""
        try:
            file_size = os.path.getsize(file_path)
            return file_size <= max_size
        except Exception:
            return False
            
    def is_safe_path(self, relative_path: str) -> bool:
        """验证路径安全性，防止路径遍历攻击"""
        try:
            # 规范化路径
            clean_path = self.normalize_path(relative_path)
            
            # 检查是否包含危险字符或路径遍历
            dangerous_patterns = ['..', '~', '//', '\\']
            for pattern in dangerous_patterns:
                if pattern in clean_path:
                    return False
                    
            # 检查是否在基础目录内
            full_path = self.get_full_path(clean_path)
            return full_path.is_relative_to(self.base_dir)
            
        except Exception:
            return False