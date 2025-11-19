"""
AI聊天API模块
为前端提供AI聊天、工具调用等功能的RESTful API
专注于聊天交互和流式响应
"""

import json
import logging
import base64
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator

from .config import ai_settings
from .core.graph_builder import build_graph
from .core.tool_load import import_tools_from_directory
from .core.system_prompt_builder import system_prompt_builder
from services.websocket_manager import websocket_manager

# 导入LangChain相关类型用于类型检查
from langgraph.types import StateSnapshot, Interrupt
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
LANGCHAIN_IMPORTS_AVAILABLE = True

logger = logging.getLogger(__name__)

# 自定义JSON序列化器，用于处理LangChain消息对象
def serialize_langchain_object(obj):
    """序列化LangChain对象为JSON可序列化的格式"""
    try:
        result = {}
        
        # 处理Stream对象 - 优先处理，避免后续尝试调用model_dump()
        if hasattr(obj, '__class__') and obj.__class__.__name__ == 'Stream':
            return {
                'type': 'stream',
                'content': str(obj),
                'class_name': obj.__class__.__name__
            }
        
        # 处理StateSnapshot对象 - 这是主要的返回对象
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, StateSnapshot):
            result.update({
                'type': 'state_snapshot',
                'values': serialize_langchain_object(getattr(obj, 'values', {})),
                'next': getattr(obj, 'next', None),
                'config': getattr(obj, 'config', {}),
                'metadata': getattr(obj, 'metadata', {}),
                'created_at': getattr(obj, 'created_at', None),
                'parent_config': getattr(obj, 'parent_config', None),
                'tasks': serialize_langchain_object(getattr(obj, 'tasks', [])),
                'interrupts': serialize_langchain_object(getattr(obj, 'interrupts', [])),
            })
        
        # 处理各种消息类型
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, (SystemMessage, HumanMessage, AIMessage, ToolMessage)):
            message_data = {
                'type': obj.__class__.__name__.lower(),
                'content': getattr(obj, 'content', ''),
                'additional_kwargs': serialize_langchain_object(getattr(obj, 'additional_kwargs', {})),
                'response_metadata': serialize_langchain_object(getattr(obj, 'response_metadata', {})),
                'id': getattr(obj, 'id', '')
            }
            
            # 处理AIMessage特有的字段
            if isinstance(obj, AIMessage):
                message_data.update({
                    'tool_calls': serialize_langchain_object(getattr(obj, 'tool_calls', [])),
                    'usage_metadata': serialize_langchain_object(getattr(obj, 'usage_metadata', {})),
                    'refusal': getattr(obj, 'refusal', None)
                })
            
            # 处理ToolMessage特有的字段
            if isinstance(obj, ToolMessage):
                message_data.update({
                    'tool_call_id': getattr(obj, 'tool_call_id', '')
                })
            
            result.update(message_data)
        
        # 处理Interrupt对象
        if LANGCHAIN_IMPORTS_AVAILABLE and isinstance(obj, Interrupt):
            result.update({
                'type': 'interrupt',
                'value': getattr(obj, 'value', ''),
                'id': getattr(obj, 'id', '')
            })
        
        # 处理PregelTask对象（使用字符串检查作为备用）
        if hasattr(obj, '__class__') and obj.__class__.__name__ == 'PregelTask':
            result.update({
                'type': 'pregel_task',
                'id': getattr(obj, 'id', ''),
                'name': getattr(obj, 'name', ''),
                'path': serialize_langchain_object(getattr(obj, 'path', ())),
                'error': getattr(obj, 'error', None),
                'interrupts': serialize_langchain_object(getattr(obj, 'interrupts', ())),
                'state': getattr(obj, 'state', None),
                'result': getattr(obj, 'result', None)
            })
        
        # 如果已经处理了特定类型，直接返回结果
        if result:
            return result
        
        # 处理字典、列表、元组等基础数据结构
        if isinstance(obj, dict):
            return {k: serialize_langchain_object(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [serialize_langchain_object(item) for item in obj]
        elif isinstance(obj, tuple):
            return [serialize_langchain_object(item) for item in obj]
        elif isinstance(obj, (str, int, float, bool, type(None))):
            # 基础类型直接返回
            return obj
        else:
            # 对于其他无法序列化的对象，尝试获取其属性
            try:
                # 检查是否有model_dump方法（Pydantic模型）
                if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
                    return serialize_langchain_object(obj.model_dump())
                # 尝试获取对象的可序列化属性
                elif hasattr(obj, '__dict__'):
                    return serialize_langchain_object(obj.__dict__)
                else:
                    # 最后尝试字符串表示
                    return str(obj)
            except Exception as inner_e:
                logger.warning(f"Fallback serialization failed for {type(obj)}: {inner_e}")
                return repr(obj)
    except Exception as e:
        logger.error(f"Serialization error for object {type(obj)}: {e}")
        return {"type": "serialization_error", "error": str(e)}
router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

# 全局工具实例
tools = None

def initialize_tools(mode: str = None):
    """初始化工具
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    global tools
    try:
        tools = import_tools_from_directory('tool', mode)
        if mode:
            logger.info(f"Tools initialized for mode '{mode}': {len(tools)} tools loaded")
        else:
            logger.info(f"Tools initialized: {len(tools)} tools loaded")
    except Exception as e:
        logger.error(f"Failed to initialize tools: {e}")
        raise

def create_graph(mode: str = None):
    """创建新的图实例
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    try:
        # 根据模式加载工具
        tools = import_tools_from_directory('tool', mode)
        
        # 构建图实例，使用统一的数据库连接管理
        from langgraph.checkpoint.sqlite import SqliteSaver
        from .history_api import get_db_connection
        
        memory = SqliteSaver(get_db_connection())
        
        # 使用 SystemPromptBuilder 构建完整的系统提示词
        import asyncio
        try:
            # 尝试获取当前运行的事件循环
            loop = asyncio.get_running_loop()
            # 如果成功获取，说明已有运行中的循环，使用 nest_asyncio
            import nest_asyncio
            nest_asyncio.apply()
            current_prompt = loop.run_until_complete(
                system_prompt_builder.build_system_prompt(mode=mode, include_persistent_memory=True)
            )
        except RuntimeError:
            # 没有运行中的循环，可以安全创建新循环
            current_prompt = asyncio.run(system_prompt_builder.build_system_prompt(mode=mode, include_persistent_memory=True))
        
        graph = build_graph(tools, memory, system_prompt=current_prompt, mode=mode)
        
        logger.info(f"Graph created successfully for mode '{mode}': {len(tools)} tools bound")
        return graph
    except Exception as e:
        logger.error(f"Failed to create graph: {e}")
        raise

# 数据模型
class ChatMessageRequest(BaseModel):
    """聊天消息请求模型"""
    message: str
    thread_id: str = "default"
    mode: str = "outline"
    
    @validator('message')
    def validate_message(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('消息不能为空')
        return v

class InterruptResponseRequest(BaseModel):
    """中断响应请求模型"""
    interrupt_id: str
    choice: str  # '1'=恢复, '2'=取消
    additional_data: str = ""
    thread_id: str = "default"

# API端点
@router.post("/message", summary="发送聊天消息")
async def send_chat_message(request: ChatMessageRequest):
    """
    发送聊天消息给AI Agent
    
    - **message**: 用户消息内容
    - **thread_id**: 会话ID，用于隔离不同用户的对话
    - **mode**: 对话模式 (outline/writing/adjustment)
    """
    try:
        # 记录模式变化（仅用于日志记录）
        if request.mode != ai_settings.CURRENT_MODE:
            logger.info(f"Mode changed to: {request.mode}")
        
        # 每次请求都创建新的graph实例，确保使用最新的模型配置和工具
        graph = create_graph(request.mode)
        
        # 流式响应
        async def generate():
            try:
                config = {"configurable": {"thread_id": request.thread_id}}
                
                # 获取当前状态
                current_state = graph.get_state(config)
                current_messages = current_state.values.get("messages", [])
                
                # 添加用户消息
                from langchain_core.messages import HumanMessage
                updated_messages = current_messages + [HumanMessage(content=request.message)]
                
                # 创建输入状态
                from ai_agent.config import State
                input_state = State(messages=updated_messages)
                
                # 流式处理
                for chunk in graph.stream(input_state, config, stream_mode="updates"):
                    # 序列化chunk对象，处理LangChain消息
                    serialized_chunk = serialize_langchain_object(chunk)
                    # 使用Base64编码避免JSON解析问题
                    json_str = json.dumps(serialized_chunk, ensure_ascii=False)
                    encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    yield f"data: {encoded_data}\n\n"
                
                # 获取最终状态检查是否有工具中断
                final_state = graph.get_state(config)
                
                # 检查是否有工具中断，如果有则发送中断信息给前端
                if hasattr(final_state, 'interrupts') and final_state.interrupts:
                    logger.info(f"工具中断: {final_state}")
                    for interrupt in final_state.interrupts:
                        logger.info(f"中断信息: {interrupt.value}")
                    
                    # 发送中断信息给前端
                    interrupt_data = {
                        'type': 'interrupt',
                        'interrupts': serialize_langchain_object(final_state.interrupts),
                        'state': serialize_langchain_object(final_state)
                    }
                    # 使用Base64编码避免JSON解析问题
                    json_str = json.dumps(interrupt_data, ensure_ascii=False)
                    encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    yield f"data: {encoded_data}\n\n"
                
                # 发送完成标记
                done_data = {'type': 'done'}
                json_str = json.dumps(done_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
                
            except Exception as e:
                logger.error(f"Stream generation error: {e}")
                error_data = {'error': str(e)}
                json_str = json.dumps(error_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
            
    except Exception as e:
        logger.error(f"Chat message processing error: {e}")
        raise HTTPException(status_code=500, detail=f"处理聊天消息时出错: {str(e)}")

@router.post("/interrupt-response", summary="解除中断")
async def send_interrupt_response(request: InterruptResponseRequest):
    """
    发送中断响应给AI Agent继续处理
    
    - **interrupt_id**: 中断ID
    - **choice**: 用户选择 ('1'=恢复, '2'=取消)
    - **additional_data**: 附加信息
    - **thread_id**: 会话ID
    """
    try:
        logger.info(f"Interrupt response received: interrupt_id={request.interrupt_id}, choice={request.choice}")
        
        # 每次请求都创建新的graph实例，确保使用最新的模型配置和工具
        # 中断响应需要从当前状态获取模式信息
        from .config import ai_settings
        current_mode = ai_settings.CURRENT_MODE
        graph = create_graph(current_mode)
        
        # 构建中断响应
        from langgraph.types import Command
        human_response = Command(
            resume= {
                "choice_action": request.choice,
                "choice_data": request.additional_data
            }
        )
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 流式处理中断响应
        async def generate_interrupt_response():
            try:
                for chunk in graph.stream(human_response, config, stream_mode="updates"):
                    # 序列化chunk对象，处理LangChain消息
                    serialized_chunk = serialize_langchain_object(chunk)
                    # 使用Base64编码避免JSON解析问题
                    json_str = json.dumps(serialized_chunk, ensure_ascii=False)
                    encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    yield f"data: {encoded_data}\n\n"
                
                # 获取最终状态检查是否有再次中断
                final_state = graph.get_state(config)
                
                # 检查是否有再次中断，如果有则发送中断信息给前端
                if hasattr(final_state, 'interrupts') and final_state.interrupts:
                    logger.info(f"工具中断: {final_state}")
                    for interrupt in final_state.interrupts:
                        logger.info(f"中断信息: {interrupt.value}")
                    
                    # 发送中断信息给前端
                    interrupt_data = {
                        'type': 'interrupt',
                        'interrupts': serialize_langchain_object(final_state.interrupts),
                        'state': serialize_langchain_object(final_state)
                    }
                    # 使用Base64编码避免JSON解析问题
                    json_str = json.dumps(interrupt_data, ensure_ascii=False)
                    encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                    yield f"data: {encoded_data}\n\n"
                
                # 发送完成标记
                done_data = {'type': 'done'}
                json_str = json.dumps(done_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
                
            except Exception as e:
                logger.error(f"Interrupt response stream error: {e}")
                error_data = {'error': str(e)}
                json_str = json.dumps(error_data, ensure_ascii=False)
                encoded_data = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
                yield f"data: {encoded_data}\n\n"
        
        return StreamingResponse(
            generate_interrupt_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
        
    except Exception as e:
        logger.error(f"Interrupt response processing error: {e}")
        raise HTTPException(status_code=500, detail=f"处理中断响应时出错: {str(e)}")

# WebSocket端点
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket连接端点，用于实时通信
    """
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 处理客户端消息
            if message.get("type") == "subscribe":
                # 处理订阅事件
                event_types = message.get("event_types", [])
                logger.info(f"Client subscribed to events: {event_types}")
                
            elif message.get("type") == "unsubscribe":
                # 处理取消订阅
                event_types = message.get("event_types", [])
                logger.info(f"Client unsubscribed from events: {event_types}")
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)

# 初始化工具
initialize_tools()
