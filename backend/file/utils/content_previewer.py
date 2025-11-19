"""
内容预览器
用于生成文件内容的预览
"""

import os
import aiofiles
from typing import Optional


class ContentPreviewer:
    """内容预览器类"""
    
    def __init__(self):
        self.max_preview_length = 200
    
    async def get_preview(self, file_path: str) -> Optional[str]:
        """获取文件内容预览"""
        try:
            if not os.path.exists(file_path) or os.path.isdir(file_path):
                return None
                
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                
            # 截取前N个字符作为预览
            if len(content) > self.max_preview_length:
                return content[:self.max_preview_length] + "..."
            else:
                return content
                
        except Exception:
            return None