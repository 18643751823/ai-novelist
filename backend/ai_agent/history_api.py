"""
历史管理API模块
为前端提供历史记录管理的RESTful API
包括存档点管理、历史消息管理等功能
"""

import json
import logging
import sqlite3
import os
import msgpack
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator

from .config import ai_settings
from .core.graph_builder import build_graph
from .core.tool_load import import_tools_from_directory
from .core.system_prompt_builder import system_prompt_builder
from .chat_api import serialize_langchain_object
import time

logger = logging.getLogger(__name__)

# 创建API路由器
router = APIRouter(prefix="/api/history", tags=["History Management"])

# 全局数据库连接和内存存储，避免重复创建连接
_db_connection = None
_memory_storage = {}
_is_shutting_down = False

def get_db_connection():
    """获取全局数据库连接，避免多连接导致的锁定问题"""
    global _db_connection, _is_shutting_down
    
    if _is_shutting_down:
        raise RuntimeError("系统正在关闭，无法获取数据库连接")
    
    if _db_connection is None:
        # 确保数据库目录存在
        db_path = "checkpoints.db"
        _db_connection = sqlite3.connect(db_path, check_same_thread=False)
        # 设置更长的超时时间，默认5秒可能不够
        _db_connection.execute("PRAGMA busy_timeout = 30000")  # 30秒超时
        # 启用WAL模式，提高并发性能
        _db_connection.execute("PRAGMA journal_mode=WAL")
        # 设置同步模式为NORMAL，在性能和安全性之间取得平衡
        _db_connection.execute("PRAGMA synchronous = NORMAL")
        logger.info(f"数据库连接已建立: {db_path}")
    
    # 检查连接是否已关闭
    try:
        _db_connection.execute("SELECT 1")
    except sqlite3.ProgrammingError as e:
        if "Cannot operate on a closed database" in str(e):
            logger.warning("数据库连接已关闭，重新创建连接")
            db_path = "checkpoints.db"
            _db_connection = sqlite3.connect(db_path, check_same_thread=False)
            _db_connection.execute("PRAGMA busy_timeout = 30000")  # 30秒超时
            _db_connection.execute("PRAGMA journal_mode=WAL")
            _db_connection.execute("PRAGMA synchronous = NORMAL")
        else:
            raise
    return _db_connection

def close_db_connection():
    """安全关闭数据库连接"""
    global _db_connection, _is_shutting_down, _memory_storage
    
    _is_shutting_down = True
    
    if _db_connection:
        try:
            # 清理内存存储
            _memory_storage.clear()
            
            # 执行检查点操作，确保WAL文件中的数据写入主数据库
            _db_connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            
            # 关闭连接
            _db_connection.close()
            _db_connection = None
            logger.info("数据库连接已安全关闭")
        except Exception as e:
            logger.error(f"关闭数据库连接时发生错误: {e}")

def get_memory_storage(mode: str = None):
    """获取或创建内存存储，避免重复创建"""
    from langgraph.checkpoint.sqlite import SqliteSaver
    
    if mode not in _memory_storage:
        conn = get_db_connection()
        try:
            _memory_storage[mode] = SqliteSaver(conn)
            logger.info(f"内存存储已创建，模式: {mode}")
        except Exception as e:
            logger.error(f"创建内存存储失败: {e}")
            # 如果创建失败，尝试重置连接并重试
            global _db_connection
            _db_connection = None
            conn = get_db_connection()
            _memory_storage[mode] = SqliteSaver(conn)
    
    return _memory_storage[mode]

def create_graph(mode: str = None):
    """创建新的图实例
    
    Args:
        mode: 模式名称，如果提供则只加载该模式启用的工具
    """
    try:
        # 根据模式加载工具
        tools = import_tools_from_directory('tool', mode)
        
        # 构建图实例
        # 使用全局内存存储，避免重复创建连接
        memory = get_memory_storage(mode)
        
        # 使用 SystemPromptBuilder 构建完整的系统提示词
        # 使用 nest_asyncio 来允许在已有事件循环中运行异步代码
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
class CheckpointListRequest(BaseModel):
    """存档点列表请求模型"""
    thread_id: str = "default"
    mode: str = "outline"

class CheckpointInfo(BaseModel):
    """存档点信息模型"""
    checkpoint_id: str
    index: int
    next_node: str
    last_message_type: str
    last_message_content: str
    tool_calls: Optional[List[str]] = None

class CheckpointListResponse(BaseModel):
    """存档点列表响应模型"""
    success: bool
    message: str
    data: List[CheckpointInfo]

