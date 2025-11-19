import os
import json
from pathlib import Path
from typing import Dict, List, Set, Any
from ..config import ai_settings

class ToolConfigManager:
    """
    工具配置管理器 - 负责管理不同模式的工具配置
    """
    
    def __init__(self):
        self._config_file = Path(__file__).parent.parent.parent / "config" / "store.json"
        self._tool_categories = {
            "file_operations": [
                "read_file",
                "write_file",
                "apply_diff",
                "insert_content",
                "search_file",
                "search_and_replace"
            ],
            "user_interaction": [
                "ask_user_question"
            ],
            "knowledge_base": [
                "search_embedding",
                "list_knowledge_base"
            ]
        }
        
        # 默认模式工具配置
        self._default_mode_tools = {
            "outline": {
                "enabled_tools": ["read_file", "write_file", "ask_user_question", "search_embedding", "list_knowledge_base"],
                "description": "细纲模式 - 专注于大纲规划和用户沟通"
            },
            "writing": {
                "enabled_tools": ["read_file", "write_file", "apply_diff", "insert_content", "search_file", "search_embedding", "list_knowledge_base"],
                "description": "写作模式 - 专注于内容创作和编辑"
            },
            "adjustment": {
                "enabled_tools": ["read_file", "apply_diff", "insert_content", "search_and_replace", "ask_user_question", "search_embedding", "list_knowledge_base"],
                "description": "调整模式 - 专注于内容优化和用户确认"
            }
        }
    
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        if not self._config_file.exists():
            return {}
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    
    def _save_config(self, config: Dict[str, Any]):
        """保存配置到 store.json"""
        try:
            with open(self._config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ERROR] 保存配置失败: {e}")
    
    def get_tools_for_mode(self, mode: str) -> List[str]:
        """获取指定模式启用的工具列表"""
        config = self._load_config()
        
        # 从配置中获取模式工具设置
        mode_tools_config = config.get("mode_tools", {})
        
        if mode in mode_tools_config:
            # 使用自定义配置
            print("使用自定义")
            return mode_tools_config[mode].get("enabled_tools", [])
        else:
            # 使用默认配置
            print("使用默认")
            return self._default_mode_tools.get(mode, {}).get("enabled_tools", [])
    
    def set_tools_for_mode(self, mode: str, enabled_tools: List[str]):
        """设置指定模式的工具配置"""
        config = self._load_config()
        
        # 初始化模式工具配置
        if "mode_tools" not in config:
            config["mode_tools"] = {}
        
        # 验证工具名称
        valid_tools = []
        all_available_tools = self.get_all_available_tools()
        for tool_name in enabled_tools:
            if tool_name in all_available_tools:
                valid_tools.append(tool_name)
            else:
                print(f"[WARNING] 工具 '{tool_name}' 不存在，已忽略")
        
        # 更新配置
        config["mode_tools"][mode] = {
            "enabled_tools": valid_tools,
            "description": f"自定义模式 - {mode}"
        }
        
        self._save_config(config)
        print(f"[INFO] 已更新模式 '{mode}' 的工具配置: {valid_tools}")
    
    def get_all_available_tools(self) -> List[str]:
        """获取所有可用的工具名称"""
        all_tools = []
        for category_tools in self._tool_categories.values():
            all_tools.extend(category_tools)
        return all_tools
    
    def get_tool_categories(self) -> Dict[str, List[str]]:
        """获取工具分类"""
        return self._tool_categories.copy()
    
    def get_default_mode_tools(self) -> Dict[str, Dict[str, Any]]:
        """获取默认模式工具配置"""
        return self._default_mode_tools.copy()
    
    def reset_mode_tools(self, mode: str = None):
        """重置模式工具配置为默认值"""
        config = self._load_config()
        
        if mode:
            # 重置指定模式
            if "mode_tools" in config and mode in config["mode_tools"]:
                del config["mode_tools"][mode]
                if not config["mode_tools"]:
                    del config["mode_tools"]
        else:
            # 重置所有模式
            if "mode_tools" in config:
                del config["mode_tools"]
        
        self._save_config(config)
        print(f"[INFO] 已重置模式 '{mode if mode else 'all'}' 的工具配置")
    
    def get_mode_tool_info(self, mode: str) -> Dict[str, Any]:
        """获取模式的工具配置信息"""
        config = self._load_config()
        
        if "mode_tools" in config and mode in config["mode_tools"]:
            # 返回自定义配置
            return config["mode_tools"][mode]
        else:
            # 返回默认配置
            return self._default_mode_tools.get(mode, {
                "enabled_tools": [],
                "description": "未知模式"
            })

# 创建全局工具配置管理器实例
tool_config_manager = ToolConfigManager()