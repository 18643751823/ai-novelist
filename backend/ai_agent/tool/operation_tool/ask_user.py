import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain import tools
from langchain.tools import tool, ToolRuntime
from langgraph.types import interrupt,Command

class AskUserQuestionInput(BaseModel):
    """向用户提问的输入参数"""
    question: str = Field(description="问题内容")

@tool(args_schema=AskUserQuestionInput)
def ask_user_question(question: str, runtime: ToolRuntime = None) -> str:
    """向用户提问
    
    Args:
        question: 问题内容
        runtime: LangChain运行时上下文
    """
    user_choice = interrupt(f"请回复: {question}")
    choice_action = "1" # 这里应该要默认批准功能
    choice_data = user_choice.get("choice_data", "无附加信息")
    # 无需选择批准或取消，等待用户输入信息后，直接返回用户回答
    return f"【用户额外信息】&【工具执行结果】：{choice_data}"