#!/usr/bin/env python3
"""
API Provider GUI管理器
提供图形界面，让用户配置模型提供商，获取模型列表，并更新config.yaml
"""

import os
import sys
import yaml
import json
import requests
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from typing import Dict, List, Optional, Any
from pathlib import Path
import threading

class ConfigManagerGUI:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.config_file = self.script_dir / "config.yaml"
        self.preset_file = self.script_dir / "preset_models.yaml"
        self.presets = self._load_presets()
        self.current_config = self._load_config()
        self.all_models = []  # 存储所有获取到的模型
        
        # 创建主窗口
        self.root = tk.Tk()
        self.root.title("API Provider 配置管理器")
        # 设置全屏显示
        self.root.state('zoomed')  # Windows系统全屏
        self.root.minsize(800, 600)  # 增加最小尺寸要求
        
        # 设置样式
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # 创建界面
        self.create_widgets()
        
    def _load_presets(self) -> Dict[str, Any]:
        """加载预设模型提供商配置"""
        try:
            with open(self.preset_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            messagebox.showerror("错误", f"加载预设配置失败: {e}")
            return {}
    
    def _save_presets(self) -> bool:
        """保存预设配置到preset_models.yaml"""
        try:
            with open(self.preset_file, 'w', encoding='utf-8') as f:
                yaml.dump(self.presets, f, default_flow_style=False,
                         allow_unicode=True, indent=2)
            return True
        except Exception as e:
            messagebox.showerror("错误", f"保存预设配置失败: {e}")
            return False
    
    def _load_config(self) -> Dict[str, Any]:
        """加载当前配置"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f) or {}
                    # 确保model_list是一个列表，而不是None
                    if config.get("model_list") is None:
                        config["model_list"] = []
                    return config
            return {"model_list": []}
        except Exception as e:
            messagebox.showerror("错误", f"加载当前配置失败: {e}")
            return {"model_list": []}
    
    def _save_config(self) -> bool:
        """保存配置到config.yaml"""
        try:
            # 手动构建正确的YAML格式，确保model_name在开头
            config_lines = ["model_list:"]
            
            model_list = self.current_config.get("model_list", [])
            # 确保model_list是一个列表，而不是None
            if model_list is None:
                model_list = []
            
            for model in model_list:
                model_name = model.get("model_name", "")
                litellm_params = model.get("litellm_params", {})
                
                # 添加模型名称
                config_lines.append(f"  - model_name: {model_name}")
                
                # 添加litellm_params
                config_lines.append("    litellm_params:")
                
                # 添加model参数
                model_param = litellm_params.get("model", "")
                if model_param:
                    config_lines.append(f"      model: {model_param}")
                
                # 添加api_base参数
                api_base = litellm_params.get("api_base", "")
                if api_base:
                    config_lines.append(f"      api_base: {api_base}")
                
                # 添加api_key参数
                api_key = litellm_params.get("api_key", "")
                if api_key:
                    config_lines.append(f"      api_key: {api_key}")
                
                # 添加其他参数
                for key, value in litellm_params.items():
                    if key not in ["model", "api_base", "api_key"]:
                        config_lines.append(f"      {key}: {value}")
                
                # 添加model_info（如果存在）
                model_info = model.get("model_info", {})
                if model_info:
                    config_lines.append("    model_info:")
                    for key, value in model_info.items():
                        config_lines.append(f"      {key}: {value}")
            
            # 写入文件
            with open(self.config_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(config_lines))
            
            return True
        except Exception as e:
            messagebox.showerror("错误", f"保存配置失败: {e}")
            return False
    
    def create_widgets(self):
        """创建界面组件"""
        # 创建主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置网格权重 - 增大左侧比重，右侧占据整个右侧框
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=2)  # 左侧权重增加到2
        main_frame.columnconfigure(1, weight=3)  # 右侧权重增加到3
        main_frame.rowconfigure(1, weight=1)
        
        # 左侧面板 - 提供商选择
        left_frame = ttk.LabelFrame(main_frame, text="模型提供商", padding="10")
        left_frame.grid(row=0, column=0, rowspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 10))
        
        # 创建选项卡
        self.provider_notebook = ttk.Notebook(left_frame)
        self.provider_notebook.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 预设提供商选项卡
        preset_frame = ttk.Frame(self.provider_notebook)
        self.provider_notebook.add(preset_frame, text="预设提供商")
        
        # 提供商列表
        ttk.Label(preset_frame, text="选择提供商:").grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        
        self.provider_var = tk.StringVar()
        self.provider_combo = ttk.Combobox(preset_frame, textvariable=self.provider_var, state="readonly")
        self.provider_combo.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        self.provider_combo.bind('<<ComboboxSelected>>', self.on_preset_provider_selected)
        
        # 自定义提供商选项卡
        custom_frame = ttk.Frame(self.provider_notebook)
        self.provider_notebook.add(custom_frame, text="自定义提供商")
        
        # 自定义提供商名称
        ttk.Label(custom_frame, text="提供商名称:").grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        self.custom_provider_name_var = tk.StringVar()
        self.custom_provider_name_entry = ttk.Entry(custom_frame, textvariable=self.custom_provider_name_var)
        self.custom_provider_name_entry.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 自定义API基础URL
        ttk.Label(custom_frame, text="API基础URL:").grid(row=2, column=0, sticky=tk.W, pady=(0, 5))
        self.custom_api_base_var = tk.StringVar()
        self.custom_api_base_entry = ttk.Entry(custom_frame, textvariable=self.custom_api_base_var)
        self.custom_api_base_entry.grid(row=3, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 自定义API密钥
        ttk.Label(custom_frame, text="API密钥:").grid(row=4, column=0, sticky=tk.W, pady=(0, 5))
        self.custom_api_key_var = tk.StringVar()
        self.custom_api_key_entry = ttk.Entry(custom_frame, textvariable=self.custom_api_key_var, show="*")
        self.custom_api_key_entry.grid(row=5, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 保存自定义提供商按钮
        self.save_custom_provider_btn = ttk.Button(custom_frame, text="保存自定义提供商", command=self.save_custom_provider)
        self.save_custom_provider_btn.grid(row=6, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 配置自定义选项卡网格权重
        custom_frame.columnconfigure(0, weight=1)
        
        # 绑定选项卡切换事件
        self.provider_notebook.bind("<<NotebookTabChanged>>", self.on_tab_changed)
        
        # API密钥输入（预设提供商）
        ttk.Label(preset_frame, text="API密钥:").grid(row=2, column=0, sticky=tk.W, pady=(0, 5))
        self.api_key_var = tk.StringVar()
        self.api_key_entry = ttk.Entry(preset_frame, textvariable=self.api_key_var, show="*")
        self.api_key_entry.grid(row=3, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 获取模型按钮（预设提供商）
        self.get_models_btn = ttk.Button(preset_frame, text="获取模型列表", command=self.get_models)
        self.get_models_btn.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 自定义提供商的获取模型按钮
        self.get_custom_models_btn = ttk.Button(custom_frame, text="获取模型列表", command=self.get_custom_models)
        self.get_custom_models_btn.grid(row=7, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 自定义提供商列表
        ttk.Label(custom_frame, text="已保存的自定义提供商:").grid(row=8, column=0, sticky=tk.W, pady=(0, 5))
        self.custom_provider_listbox = tk.Listbox(custom_frame, height=4)
        self.custom_provider_listbox.grid(row=9, column=0, sticky=(tk.W, tk.E), pady=(0, 5))
        self.custom_provider_listbox.bind('<<ListboxSelect>>', self.on_custom_provider_selected)
        
        # 删除自定义提供商按钮
        self.delete_custom_provider_btn = ttk.Button(custom_frame, text="删除选中的自定义提供商", command=self.delete_custom_provider)
        self.delete_custom_provider_btn.grid(row=10, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 模型列表（通用）
        ttk.Label(left_frame, text="可用模型:").grid(row=11, column=0, sticky=tk.W, pady=(0, 5))
        
        # 搜索框
        ttk.Label(left_frame, text="搜索模型:").grid(row=12, column=0, sticky=tk.W, pady=(0, 5))
        self.search_var = tk.StringVar()
        self.search_entry = ttk.Entry(left_frame, textvariable=self.search_var)
        self.search_entry.grid(row=13, column=0, sticky=(tk.W, tk.E), pady=(0, 5))
        self.search_var.trace('w', self.filter_models)
        
        # 模型列表
        self.model_listbox = tk.Listbox(left_frame, height=8)
        self.model_listbox.grid(row=14, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 添加模型按钮
        self.add_model_btn = ttk.Button(left_frame, text="添加选中模型", command=self.add_selected_model)
        self.add_model_btn.grid(row=15, column=0, sticky=(tk.W, tk.E))
        
        # 配置左侧框架权重
        left_frame.columnconfigure(0, weight=1)
        left_frame.rowconfigure(14, weight=1)
        
        # 配置预设框架网格权重
        preset_frame.columnconfigure(0, weight=1)
        
        # 右侧面板 - 当前配置
        right_frame = ttk.LabelFrame(main_frame, text="当前配置的模型", padding="10")
        right_frame.grid(row=0, column=1, rowspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))  # 增加rowspan使其占据整个右侧
        
        # 当前配置列表
        self.config_tree = ttk.Treeview(right_frame, columns=("provider", "model"), show="tree headings")
        self.config_tree.heading("#0", text="模型名称")
        self.config_tree.heading("provider", text="提供商")
        self.config_tree.heading("model", text="模型ID")
        self.config_tree.column("#0", width=150)
        self.config_tree.column("provider", width=100)
        self.config_tree.column("model", width=200)
        
        # 滚动条
        config_scrollbar = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self.config_tree.yview)
        self.config_tree.configure(yscrollcommand=config_scrollbar.set)
        
        self.config_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        config_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 删除模型按钮
        self.remove_model_btn = ttk.Button(right_frame, text="删除选中模型", command=self.remove_selected_model)
        self.remove_model_btn.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
        # 配置右侧框架权重 - 确保模型列表占据整个右侧空间
        right_frame.columnconfigure(0, weight=1)
        right_frame.rowconfigure(0, weight=1)
        
        # 底部按钮面板
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
        self.refresh_btn = ttk.Button(button_frame, text="刷新", command=self.refresh_config)
        self.refresh_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.save_and_exit_btn = ttk.Button(button_frame, text="保存并退出", command=self.save_and_exit)
        self.save_and_exit_btn.pack(side=tk.RIGHT)
        
        # 状态栏
        self.status_var = tk.StringVar()
        self.status_var.set("就绪")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
        # 初始化界面
        self.init_interface()
    
    def init_interface(self):
        """初始化界面数据"""
        # 加载预设提供商列表
        providers = self.presets.get('providers', {})
        provider_names = []
        for provider_id, provider_info in providers.items():
            name = provider_info.get('name', provider_id)
            is_local = provider_info.get('is_local', False)
            status = " (本地)" if is_local else " (云端)"
            provider_names.append(f"{name}{status}")
        
        self.provider_combo['values'] = provider_names
        if provider_names:
            self.provider_combo.current(0)
            self.on_preset_provider_selected(None)
        
        # 加载自定义提供商列表
        self.refresh_custom_providers()
        
        # 刷新当前配置
        self.refresh_config()
    
    def on_preset_provider_selected(self, event):
        """预设提供商选择事件处理"""
        selected_index = self.provider_combo.current()
        if selected_index < 0:
            return
        
        providers = self.presets.get('providers', {})
        provider_ids = list(providers.keys())
        
        if selected_index < len(provider_ids):
            provider_id = provider_ids[selected_index]
            provider_info = providers[provider_id]
            
            # 更新API密钥输入框状态
            is_local = provider_info.get('is_local', False)
            if is_local:
                self.api_key_var.set("")
                self.api_key_entry.config(state='disabled')
            else:
                self.api_key_entry.config(state='normal')
                # 加载已保存的API密钥
                saved_api_key = provider_info.get('saved_api_key', '')
                if saved_api_key:
                    self.api_key_var.set(saved_api_key)
                else:
                    self.api_key_var.set("")
            
            # 清空模型列表
            self.model_listbox.delete(0, tk.END)
            self.all_models = []  # 清空所有模型列表
    
    def on_tab_changed(self, event):
        """选项卡切换事件处理"""
        selected_tab = self.provider_notebook.select()
        tab_text = self.provider_notebook.tab(selected_tab, "text")
        
        # 切换到自定义提供商选项卡时，清空模型列表
        if tab_text == "自定义提供商":
            self.model_listbox.delete(0, tk.END)
            self.all_models = []
    
    def on_custom_provider_selected(self, event):
        """自定义提供商选择事件处理"""
        selected_indices = self.custom_provider_listbox.curselection()
        if not selected_indices:
            return
        
        selected_index = selected_indices[0]
        custom_providers = self.presets.get('custom_providers', {})
        custom_provider_ids = list(custom_providers.keys())
        
        if selected_index < len(custom_provider_ids):
            provider_id = custom_provider_ids[selected_index]
            provider_info = custom_providers[provider_id]
            
            # 填充表单
            self.custom_provider_name_var.set(provider_info.get('name', ''))
            self.custom_api_base_var.set(provider_info.get('base_url', ''))
            self.custom_api_key_var.set(provider_info.get('saved_api_key', ''))
            
            # 清空模型列表
            self.model_listbox.delete(0, tk.END)
            self.all_models = []
    
    def refresh_custom_providers(self):
        """刷新自定义提供商列表"""
        self.custom_provider_listbox.delete(0, tk.END)
        
        custom_providers = self.presets.get('custom_providers', {})
        for provider_id, provider_info in custom_providers.items():
            name = provider_info.get('name', provider_id)
            self.custom_provider_listbox.insert(tk.END, name)
    
    def save_custom_provider(self):
        """保存自定义提供商"""
        name = self.custom_provider_name_var.get().strip()
        base_url = self.custom_api_base_var.get().strip()
        api_key = self.custom_api_key_var.get().strip()
        
        if not name:
            messagebox.showwarning("警告", "请输入提供商名称")
            return
        
        if not base_url:
            messagebox.showwarning("警告", "请输入API基础URL")
            return
        
        # 确保custom_providers存在
        if 'custom_providers' not in self.presets:
            self.presets['custom_providers'] = {}
        
        # 生成唯一的提供商ID
        provider_id = f"custom_{name.lower().replace(' ', '_')}"
        
        # 检查是否已存在
        if provider_id in self.presets['custom_providers']:
            result = messagebox.askyesno("确认", f"提供商 '{name}' 已存在，是否覆盖？")
            if not result:
                return
        
        # 保存提供商配置
        self.presets['custom_providers'][provider_id] = {
            'name': name,
            'base_url': base_url,
            'models_endpoint': '/models',
            'model_id_prefix': 'openai/',  # 所有自定义提供商使用openai/前缀
            'description': f'自定义提供商: {name}',
            'saved_api_key': api_key
        }
        
        # 保存到文件
        if self._save_presets():
            messagebox.showinfo("成功", f"已保存自定义提供商: {name}")
            self.refresh_custom_providers()
        else:
            messagebox.showerror("错误", "保存自定义提供商失败")
    
    def delete_custom_provider(self):
        """删除自定义提供商"""
        selected_indices = self.custom_provider_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("警告", "请先选择一个自定义提供商")
            return
        
        selected_index = selected_indices[0]
        custom_providers = self.presets.get('custom_providers', {})
        custom_provider_ids = list(custom_providers.keys())
        
        if selected_index < len(custom_provider_ids):
            provider_id = custom_provider_ids[selected_index]
            provider_info = custom_providers[provider_id]
            name = provider_info.get('name', provider_id)
            
            if messagebox.askyesno("确认", f"确定要删除自定义提供商 '{name}' 吗？"):
                del custom_providers[provider_id]
                
                if self._save_presets():
                    messagebox.showinfo("成功", f"已删除自定义提供商: {name}")
                    self.refresh_custom_providers()
                    # 清空表单
                    self.custom_provider_name_var.set("")
                    self.custom_api_base_var.set("")
                    self.custom_api_key_var.set("")
                else:
                    messagebox.showerror("错误", "删除自定义提供商失败")
    
    def get_custom_models(self):
        """获取自定义提供商的模型列表"""
        name = self.custom_provider_name_var.get().strip()
        base_url = self.custom_api_base_var.get().strip()
        api_key = self.custom_api_key_var.get().strip()
        
        if not name:
            messagebox.showwarning("警告", "请输入提供商名称")
            return
        
        if not base_url:
            messagebox.showwarning("警告", "请输入API基础URL")
            return
        
        # 在新线程中获取模型列表
        self.status_var.set("正在获取自定义提供商模型列表...")
        self.get_custom_models_btn.config(state='disabled')
        
        thread = threading.Thread(target=self._get_custom_models_thread, args=(name, base_url, api_key))
        thread.daemon = True
        thread.start()
    
    def _get_custom_models_thread(self, name: str, base_url: str, api_key: str):
        """在后台线程中获取自定义提供商的模型列表"""
        try:
            models = self._get_custom_provider_models(name, base_url, api_key)
            
            # 在主线程中更新UI
            self.root.after(0, self._update_custom_models_list, models)
            
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("错误", f"获取自定义提供商模型列表失败: {e}"))
            self.root.after(0, self._reset_custom_ui_state)
    
    def _get_custom_provider_models(self, name: str, base_url: str, api_key: str) -> List[Dict[str, Any]]:
        """获取自定义提供商的模型列表"""
        try:
            models_endpoint = "/models"
            model_id_prefix = "openai/"  # 所有自定义提供商使用openai/前缀
            
            # 构建请求头
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            # 发送请求
            response = requests.get(f"{base_url}{models_endpoint}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                models = []
                
                # 处理响应数据
                for model_data in data.get("data", []):
                    model_id = model_data.get("id", "")
                    if model_id:
                        # 确保模型ID使用openai/前缀
                        if not model_id.startswith("openai/"):
                            final_model_id = f"{model_id_prefix}{model_id}"
                        else:
                            final_model_id = model_id
                        
                        models.append({
                            "id": final_model_id,
                            "name": f"{name} {model_id}",
                            "provider": "custom",
                            "base_url": base_url,
                            "api_key": api_key
                        })
                
                return models
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取自定义提供商模型列表时出错: {e}")
    
    def _update_custom_models_list(self, models: List[Dict[str, Any]]):
        """更新自定义提供商模型列表UI"""
        self.model_listbox.delete(0, tk.END)
        self.all_models = models  # 保存所有模型
        
        # 应用搜索过滤
        self.filter_models()
        
        self.status_var.set(f"获取到 {len(models)} 个自定义提供商模型")
        self.get_custom_models_btn.config(state='normal')
    
    def _reset_custom_ui_state(self):
        """重置自定义提供商UI状态"""
        self.status_var.set("获取自定义提供商模型列表失败")
        self.get_custom_models_btn.config(state='normal')
    
    def get_models(self):
        """获取模型列表"""
        selected_index = self.provider_combo.current()
        if selected_index < 0:
            messagebox.showwarning("警告", "请先选择一个提供商")
            return
        
        providers = self.presets.get('providers', {})
        provider_ids = list(providers.keys())
        provider_id = provider_ids[selected_index]
        provider_info = providers[provider_id]
        
        # 获取API密钥
        api_key = None
        if not provider_info.get('is_local', False):
            api_key = self.api_key_var.get().strip()
            if not api_key:
                # 如果当前输入框为空，尝试使用已保存的API密钥
                saved_api_key = provider_info.get('saved_api_key', '')
                if saved_api_key:
                    api_key = saved_api_key
                    self.api_key_var.set(saved_api_key)  # 同时更新输入框显示
                else:
                    messagebox.showwarning("警告", "请输入API密钥")
                    return
        
        # 在新线程中获取模型列表
        self.status_var.set("正在获取模型列表...")
        self.get_models_btn.config(state='disabled')
        
        thread = threading.Thread(target=self._get_models_thread, args=(provider_id, api_key))
        thread.daemon = True
        thread.start()
    
    def _get_models_thread(self, provider_id: str, api_key: str):
        """在后台线程中获取模型列表"""
        try:
            models = self.get_provider_models(provider_id, api_key)
            
            # 在主线程中更新UI
            self.root.after(0, self._update_models_list, models)
            
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("错误", f"获取模型列表失败: {e}"))
            self.root.after(0, self._reset_ui_state)
    
    def _update_models_list(self, models: List[Dict[str, Any]]):
        """更新模型列表UI"""
        self.model_listbox.delete(0, tk.END)
        self.all_models = models  # 保存所有模型
        
        # 应用搜索过滤
        self.filter_models()
        
        self.status_var.set(f"获取到 {len(models)} 个模型")
        self.get_models_btn.config(state='normal')
    
    def _reset_ui_state(self):
        """重置UI状态"""
        self.status_var.set("获取模型列表失败")
        self.get_models_btn.config(state='normal')
    
    def get_provider_models(self, provider_id: str, api_key: str = None) -> List[Dict[str, Any]]:
        """获取指定提供商的模型列表"""
        providers = self.presets.get('providers', {})
        if provider_id not in providers:
            return []
        
        provider_info = providers[provider_id]
        base_url = provider_info.get('base_url', '')
        models_endpoint = provider_info.get('models_endpoint', '')
        model_id_prefix = provider_info.get('model_id_prefix', '')
        is_local = provider_info.get('is_local', False)
        
        try:
            if provider_id == "gemini":
                # Gemini特殊处理 - 使用官方API获取模型列表
                return self._get_gemini_models_from_api(api_key, base_url, models_endpoint, model_id_prefix, provider_info.get('name', provider_id))
            elif provider_id == "aliyun":
                # 阿里云特殊处理 - 需要同时获取聊天模型和嵌入模型
                return self._get_aliyun_models(api_key, base_url, models_endpoint, model_id_prefix, provider_info.get('name', provider_id))
            elif is_local:
                # Ollama本地模型
                response = requests.get(f"{base_url}{models_endpoint}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    models = []
                    for model_data in data.get("models", []):
                        model_name = model_data.get("name", "")
                        # 保留完整的模型名称，包括标签（如 qwen3:0.6b）
                        # 不再截断冒号后的部分
                        
                        models.append({
                            "id": f"{model_id_prefix}{model_name}",
                            "name": f"Ollama {model_name}",
                            "provider": provider_id
                        })
                    return models
            else:
                # 云端API模型
                if not api_key:
                    raise ValueError("需要API密钥才能获取模型列表")
                
                headers = {"Authorization": f"Bearer {api_key}"}
                response = requests.get(f"{base_url}{models_endpoint}",
                                     headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    models = []
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        models.append({
                            "id": f"{model_id_prefix}{model_id}",
                            "name": f"{provider_info.get('name', provider_id)} {model_id}",
                            "provider": provider_id
                        })
                    return models
                else:
                    raise Exception(f"HTTP {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取模型列表时出错: {e}")
    
    def _get_gemini_models_from_api(self, api_key: str, base_url: str, models_endpoint: str, model_id_prefix: str, provider_name: str) -> List[Dict[str, Any]]:
        """从Gemini官方API获取模型列表"""
        try:
            if not api_key:
                raise ValueError("需要API密钥才能获取Gemini模型列表")
            
            # Gemini API使用不同的认证方式
            headers = {"x-goog-api-key": api_key}
            
            # 构建完整的模型列表URL
            models_url = f"{base_url}{models_endpoint}?key={api_key}"
            
            response = requests.get(models_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"🔍 Gemini API原始响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
                models = []
                
                # Gemini API返回的模型列表可能在不同的字段中
                models_list = data.get("models", [])
                print(f"🔍 找到 {len(models_list)} 个模型")
                
                for model_data in models_list:
                    model_name = model_data.get("name", "")
                    # 从完整路径中提取模型名称
                    if "/" in model_name:
                        model_name = model_name.split("/")[-1]
                    
                    print(f"🔍 处理模型: {model_name}")
                    print(f"🔍 模型完整信息: {json.dumps(model_data, indent=2, ensure_ascii=False)}")
                    
                    # 不过滤模型，显示所有模型以便调试
                    # 获取模型显示名称
                    display_name = model_data.get("displayName", model_name)
                    description = model_data.get("description", "")
                    
                    models.append({
                        "id": f"{model_id_prefix}{model_name}",
                        "name": f"{provider_name} {display_name}",
                        "provider": "gemini",
                        "description": description
                    })
                
                print(f"🔍 最终返回 {len(models)} 个模型")
                return models
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Gemini网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取Gemini模型列表时出错: {e}")
    
    def _get_aliyun_models(self, api_key: str, base_url: str, models_endpoint: str, model_id_prefix: str, provider_name: str) -> List[Dict[str, Any]]:
        """获取阿里云模型列表，包括聊天模型和嵌入模型"""
        try:
            if not api_key:
                raise ValueError("需要API密钥才能获取阿里云模型列表")
            
            models = []
            headers = {"Authorization": f"Bearer {api_key}"}
            
            # 1. 获取聊天模型列表
            try:
                response = requests.get(f"{base_url}{models_endpoint}", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        # 过滤掉嵌入模型，因为它们需要不同的API端点
                        if not model_id.startswith("text-embedding"):
                            models.append({
                                "id": f"{model_id_prefix}{model_id}",
                                "name": f"{provider_name} {model_id}",
                                "provider": "aliyun",
                                "type": "chat"
                            })
            except Exception as e:
                print(f"获取阿里云聊天模型失败: {e}")
            
            # 2. 添加阿里云嵌入模型（根据官方文档）
            embedding_models = [
                {
                    "id": f"{model_id_prefix}text-embedding-v4",
                    "name": f"{provider_name} text-embedding-v4",
                    "provider": "aliyun",
                    "type": "embedding",
                    "description": "阿里云文本嵌入模型v4，支持多种向量维度"
                },
                {
                    "id": f"{model_id_prefix}text-embedding-v3",
                    "name": f"{provider_name} text-embedding-v3",
                    "provider": "aliyun",
                    "type": "embedding",
                    "description": "阿里云文本嵌入模型v3，支持多种向量维度"
                },
                {
                    "id": f"{model_id_prefix}text-embedding-v2",
                    "name": f"{provider_name} text-embedding-v2",
                    "provider": "aliyun",
                    "type": "embedding",
                    "description": "阿里云文本嵌入模型v2，向量维度1536"
                },
                {
                    "id": f"{model_id_prefix}text-embedding-v1",
                    "name": f"{provider_name} text-embedding-v1",
                    "provider": "aliyun",
                    "type": "embedding",
                    "description": "阿里云文本嵌入模型v1"
                }
            ]
            
            models.extend(embedding_models)
            
            print(f"🔍 阿里云找到 {len(models)} 个模型（包括嵌入模型）")
            return models
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"阿里云网络请求失败: {e}")
        except Exception as e:
            raise Exception(f"获取阿里云模型列表时出错: {e}")
    
    def filter_models(self, *args):
        """根据搜索框内容过滤模型列表"""
        search_term = self.search_var.get().lower().strip()
        
        # 清空当前显示的列表
        self.model_listbox.delete(0, tk.END)
        
        # 如果没有搜索词，显示所有模型
        if not search_term:
            for model in self.all_models:
                model_name = model.get('name', '')
                self.model_listbox.insert(tk.END, model_name)
            return
        
        # 过滤模型
        filtered_count = 0
        for model in self.all_models:
            model_name = model.get('name', '').lower()
            model_id = model.get('id', '').lower()
            
            # 检查搜索词是否在模型名称或ID中
            if search_term in model_name or search_term in model_id:
                self.model_listbox.insert(tk.END, model.get('name', ''))
                filtered_count += 1
        
        # 更新状态栏
        if filtered_count == 0:
            self.status_var.set(f"没有找到匹配的模型")
        else:
            self.status_var.set(f"找到 {filtered_count} 个匹配的模型")
    
    def get_filtered_models(self) -> List[Dict[str, Any]]:
        """获取当前过滤后的模型列表"""
        search_term = self.search_var.get().lower().strip()
        
        # 如果没有搜索词，返回所有模型
        if not search_term:
            return self.all_models
        
        # 返回过滤后的模型
        filtered_models = []
        for model in self.all_models:
            model_name = model.get('name', '').lower()
            model_id = model.get('id', '').lower()
            
            if search_term in model_name or search_term in model_id:
                filtered_models.append(model)
        
        return filtered_models
    
    def add_selected_model(self):
        """添加选中的模型"""
        selected_indices = self.model_listbox.curselection()
        if not selected_indices:
            messagebox.showwarning("警告", "请先选择一个模型")
            return
        
        selected_index = selected_indices[0]
        
        # 检查当前选中的选项卡
        selected_tab = self.provider_notebook.select()
        tab_text = self.provider_notebook.tab(selected_tab, "text")
        
        try:
            # 使用过滤后的模型列表，但需要获取原始模型信息
            filtered_models = self.get_filtered_models()
            if selected_index < len(filtered_models):
                selected_model = filtered_models[selected_index]
                model_id = selected_model.get('id', '')
                model_provider = selected_model.get('provider', '')
                
                if tab_text == "预设提供商":
                    # 处理预设提供商
                    provider_index = self.provider_combo.current()
                    
                    if provider_index < 0:
                        messagebox.showwarning("警告", "请先选择一个提供商")
                        return
                    
                    providers = self.presets.get('providers', {})
                    provider_ids = list(providers.keys())
                    provider_id = provider_ids[provider_index]
                    
                    # 获取API密钥
                    api_key = None
                    if not providers[provider_id].get('is_local', False):
                        api_key = self.api_key_var.get().strip()
                        # 如果当前输入框为空，尝试使用已保存的API密钥
                        if not api_key:
                            saved_api_key = providers[provider_id].get('saved_api_key', '')
                            if saved_api_key:
                                api_key = saved_api_key
                    
                    if self.add_model_to_config(provider_id, model_id, api_key):
                        messagebox.showinfo("成功", f"已添加模型: {selected_model.get('name', model_id)}")
                        self.refresh_config()
                    else:
                        messagebox.showerror("错误", "添加模型失败")
                
                elif tab_text == "自定义提供商":
                    # 处理自定义提供商
                    if model_provider == "custom":
                        # 从选中的模型中获取信息
                        base_url = selected_model.get('base_url', '')
                        api_key = selected_model.get('api_key', '')
                        
                        if self.add_custom_model_to_config(model_id, base_url, api_key):
                            messagebox.showinfo("成功", f"已添加自定义模型: {selected_model.get('name', model_id)}")
                            self.refresh_config()
                        else:
                            messagebox.showerror("错误", "添加自定义模型失败")
                    else:
                        messagebox.showerror("错误", "无效的自定义提供商模型")
                
        except Exception as e:
            messagebox.showerror("错误", f"添加模型时出错: {e}")
    
    def add_model_to_config(self, provider_id: str, model_id: str, api_key: str = None) -> bool:
        """将模型添加到配置中"""
        providers = self.presets.get('providers', {})
        if provider_id not in providers:
            return False
        
        provider_info = providers[provider_id]
        
        # 需要使用openai前缀的提供商列表
        openai_prefix_providers = ["deepseek", "aliyun", "zhipuai", "siliconflow", "kimi"]
        
        # 处理模型ID前缀
        final_model_id = model_id
        if provider_id in openai_prefix_providers:
            # 如果当前模型ID不是以openai/开头，则替换前缀
            if not model_id.startswith("openai/"):
                # 移除原有的前缀（如果有）
                if "/" in model_id:
                    model_name_only = model_id.split("/", 1)[1]
                else:
                    model_name_only = model_id
                final_model_id = f"openai/{model_name_only}"
        
        # 构建模型配置 - 修复格式问题
        model_config = {
            "model_name": final_model_id,  # model_name 应该在顶层
            "litellm_params": {
                "model": final_model_id
            }
        }
        
        # 添加API密钥（如果不是本地模型）
        if not provider_info.get('is_local', False) and api_key:
            model_config["litellm_params"]["api_key"] = api_key
        
        # 添加base_url（如果存在）
        base_url = provider_info.get('base_url', '')
        if base_url:
            model_config["litellm_params"]["api_base"] = base_url
        
        # 检查是否已存在
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        for existing_model in model_list:
            if existing_model.get("model_name") == final_model_id:
                messagebox.showwarning("警告", f"模型 {final_model_id} 已存在于配置中")
                return False
        
        # 添加到配置
        model_list.append(model_config)
        self.current_config["model_list"] = model_list
        
        return True
    
    def add_custom_model_to_config(self, model_id: str, base_url: str, api_key: str) -> bool:
        """将自定义模型添加到配置中"""
        # 确保模型ID使用openai/前缀
        final_model_id = model_id
        if not model_id.startswith("openai/"):
            final_model_id = f"openai/{model_id}"
        
        # 构建模型配置
        model_config = {
            "model_name": final_model_id,  # model_name 应该在顶层
            "litellm_params": {
                "model": final_model_id
            }
        }
        
        # 添加API密钥（如果提供）
        if api_key:
            model_config["litellm_params"]["api_key"] = api_key
        
        # 添加base_url（如果提供）
        if base_url:
            model_config["litellm_params"]["api_base"] = base_url
        
        # 添加model_info，标记为自定义提供商
        model_config["model_info"] = {
            "provider": "openaicompatible"
        }
        
        # 检查是否已存在
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        for existing_model in model_list:
            if existing_model.get("model_name") == final_model_id:
                messagebox.showwarning("警告", f"模型 {final_model_id} 已存在于配置中")
                return False
        
        # 添加到配置
        model_list.append(model_config)
        self.current_config["model_list"] = model_list
        
        return True
    
    def remove_selected_model(self):
        """删除选中的模型"""
        selected_items = self.config_tree.selection()
        if not selected_items:
            messagebox.showwarning("警告", "请先选择一个模型")
            return
        
        selected_item = selected_items[0]
        model_name = self.config_tree.item(selected_item, "text")
        
        if messagebox.askyesno("确认", f"确定要删除模型 '{model_name}' 吗？"):
            if self.remove_model_from_config(model_name):
                messagebox.showinfo("成功", f"已删除模型: {model_name}")
                self.refresh_config()
            else:
                messagebox.showerror("错误", "删除模型失败")
    
    def remove_model_from_config(self, model_name: str) -> bool:
        """从配置中移除模型"""
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        original_length = len(model_list)
        
        # 过滤掉要删除的模型
        model_list = [model for model in model_list
                     if model.get("model_name") != model_name]
        
        if len(model_list) == original_length:
            return False
        
        self.current_config["model_list"] = model_list
        return True
    
    def refresh_config(self):
        """刷新当前配置显示"""
        # 清空树形控件
        for item in self.config_tree.get_children():
            self.config_tree.delete(item)
        
        # 添加配置的模型
        model_list = self.current_config.get("model_list", [])
        # 确保model_list是一个列表，而不是None
        if model_list is None:
            model_list = []
        
        for model in model_list:
            model_name = model.get("model_name", "")
            litellm_params = model.get("litellm_params", {})
            model_info = model.get("model_info", {})
            
            # 尝试从model_info获取提供商，如果没有则从api_base推断
            provider = model_info.get("provider", "")
            if not provider:
                # 从api_base推断提供商
                api_base = litellm_params.get("api_base", "")
                provider = self._infer_provider_from_api_base(api_base)
            elif provider == "openaicompatible":
                # 如果是自定义提供商，显示为"自定义提供商"
                provider = "自定义提供商"
            
            model_id = litellm_params.get("model", model_name)
            
            self.config_tree.insert("", "end", text=model_name, values=(provider, model_id))
    
    def _infer_provider_from_api_base(self, api_base: str) -> str:
        """根据api_base推断提供商"""
        if not api_base:
            return "未知"
        
        # 定义API基础URL与提供商的映射
        provider_mapping = {
            "api.deepseek.com": "DeepSeek",
            "dashscope.aliyuncs.com": "阿里云",
            "open.bigmodel.cn": "智谱AI",
            "api.siliconflow.cn": "硅基流动",
            "api.moonshot.cn": "Kimi",
            "openrouter.ai": "OpenRouter",
            "127.0.0.1:11434": "Ollama",
            "localhost:11434": "Ollama",
            "generativelanguage.googleapis.com": "Google Gemini"
        }
        
        # 检查API基础URL中是否包含已知提供商的域名
        for domain, provider_name in provider_mapping.items():
            if domain in api_base:
                return provider_name
        
        # 如果没有匹配到已知提供商，返回"未知"
        return "未知"
    
    def save_config(self):
        """保存配置"""
        # 保存主配置文件
        if self._save_config():
            # 同时保存API密钥到预设文件
            self._save_api_keys_to_presets()
            if self._save_presets():
                messagebox.showinfo("成功", "配置已保存")
                self.status_var.set("配置已保存")
            else:
                messagebox.showwarning("警告", "主配置已保存，但API密钥保存失败")
                self.status_var.set("配置已保存（API密钥保存失败）")
        else:
            messagebox.showerror("错误", "保存配置失败")
    
    def save_and_exit(self):
        """保存配置并退出"""
        # 保存主配置文件
        if self._save_config():
            # 同时保存API密钥到预设文件
            self._save_api_keys_to_presets()
            if self._save_presets():
                # 保存成功，退出程序
                self.root.quit()
            else:
                # API密钥保存失败，询问用户是否仍要退出
                result = messagebox.askyesno("确认", "主配置已保存，但API密钥保存失败。\n是否仍要退出？")
                if result:
                    self.root.quit()
        else:
            # 保存失败，询问用户是否仍要退出
            result = messagebox.askyesno("确认", "配置保存失败。\n是否仍要退出？")
            if result:
                self.root.quit()
    
    def _save_api_keys_to_presets(self):
        """将当前输入的API密钥保存到预设配置中"""
        selected_index = self.provider_combo.current()
        if selected_index < 0:
            return
            
        providers = self.presets.get('providers', {})
        provider_ids = list(providers.keys())
        
        if selected_index < len(provider_ids):
            provider_id = provider_ids[selected_index]
            provider_info = providers[provider_id]
            
            # 只为非本地提供商保存API密钥
            if not provider_info.get('is_local', False):
                api_key = self.api_key_var.get().strip()
                if api_key:
                    # 在提供商配置中添加或更新saved_api_key字段
                    provider_info['saved_api_key'] = api_key
    
    def run(self):
        """运行GUI应用"""
        self.root.mainloop()

def main():
    """主函数"""
    try:
        app = ConfigManagerGUI()
        app.run()
    except Exception as e:
        messagebox.showerror("错误", f"程序运行出错: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()