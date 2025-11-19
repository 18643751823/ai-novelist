import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain import tools
from langchain.tools import tool, ToolRuntime
from langgraph.types import interrupt,Command

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from config import settings
from file.utils.path_validator import PathValidator


class SearchAndReplaceInput(BaseModel):
    """搜索替换的输入参数"""
    path: str = Field(description="文件路径")
    search: str = Field(description="搜索文本")
    replace: str = Field(description="替换文本")
    use_regex: bool = Field(default=False, description="是否使用正则表达式")
    ignore_case: bool = Field(default=False, description="是否忽略大小写")

@tool(args_schema=SearchAndReplaceInput)
def search_and_replace(path: str, search: str, replace: str,
                           use_regex: bool = False, ignore_case: bool = False,
                           runtime: ToolRuntime = None) -> str:
    """搜索并替换文本
    
    Args:
        path: 文件路径
        search: 搜索文本
        replace: 替换文本
        use_regex: 是否使用正则表达式
        ignore_case: 是否忽略大小写
        runtime: LangChain运行时上下文
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
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：搜索替换失败，不安全的文件路径: {path}"
                
            # 获取完整路径
            full_path = path_validator.get_full_path(clean_path)
            
            # 检查文件是否存在
            if not full_path.exists():
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：错误：文件 '{path}' 不存在"
            
            # 检查是否为文件而非目录
            if not full_path.is_file():
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：错误：'{path}' 不是一个文件"
            
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if use_regex:
                flags = re.IGNORECASE if ignore_case else 0
                pattern = re.compile(search, flags)
                new_content = pattern.sub(replace, content)
            else:
                if ignore_case:
                    # 简单的忽略大小写替换
                    pattern = re.compile(re.escape(search), re.IGNORECASE)
                    new_content = pattern.sub(replace, content)
                else:
                    new_content = content.replace(search, replace)
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            return f"【用户额外信息】：{choice_data}，【工具执行结果】：在文件 '{path}' 中成功完成搜索替换操作"
        
        except Exception as e:
            return f"【用户额外信息】：{choice_data}，【工具执行结果】：搜索替换失败: {str(e)}"
    else:
        return f"【用户额外信息】：{choice_data}，【工具执行结果】：用户拒绝了工具请求"