class CheckpointOperationRequest(BaseModel):
    """存档点操作请求模型"""
    thread_id: str = "default"
    checkpoint_index: int
    new_message: str
    mode: str = "outline"

class CheckpointOperationResponse(BaseModel):
    """存档点操作响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class MessageListRequest(BaseModel):
    """历史消息列表请求模型"""
    thread_id: str = "default"
    mode: str = "outline"

class MessageInfo(BaseModel):
    """消息信息模型"""
    index: int
    message_id: str
    message_type: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

class MessageListResponse(BaseModel):
    """历史消息列表响应模型"""
    success: bool
    message: str
    data: List[MessageInfo]

class MessageOperationRequest(BaseModel):
    """历史消息操作请求模型"""
    thread_id: str = "default"
    operation_type: str  # 'delete_all', 'delete_index', 'delete_ids'
    target_indices: Optional[List[int]] = None
    target_ids: Optional[List[str]] = None
    mode: str = "outline"

class MessageOperationResponse(BaseModel):
    """历史消息操作响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


# 会话管理相关数据模型
class SessionInfo(BaseModel):
    """会话信息模型"""
    session_id: str
    message_count: int
    created_at: Optional[str] = None
    last_accessed: Optional[str] = None
    preview: Optional[str] = None
    is_current: bool = False

class SessionListResponse(BaseModel):
    """会话列表响应模型"""
    success: bool
    message: str
    sessions: List[SessionInfo]

