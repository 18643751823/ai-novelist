"""
系统提示词构建器
负责构建包含文件树结构和持久记忆的完整系统提示词
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional
import logging

# 添加父目录到路径，确保可以导入ai_agent模块
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from ..config import ai_settings
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from file.utils.file_tree_builder import file_tree_builder
from config import settings

logger = logging.getLogger(__name__)


class SystemPromptBuilder:
    """系统提示词构建器"""
    
    def __init__(self):
        self.novel_dir = settings.NOVEL_DIR
        self.file_tree_cache = None
        self.last_cache_time = None
        self.cache_timeout = 30  # 缓存30秒
        
    def get_novel_path(self) -> str:
        """获取novel目录路径
        
        在开发环境中，novel目录位于项目根目录下的data/novel
        在生产环境中，novel目录位于.exe文件同级目录
        """
        return self.novel_dir
    
    def _load_store_config(self) -> Dict[str, Any]:
        """加载存储配置"""
        try:
            config_path = Path(__file__).parent.parent.parent / "config" / "store.json"
            if not config_path.exists():
                logger.warning("配置文件不存在，返回空配置")
                return {}
            
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载存储配置失败: {e}")
            return {}
    
    def _get_persistent_memory_for_mode(self, mode: str) -> str:
        """获取指定模式的持久记忆信息
        
        Args:
            mode: 模式名称
            
        Returns:
            格式化的持久记忆信息字符串
        """
        try:
            config = self._load_store_config()
            additional_info = config.get("additionalInfo", {})
            
            # 获取当前模式的持久记忆信息
            mode_info = additional_info.get(mode, {})
            if not mode_info:
                return ""
            
            # 构建格式化的持久记忆信息
            memory_parts = []
            
            # 大纲信息
            outline = mode_info.get("outline", "").strip()
            if outline:
                memory_parts.append(f"大纲信息:\n{outline}")
            
            # 上一章全文
            previous_chapter = mode_info.get("previousChapter", "").strip()
            if previous_chapter:
                memory_parts.append(f"上一章全文:\n{previous_chapter}")
            
            # 本章重要人设
            character_settings = mode_info.get("characterSettings", "").strip()
            if character_settings:
                memory_parts.append(f"本章重要人物设定:\n{character_settings}")
            
            if memory_parts:
                return "\n\n".join(memory_parts)
            else:
                return ""
                
        except Exception as e:
            logger.error(f"获取持久记忆信息失败: {e}")
            return ""
    
    async def get_file_tree_content(self) -> str:
        """获取格式化的文件树内容
        
        Returns:
            格式化的文件树文本，如：
            ```
            [当前工作区文件结构 (novel 目录)]:
            - 文件夹1/
              - 文件1.txt
              - 文件2.txt
            - 文件2.txt
            ```
        """
        try:
            # 获取novel目录路径
            novel_path = self.get_novel_path()
            
            # 确保novel目录存在
            os.makedirs(novel_path, exist_ok=True)
            
            # 获取文件树
            file_tree_result = await file_tree_builder.get_file_tree(novel_path)
            
            if not file_tree_result.get("success", False):
                logger.error(f"获取文件树失败: {file_tree_result.get('error', '未知错误')}")
                return "[当前工作区文件结构 (novel 目录)]:\n(获取文件树失败)"
            
            # 格式化文件树为文本
            tree_text = self._format_tree_to_text(file_tree_result.get("tree", []))
            
            return f"[当前工作区文件结构 (novel 目录)]:\n{tree_text}"
            
        except Exception as e:
            logger.error(f"获取文件树内容时出错: {e}")
            return "[当前工作区文件结构 (novel 目录)]:\n(获取文件树出错)"
    
    def _format_tree_to_text(self, nodes: list, indent: int = 0) -> str:
        """将文件树节点格式化为文本
        
        Args:
            nodes: 文件树节点列表
            indent: 缩进级别
            
        Returns:
            格式化的文本
        """
        lines = []
        indent_str = "  " * indent
        
        for node in nodes:
            if node.get("isFolder", False):
                # 文件夹
                lines.append(f"{indent_str}- {node['title']}/")
                # 递归处理子节点
                children = node.get("children", [])
                if children:
                    children_text = self._format_tree_to_text(children, indent + 1)
                    lines.append(children_text)
            else:
                # 文件
                lines.append(f"{indent_str}- {node['title']}")
        
        return "\n".join(lines)
    
    async def build_system_prompt(
        self,
        mode: str = None,
        include_file_tree: bool = True,
        include_persistent_memory: bool = True,
        rag_content: str = ""
    ) -> str:
        """构建完整的系统提示词
        
        Args:
            mode: 对话模式 (outline/writing/adjustment)
            include_file_tree: 是否包含文件树结构
            include_persistent_memory: 是否包含持久记忆信息
            rag_content: RAG内容
            
        Returns:
            完整的系统提示词
        """
        try:
            # 获取基础系统提示词
            base_prompt = ai_settings.get_prompt_for_mode(mode)
            
            # 构建完整提示词
            prompt_parts = [base_prompt]
            
            # 添加文件树结构
            if include_file_tree:
                file_tree_content = await self.get_file_tree_content()
                prompt_parts.append(file_tree_content)
            
            # 添加持久记忆信息
            if include_persistent_memory:
                persistent_memory = self._get_persistent_memory_for_mode(mode)
                if persistent_memory:
                    prompt_parts.append(f"[持久记忆信息]:\n{persistent_memory}")
            
            # 合并所有部分
            full_prompt = "\n\n".join(prompt_parts)
            
            logger.info(f"系统提示词构建完成，模式: {mode}，包含文件树: {include_file_tree}，包含持久记忆: {include_persistent_memory}")
            return full_prompt
            
        except Exception as e:
            logger.error(f"构建系统提示词时出错: {e}")
            # 出错时返回基础提示词
            return ai_settings.get_prompt_for_mode(mode)
    
    async def refresh_file_tree_cache(self):
        """刷新文件树缓存"""
        try:
            # 获取novel目录路径
            novel_path = self.get_novel_path()
            
            # 重新获取文件树
            file_tree_result = await file_tree_builder.get_file_tree(novel_path)
            
            if file_tree_result.get("success", False):
                self.file_tree_cache = file_tree_result.get("tree", [])
                self.last_cache_time = os.path.getmtime(novel_path) if os.path.exists(novel_path) else None
                logger.info("文件树缓存已刷新")
            else:
                logger.error(f"刷新文件树缓存失败: {file_tree_result.get('error', '未知错误')}")
                
        except Exception as e:
            logger.error(f"刷新文件树缓存时出错: {e}")


# 创建全局实例
system_prompt_builder = SystemPromptBuilder()