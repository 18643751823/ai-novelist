"""
文件事件管理器
负责管理文件操作的事件通知
"""

from typing import Dict, Any, Callable, List
import asyncio


class FileEventManager:
    def __init__(self):
        self.event_handlers: Dict[str, List[Callable]] = {}
        
    def register_handler(self, event_type: str, handler: Callable):
        """注册事件处理器"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
        
    async def emit_event(self, event_type: str, data: Dict[str, Any]):
        """触发事件"""
        if event_type not in self.event_handlers:
            return
            
        for handler in self.event_handlers[event_type]:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as e:
                print(f"事件处理器错误 {event_type}: {e}")
                
    async def emit_file_created(self, file_path: str, file_data: Dict[str, Any]):
        """触发文件创建事件"""
        await self.emit_event("file_created", {
            "file_path": file_path,
            "file_data": file_data
        })
        
    async def emit_file_updated(self, file_path: str, old_content: str, new_content: str):
        """触发文件更新事件"""
        await self.emit_event("file_updated", {
            "file_path": file_path,
            "old_content": old_content,
            "new_content": new_content
        })
        
    async def emit_file_deleted(self, file_path: str):
        """触发文件删除事件"""
        await self.emit_event("file_deleted", {
            "file_path": file_path
        })
        
    async def emit_file_renamed(self, old_path: str, new_path: str):
        """触发文件重命名事件"""
        await self.emit_event("file_renamed", {
            "old_path": old_path,
            "new_path": new_path
        })
        
    async def emit_file_moved(self, source_path: str, target_path: str):
        """触发文件移动事件"""
        await self.emit_event("file_moved", {
            "source_path": source_path,
            "target_path": target_path
        })


# 创建全局事件管理器实例
file_event_manager = FileEventManager()