class SessionOperationResponse(BaseModel):
    """会话操作响应模型"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# API端点

@router.post("/checkpoints", response_model=CheckpointListResponse, summary="获取存档点列表")
async def get_checkpoints(request: CheckpointListRequest):
    """
    获取指定会话的所有存档点列表
    
    - **thread_id**: 会话ID
    - **mode**: 对话模式 (outline/writing/adjustment)
    """
    try:
        # 创建图实例
        graph = create_graph(request.mode)
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 获取存档点历史
        states = list(graph.get_state_history(config))
        
        checkpoints = []
        for index, state in enumerate(states):
            # 获取检查点ID
            checkpoint_id = state.config.get('configurable', {}).get('checkpoint_id', 'unknown')
            
            # 获取最后一条消息内容
            messages = state.values.get("messages", [])
            last_message_type = "unknown"
            last_message_content = ""
            tool_calls = None
            
            if messages:
                last_message = messages[-1]
                last_message_type = last_message.type if hasattr(last_message, 'type') else 'unknown'
                last_message_content = last_message.content if hasattr(last_message, 'content') else str(last_message)
                
                # 如果是工具调用，显示工具信息
                if last_message_type == 'ai' and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                    tool_names = [tc.get('name', 'unknown') for tc in last_message.tool_calls]
                    tool_calls = tool_names
                    last_message_content = f"工具调用: {', '.join(tool_names)}"
            
            checkpoint_info = CheckpointInfo(
                checkpoint_id=checkpoint_id,
                index=index,
                next_node=state.next,
                last_message_type=last_message_type,
                last_message_content=last_message_content,
                tool_calls=tool_calls
            )
            checkpoints.append(checkpoint_info)
        
        return CheckpointListResponse(
            success=True,
            message=f"成功获取 {len(checkpoints)} 个存档点",
            data=checkpoints
        )
        
    except Exception as e:
        logger.error(f"获取存档点列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取存档点列表失败: {str(e)}")

@router.post("/checkpoint/rollback", response_model=CheckpointOperationResponse, summary="回档到指定存档点")
async def rollback_to_checkpoint(request: CheckpointOperationRequest):
    """
    回档到指定存档点并继续对话
    
    - **thread_id**: 会话ID
    - **checkpoint_index**: 存档点索引
    - **new_message**: 新的用户消息内容
    - **mode**: 对话模式
    """
    try:
        # 创建图实例
        graph = create_graph(request.mode)
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 获取存档点历史
        states = list(graph.get_state_history(config))
        
        if request.checkpoint_index < 0 or request.checkpoint_index >= len(states):
            raise HTTPException(status_code=400, detail="存档点索引无效")
        
        # 获取选中的存档点
        selected_state = states[request.checkpoint_index]
        
        # 更新状态：获取整个消息列表，去掉最后一条用户信息，添加新的用户消息
        current_messages = selected_state.values.get("messages", [])
        
        from langchain_core.messages import HumanMessage
        
        # 如果消息列表为空，直接添加新消息
        if not current_messages:
            new_messages = [HumanMessage(content=request.new_message)]
        else:
            # 检查最后一条消息是否是用户消息
            last_message = current_messages[-1]
            if hasattr(last_message, 'type') and last_message.type == 'human':
                # 如果最后一条是用户消息，替换它
                new_messages = current_messages[:-1] + [HumanMessage(content=request.new_message)]
            else:
                # 如果最后一条不是用户消息，直接添加新消息
                new_messages = current_messages + [HumanMessage(content=request.new_message)]
        
        # 用整个新状态替换原本的旧状态
        new_config = graph.update_state(selected_state.config, values={"messages": new_messages})
        
        # 触发回复
        from ai_agent.config import State
        input_state = State(messages=new_messages)
        
        # 执行对话
        result = graph.invoke(input_state, new_config)
        
        return CheckpointOperationResponse(
            success=True,
            message="回档成功",
            data={
                "new_config": new_config,
                "result": serialize_langchain_object(result)
            }
        )
        
    except Exception as e:
        logger.error(f"回档操作失败: {e}")
        raise HTTPException(status_code=500, detail=f"回档操作失败: {str(e)}")

@router.post("/messages", response_model=MessageListResponse, summary="获取历史消息列表")
async def get_messages(request: MessageListRequest):
    """
    获取指定会话的所有历史消息列表
    
    - **thread_id**: 会话ID
    - **mode**: 对话模式
    """
    try:
        # 创建图实例
        graph = create_graph(request.mode)
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 获取当前状态
        current_state = graph.get_state(config)
        current_messages = current_state.values.get("messages", [])
        
        messages = []
        for index, msg in enumerate(current_messages):
            message_info = MessageInfo(
                index=index,
                message_id=getattr(msg, 'id', f"msg_{index}") or f"msg_{index}",
                message_type=msg.type if hasattr(msg, 'type') else 'unknown',
                content=msg.content if hasattr(msg, 'content') else str(msg),
                tool_calls=getattr(msg, 'tool_calls', None)
            )
            messages.append(message_info)
        
        return MessageListResponse(
            success=True,
            message=f"成功获取 {len(messages)} 条历史消息",
            data=messages
        )
        
    except Exception as e:
        logger.error(f"获取历史消息列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取历史消息列表失败: {str(e)}")

@router.post("/messages/operation", response_model=MessageOperationResponse, summary="操作历史消息")
async def operate_messages(request: MessageOperationRequest):
    """
    对历史消息进行操作（删除等）
    
    - **thread_id**: 会话ID
    - **operation_type**: 操作类型 ('delete_all', 'delete_index', 'delete_ids')
    - **target_indices**: 目标索引列表（用于delete_index操作）
    - **target_ids**: 目标ID列表（用于delete_ids操作）
    - **mode**: 对话模式
    """
    try:
        # 创建图实例
        graph = create_graph(request.mode)
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 获取当前状态
        current_state = graph.get_state(config)
        current_messages = current_state.values.get("messages", [])
        
        from langchain_core.messages import HumanMessage
        
        if request.operation_type == 'delete_all':
            # 删除所有消息
            delete_instruction = HumanMessage(content="/delete all")
            updated_messages = current_messages + [delete_instruction]
            
            # 调用图，条件边会自动路由到自定义删除节点
            result = graph.invoke(
                {"messages": updated_messages},
                config
            )
            
            return MessageOperationResponse(
                success=True,
                message="已删除所有消息",
                data={"result": serialize_langchain_object(result)}
            )
            
        elif request.operation_type == 'delete_index' and request.target_indices:
            # 删除指定索引的消息
            for index in request.target_indices:
                if 0 <= index < len(current_messages):
                    # 使用自定义删除指令删除特定索引的消息
                    delete_instruction = HumanMessage(content=f"/delete index {index}")
                    updated_messages = current_messages + [delete_instruction]
                    
                    # 调用图，条件边会自动路由到自定义删除节点
                    result = graph.invoke(
                        {"messages": updated_messages},
                        config
                    )
                    current_messages = result["messages"]
                else:
                    logger.warning(f"无效的消息索引: {index}")
            
            return MessageOperationResponse(
                success=True,
                message=f"已删除 {len(request.target_indices)} 条消息",
                data={"result": serialize_langchain_object(result)}
            )
            
        elif request.operation_type == 'delete_ids' and request.target_ids:
            # 删除指定ID的消息
            deleted_count = 0
            for msg_id in request.target_ids:
                # 查找消息索引
                for index, msg in enumerate(current_messages):
                    if getattr(msg, 'id', None) == msg_id:
                        # 使用自定义删除指令删除特定索引的消息
                        delete_instruction = HumanMessage(content=f"/delete index {index}")
                        updated_messages = current_messages + [delete_instruction]
                        
                        # 调用图，条件边会自动路由到自定义删除节点
                        result = graph.invoke(
                            {"messages": updated_messages},
                            config
                        )
                        current_messages = result["messages"]
                        deleted_count += 1
                        break
            
            return MessageOperationResponse(
                success=True,
                message=f"已删除 {deleted_count} 条消息",
                data={"result": serialize_langchain_object(result)}
            )
        
        else:
            raise HTTPException(status_code=400, detail="无效的操作类型或参数")
        
    except Exception as e:
        logger.error(f"消息操作失败: {e}")
        raise HTTPException(status_code=500, detail=f"消息操作失败: {str(e)}")

# 会话管理API端点
@router.get("/sessions", response_model=SessionListResponse, summary="获取所有会话列表")
async def get_all_sessions():
    """
    获取所有会话的列表
    
    返回所有用户的会话信息，包括会话ID、消息数量等
    """
    try:
        db_path = "checkpoints.db"
        
        if not os.path.exists(db_path):
            return SessionListResponse(
                success=True,
                message="数据库文件不存在",
                sessions=[]
            )
        
        # 使用全局连接，避免锁定问题
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 获取所有用户ID（会话ID）
        cursor.execute('SELECT DISTINCT thread_id FROM checkpoints')
        user_ids = [row[0] for row in cursor.fetchall()]
        
        sessions = []
        for user_id in user_ids:
            # 获取该会话的检查点数量（消息数量）
            cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (user_id,))
            message_count = cursor.fetchone()[0]
            
            # 获取创建时间和最后访问时间
            # 由于数据库中没有created列，我们从checkpoint字段中提取时间戳
            cursor.execute('''
                SELECT checkpoint, checkpoint_id
                FROM checkpoints
                WHERE thread_id = ?
                ORDER BY checkpoint_id ASC
                LIMIT 1
            ''', (user_id,))
            first_checkpoint = cursor.fetchone()
            created_at = None
            
            cursor.execute('''
                SELECT checkpoint, checkpoint_id
                FROM checkpoints
                WHERE thread_id = ?
                ORDER BY checkpoint_id DESC
                LIMIT 1
            ''', (user_id,))
            last_checkpoint = cursor.fetchone()
            last_accessed = None
            
            # 尝试从checkpoint数据中提取时间戳
            if first_checkpoint and first_checkpoint[0]:
                try:
                    import msgpack
                    checkpoint_data = msgpack.unpackb(first_checkpoint[0])
                    created_at = checkpoint_data.get('ts', None)
                except:
                    created_at = None
            
            if last_checkpoint and last_checkpoint[0]:
                try:
                    import msgpack
                    checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                    last_accessed = checkpoint_data.get('ts', None)
                except:
                    last_accessed = None
            
            # 获取最后一条消息作为预览
            cursor.execute('''
                SELECT checkpoint
                FROM checkpoints
                WHERE thread_id = ?
                ORDER BY checkpoint_id DESC
                LIMIT 1
            ''', (user_id,))
            last_checkpoint = cursor.fetchone()
            preview = ""
            
            if last_checkpoint and last_checkpoint[0]:
                try:
                    checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                    channel_values = checkpoint_data.get('channel_values', {})
                    messages = channel_values.get('__start__', {}).get('messages', [])
                    
                    if messages:
                        # 获取最后一条消息
                        last_message_data = messages[-1]
                        # 消息数据是msgpack格式，需要解析
                        if isinstance(last_message_data, dict):
                            content = last_message_data.get('content', '')
                            if content:
                                preview = content
                                # 截断预览文本
                                if len(preview) > 100:
                                    preview = preview[:100] + "..."
                        else:
                            preview = "消息格式无法解析"
                    else:
                        preview = "无消息内容"
                except Exception as e:
                    logger.warning(f"解析消息预览失败: {e}")
                    preview = "无法解析消息预览"
            
            session_info = SessionInfo(
                session_id=user_id,
                message_count=message_count,
                created_at=created_at,
                last_accessed=last_accessed,
                preview=preview,
                is_current=False  # 暂时不实现当前会话检测
            )
            sessions.append(session_info)
        
        # 不关闭全局连接，保持连接开放
        # conn.close()
        
        return SessionListResponse(
            success=True,
            message=f"成功获取 {len(sessions)} 个会话",
            sessions=sessions
        )
        
    except Exception as e:
        logger.error(f"获取会话列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取会话列表失败: {str(e)}")

@router.get("/sessions/{session_id}", response_model=SessionOperationResponse, summary="获取指定会话详情")
async def get_session(session_id: str):
    """
    获取指定会话的详细信息

    - **session_id**: 会话ID
    """
    try:
        db_path = "checkpoints.db"
        
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="数据库文件不存在")

        # 使用全局连接，避免锁定问题
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 检查会话是否存在
        cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
        session_count = cursor.fetchone()[0]
        
        if session_count == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="会话不存在")

        # 获取会话的基本信息
        cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
        message_count = cursor.fetchone()[0]
        
        # 获取创建时间和最后访问时间
        cursor.execute('''
            SELECT checkpoint, checkpoint_id
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id ASC
            LIMIT 1
        ''', (session_id,))
        first_checkpoint = cursor.fetchone()
        created_at = None
        
        cursor.execute('''
            SELECT checkpoint, checkpoint_id
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id DESC
            LIMIT 1
        ''', (session_id,))
        last_checkpoint = cursor.fetchone()
        last_accessed = None
        
        # 尝试从checkpoint数据中提取时间戳
        if first_checkpoint and first_checkpoint[0]:
            try:
                import msgpack
                checkpoint_data = msgpack.unpackb(first_checkpoint[0])
                created_at = checkpoint_data.get('ts', None)
            except:
                created_at = None
        
        if last_checkpoint and last_checkpoint[0]:
            try:
                import msgpack
                checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                last_accessed = checkpoint_data.get('ts', None)
            except:
                last_accessed = None
        
        # 获取最后一条消息作为预览
        cursor.execute('''
            SELECT checkpoint
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY checkpoint_id DESC
            LIMIT 1
        ''', (session_id,))
        last_checkpoint = cursor.fetchone()
        preview = ""
        
        if last_checkpoint and last_checkpoint[0]:
            try:
                checkpoint_data = msgpack.unpackb(last_checkpoint[0])
                channel_values = checkpoint_data.get('channel_values', {})
                messages = channel_values.get('__start__', {}).get('messages', [])
                
                if messages:
                    # 获取最后一条消息
                    last_message_data = messages[-1]
                    # 消息数据是msgpack格式，需要解析
                    if isinstance(last_message_data, dict):
                        content = last_message_data.get('content', '')
                        if content:
                            preview = content
                            # 截断预览文本
                            if len(preview) > 100:
                                preview = preview[:100] + "..."
                    else:
                        preview = "消息格式无法解析"
                else:
                    preview = "无消息内容"
            except Exception as e:
                logger.warning(f"解析消息预览失败: {e}")
                preview = "无法解析消息预览"
        
        # 不关闭全局连接，保持连接开放
        # conn.close()
        
        return SessionOperationResponse(
            success=True,
            message=f"成功获取会话 {session_id} 的详情",
            data={
                "session_data": {
                    "session_id": session_id,
                    "message_count": message_count,
                    "created_at": created_at,
                    "last_accessed": last_accessed,
                    "preview": preview,
                    "is_current": False  # 暂时不实现当前会话检测
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取会话详情失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取会话详情失败: {str(e)}")

@router.delete("/sessions/{session_id}", response_model=SessionOperationResponse, summary="删除指定会话")
async def delete_session(session_id: str):
    """
    删除指定会话的所有数据

    - **session_id**: 会话ID
    """
    try:
        db_path = "checkpoints.db"
        
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="数据库文件不存在")

        # 使用全局连接，避免锁定问题
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 检查会话是否存在
        cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (session_id,))
        session_count = cursor.fetchone()[0]
        
        if session_count == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="会话不存在")

        # 删除会话数据，添加重试机制
        max_retries = 3
        retry_delay = 0.5  # 秒
        
        for attempt in range(max_retries):
            try:
                cursor.execute('DELETE FROM checkpoints WHERE thread_id = ?', (session_id,))
                checkpoints_deleted = cursor.rowcount
                cursor.execute('DELETE FROM writes WHERE thread_id = ?', (session_id,))
                writes_deleted = cursor.rowcount
                
                conn.commit()
                break  # 成功则退出重试循环
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e).lower() and attempt < max_retries - 1:
                    logger.warning(f"数据库锁定，第 {attempt + 1} 次重试...")
                    time.sleep(retry_delay * (2 ** attempt))  # 指数退避
                    continue
                else:
                    raise  # 重试次数用完或不是锁定错误，重新抛出异常
        
        # 不关闭全局连接，保持连接开放
        # conn.close()
        
        return SessionOperationResponse(
            success=True,
            message=f"已删除会话 {session_id}",
            data={
                "checkpoints_deleted": checkpoints_deleted,
                "writes_deleted": writes_deleted
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除会话失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除会话失败: {str(e)}")