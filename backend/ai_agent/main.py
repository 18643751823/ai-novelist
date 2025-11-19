from typing import Literal
import json
import os
import sqlite3
import asyncio
from langgraph.types import Command, interrupt
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langgraph.checkpoint.sqlite import SqliteSaver

# 导入自定义模块
from config import ai_settings
from core.tool_load import import_tools_from_directory
from core.graph_builder import build_graph, State
from core.clean_checkpoint import cleanup_conversations
from core.main_loop import main_loop
from core.system_prompt_builder import system_prompt_builder
from prompts import sys_prompts

# 导入所有工具（按当前模式过滤）
current_mode = ai_settings.CURRENT_MODE
print(f"[INFO] 当前模式: {current_mode}")
tool = import_tools_from_directory('tool', mode=current_mode)

# 初始化SQLite检查点
try:
    # 使用SqliteSaver自动管理连接，避免线程问题
    # 直接创建SqliteSaver实例，让它在内部管理连接
    memory = SqliteSaver(sqlite3.connect("checkpoints.db", check_same_thread=False))
except Exception as e:
    print(f"[ERROR] SQLite检查点初始化失败: {e}")
    exit(1)

# 构建图实例（使用SystemPromptBuilder构建的完整系统提示词）
current_prompt = asyncio.run(
    system_prompt_builder.build_system_prompt(mode=current_mode, include_persistent_memory=True)
)
graph = build_graph(tool, memory, system_prompt=current_prompt, mode=current_mode)
    
config={"configurable":{"thread_id":"1"}}

# 导入主循环
main_loop(graph,cleanup_conversations)