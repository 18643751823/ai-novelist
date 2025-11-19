import os
import importlib.util
from typing import Dict, List
from .tool_config_manager import tool_config_manager


# 动态导入工具文件夹下的所有工具
def import_tools_from_directory(tool_dir: str, mode: str = None):
    """从指定目录导入所有工具，支持按模式过滤
    
    Args:
        tool_dir: 工具目录
        mode: 模式名称，如果提供则只导入该模式启用的工具
    """
    tools = {}
    tool_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), tool_dir)
    
    if not os.path.exists(tool_path):
        print(f"警告: 工具目录不存在: {tool_path}")
        return tools
    
    # 获取模式启用的工具列表
    enabled_tools = []
    if mode:
        enabled_tools = tool_config_manager.get_tools_for_mode(mode)
        print(f"[INFO] 模式 '{mode}' 启用的工具: {enabled_tools}")
    
    # 递归搜索所有子目录中的Python文件
    for root, dirs, files in os.walk(tool_path):
        for filename in files:
            if filename.endswith('.py') and filename != '__init__.py':
                module_path = os.path.join(root, filename)
                # 计算相对于工具目录的模块名
                relative_path = os.path.relpath(module_path, tool_path)
                module_name = relative_path.replace(os.path.sep, '.').replace('.py', '')
                
                try:
                    # 动态导入模块
                    spec = importlib.util.spec_from_file_location(module_name, module_path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    
                    # 查找模块中的工具函数
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if hasattr(attr, 'name') and hasattr(attr, 'invoke'):
                            # 这是一个 LangChain 工具
                            tool_name = attr.name
                            
                            # 如果指定了模式，检查工具是否在该模式中启用
                            if mode and tool_name not in enabled_tools:
                                print(f"[SKIP] 工具 '{tool_name}' 在模式 '{mode}' 中未启用")
                                continue
                            
                            tools[tool_name] = attr
                            print(f"[OK] 已导入工具: {tool_name}")
                            
                except Exception as e:
                    print(f"[ERROR] 导入工具 {module_name} 失败: {e}")
    
    print(f"[INFO] 总共导入 {len(tools)} 个工具")
    return tools