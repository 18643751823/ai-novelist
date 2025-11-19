"""
WebSocket 管理器
负责管理所有WebSocket连接和事件推送
"""
import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_data: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket):
        """接受WebSocket连接"""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_data[websocket] = {
            "connected_at": None,
            "client_info": {}
        }
        logger.info(f"WebSocket连接已建立，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """断开WebSocket连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            if websocket in self.connection_data:
                del self.connection_data[websocket]
            logger.info(f"WebSocket连接已断开，当前连接数: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """向特定WebSocket连接发送消息"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict):
        """向所有连接的WebSocket客户端广播消息"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"广播消息失败: {e}")
                disconnected.append(connection)
        
        # 清理断开的连接
        for connection in disconnected:
            self.disconnect(connection)

    async def send_event(self, event_type: str, payload: dict):
        """发送事件到所有连接的客户端"""
        event_message = {
            "type": event_type,
            "payload": payload,
            "timestamp": None  # 将在发送时填充
        }
        await self.broadcast(event_message)

    async def send_ai_response(self, response_type: str, payload: dict):
        """发送AI响应事件（兼容ai-response通道）"""
        import time
        event_message = {
            "type": "ai-response",
            "payload": {
                "type": response_type,
                "payload": payload,
                "sendTimestamp": int(time.time() * 1000)  # 与原Node.js后端保持一致的时间戳格式
            }
        }
        await self.broadcast(event_message)

    async def send_diff_preview(self, file_path: str, suggested_content: str, original_content: str = None):
        """发送差异预览事件（兼容show-diff-preview通道）"""
        event_message = {
            "type": "show-diff-preview",
            "payload": {
                "filePath": file_path,
                "suggestedContent": suggested_content,
                "originalContent": original_content
            }
        }
        await self.broadcast(event_message)

    async def send_tool_call_event(self, event_type: str, payload: dict):
        """发送工具调用事件（兼容tool-call-events通道）"""
        import time
        event_message = {
            "type": "tool-call-events",
            "payload": {
                "type": event_type,
                "payload": payload,
                "sendTimestamp": int(time.time() * 1000)  # 与原Node.js后端保持一致的时间戳格式
            }
        }
        await self.broadcast(event_message)

# 全局WebSocket管理器实例
websocket_manager = WebSocketManager()
