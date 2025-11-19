import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain.tools import tool
from langgraph.types import Command, interrupt

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from config import settings
from file.utils.path_validator import PathValidator

class InsertContentInput(BaseModel):
    """插入内容的输入参数"""
    path: str = Field(description="文件路径（相对于novel目录的相对路径）")
    paragraph: int = Field(description="段落号")
    content: str = Field(description="要插入的内容")

@tool(args_schema=InsertContentInput)
def insert_content(path: str, paragraph: int, content: str) -> str:
    """在指定位置插入内容
    
    Args:
        path: 文件路径（相对于novel目录的相对路径）
        paragraph: 段落号
        content: 要插入的内容
    """
    user_choice = interrupt("工具中断，扣1恢复，扣2取消")
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 初始化路径验证器
            path_validator = PathValidator(settings.NOVEL_DIR)
            
            # 规范化路径
            clean_path = path_validator.normalize_path(path)
            
            # 验证路径安全性
            if not path_validator.is_safe_path(clean_path):
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：插入失败，不安全的文件路径: {path}"
                
            # 获取完整路径
            file_path = path_validator.get_full_path(clean_path)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_content = f.read()
            
            lines = existing_content.split('\n')
            
            if paragraph == 0:  # 在文件末尾追加
                lines.append(content)
            else:
                # 在指定段落插入
                insert_pos = min(max(0, paragraph - 1), len(lines))
                lines.insert(insert_pos, content)
            
            new_content = '\n'.join(lines)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return f"【用户额外信息】：{choice_data}，【工具执行结果】：内容已成功插入到文件 '{path}' 的第 {paragraph} 段"
        except Exception as e:
            return f"【用户额外信息】：{choice_data}，【工具执行结果】：插入内容失败: {str(e)}"
    else:
        return f"【用户额外信息】：{choice_data}，【工具执行结果】：用户取消了工具请求"