"""
AI Agent 主入口文件
从 backend 目录启动，避免导入路径问题
"""

import sys
import os
import sqlite3
from typing import Literal
import json
from langgraph.types import Command, interrupt
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langgraph.checkpoint.sqlite import SqliteSaver

# 添加 ai_agent 目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'ai_agent'))

# 导入自定义模块
from ai_agent.config import ai_settings
from ai_agent.core.tool_load import import_tools_from_directory
from ai_agent.core.graph_builder import build_graph, State
from ai_agent.core.clean_checkpoint import cleanup_conversations
from ai_agent.core.main_loop import main_loop
from ai_agent.core.system_prompt_builder import system_prompt_builder
from ai_agent.prompts import sys_prompts

# 导入所有工具
tool = import_tools_from_directory('tool')

# 初始化SQLite检查点
try:
    # 使用SqliteSaver自动管理连接，避免线程问题
    # 直接创建SqliteSaver实例，让它在内部管理连接
    memory = SqliteSaver(sqlite3.connect("ai_agent/checkpoints.db", check_same_thread=False))
except Exception as e:
    print(f"[ERROR] SQLite检查点初始化失败: {e}")
    exit(1)

# 构建图实例（使用SystemPromptBuilder构建的完整系统提示词）
import asyncio
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
current_mode = ai_settings.CURRENT_MODE
current_prompt = loop.run_until_complete(
    system_prompt_builder.build_system_prompt(mode=current_mode, include_persistent_memory=True)
)
loop.close()
graph = build_graph(tool, memory, system_prompt=current_prompt, mode=current_mode)
    
config={"configurable":{"thread_id":"1"}}

# 导入主循环
main_loop(graph, cleanup_conversations)