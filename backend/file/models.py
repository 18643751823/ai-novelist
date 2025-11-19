"""
文件相关数据模型
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class FileItem(BaseModel):
    """文件项数据模型"""
    id: str
    name: str
    path: str
    type: str  # "file" 或 "folder"
    content: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def dict(self, **kwargs):
        """重写dict方法，确保datetime对象正确序列化"""
        data = super().dict(**kwargs)
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        if self.updated_at:
            data['updated_at'] = self.updated_at.isoformat()
        return data