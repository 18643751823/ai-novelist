import json
import os
from pathlib import Path
from typing import Optional, Dict, Any

class Settings:
    """
    统一配置系统 - 所有配置都从 store.json 读取
    """
    
    def __init__(self):
        self._config_file = Path("config/store.json")
        
        # 应用配置
        self.APP_NAME: str = "AI Novelist Backend"
        self.DEBUG: bool = self._get_config("debug", True)
        self.HOST: str = self._get_config("host", "127.0.0.1")
        self.PORT: int = self._get_config("port", 8000)
        
        # 数据目录
        base_dir = Path(__file__).parent
        self.DATA_DIR: str = str(base_dir / "data")
        self.NOVEL_DIR: str = str(base_dir / "data" / "novel")
        
        # AI配置已移动到 ai_agent/config.py 中管理
        
        # 向量数据库配置 (使用LanceDB)
        self.LANCEDB_PERSIST_DIR: str = str(base_dir / "data" / "lancedb")
        
        # 文件配置
        self.MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
        self.ALLOWED_EXTENSIONS: str = ".txt,.md,.pdf,.docx"
        
        # 确保必要的目录存在
        os.makedirs(self.DATA_DIR, exist_ok=True)
        os.makedirs(self.NOVEL_DIR, exist_ok=True)
        os.makedirs(self.LANCEDB_PERSIST_DIR, exist_ok=True)
    
    def _load_config(self) -> Dict[str, Any]:
        """从 store.json 加载配置"""
        if not self._config_file.exists():
            return {}
        
        try:
            with open(self._config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, Exception):
            return {}
    
    def _get_config(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        # 每次获取配置时重新加载，确保获取最新配置
        config = self._load_config()
        value = config.get(key, default)
        
        # 处理嵌套的配置结构（兼容前端可能发送的嵌套结构）
        if isinstance(value, dict):
            # 如果值是字典，尝试提取实际的配置值
            if 'value' in value:
                return value['value']
            elif 'success' in value and 'value' in value:
                return value['value']
        
        return value
    
    def reload(self):
        """重新加载配置（向后兼容）"""
        pass  # 现在每次访问都会重新加载，这个方法保留用于向后兼容
    
    # AI相关配置已移动到 ai_agent/config.py 中管理

# 创建全局设置实例
settings = Settings()