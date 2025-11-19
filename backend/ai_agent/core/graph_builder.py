from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from langchain_core.messages import ToolMessage, AIMessage, SystemMessage, HumanMessage
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
import sys
import os
# 添加父目录到路径，确保可以导入ai_agent模块
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from ..config import ai_settings, State

def build_graph(tool, memory, system_prompt=None, mode=None):
    """构建并返回图实例
    
    Args:
        tool: 工具字典
        memory: 记忆存储
        system_prompt: 系统提示词
        mode: 模式名称，用于工具过滤
    """
    # 从配置中获取当前选择的模型和提供商
    selected_model = ai_settings.DEFAULT_MODEL
    selected_provider = ai_settings._get_config("selectedProvider", "deepseek")
    
    # # 如果模型ID包含提供商信息（如 "zhipuai/glm-4-plus"），则解析提供商和模型名称
    # if "/" in selected_model:
    #     # 从模型ID中解析提供商和模型名称
    #     provider_from_model, model_name = selected_model.split("/", 1)
    #     selected_provider = provider_from_model
    #     selected_model = model_name
    # else:
    #     # 使用配置中的提供商
    #     model_name = selected_model

    # 不要解析，直接使用提供商/模型名形式
    
    print(f"构建图实例 - 模型: {selected_model}, 提供商: {selected_provider}, 模式: {mode}")
    
    # 获取对应提供商的API密钥
    api_key = ai_settings.get_api_key_for_provider(selected_provider)
    
    # 使用ChatOpenAI，连接liteLLM网关
    llm = ChatOpenAI(
        openai_api_base="http://127.0.0.1:4000",
        api_key="sk-123",  # 添加API密钥
        model=selected_model,
        temperature=ai_settings.temperature,
        max_tokens=ai_settings.max_tokens,
        timeout=ai_settings.timeout,
    )
    
    # 绑定工具到模型
    if tool:
        llm_with_tools = llm.bind_tools(list(tool.values()))
        print(f"[INFO] 已绑定 {len(tool)} 个工具到模型")
    else:
        llm_with_tools = llm
        print(f"[WARNING] 没有可用的工具绑定到模型")
    
    # 创建总结模型（限制token数）
    summarization_model = llm.bind(max_tokens=128)
    # 创建模型节点
    def call_llm(state: State):
        """调用LLM生成响应"""
        # 获取当前消息列表
        current_messages = state.get("messages", [])
        
        # 获取模式特定的最大token数
        mode_max_tokens = ai_settings.get_max_tokens_for_mode(mode)
        print(f"最大tokens数被设置为{mode_max_tokens}")
        # 修剪消息历史，避免超出上下文限制
        current_messages = trim_messages(
            current_messages,
            strategy="last",  # 保留最新的消息
            token_counter=count_tokens_approximately,
            max_tokens=mode_max_tokens,  # 使用模式特定的最大token数
            start_on="human",  # 从human消息开始保留
            end_on=("human", "tool"),  # 在human或tool消息结束
        )
        
        # 如果有系统提示词，更新系统消息
        if system_prompt:
            # 过滤掉现有的系统消息
            filtered_messages = [msg for msg in current_messages if not isinstance(msg, SystemMessage)]
            # 添加新的系统消息到开头
            current_messages = [SystemMessage(content=system_prompt)] + filtered_messages
        
        # 调用模型生成响应
        response = llm_with_tools.invoke(current_messages)
        # 手动将新消息添加到现有消息列表中
        updated_messages = current_messages + [response]
        print(f"总消息{updated_messages}")
        return {"messages": updated_messages}
    # 创建工具字典
    tools_by_name = {tool.name: tool for tool in tool.values()}

    # 自定义工具节点
    def tool_node(state: State):
        """执行工具调用"""
        # 获取当前消息列表
        current_messages = state.get("messages", [])
        
        result = []
        # 处理最后一条消息中的工具调用
        for tool_call in state["messages"][-1].tool_calls:
            tool = tools_by_name[tool_call["name"]]
            observation = tool.invoke(tool_call["args"])
            result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
        
        # 手动将工具消息添加到现有消息列表中
        updated_messages = current_messages + result
        
        return {"messages": updated_messages}

    # 自定义删除节点 - 完全替换官方删除机制
    def custom_delete_messages(state: State):
        """自定义删除消息节点 - 完全手动管理消息删除"""
        messages = state["messages"]
        
        # 检查是否有删除指令
        delete_instructions = []
        remaining_messages = []
        
        for msg in messages:
            # 检查是否是删除指令消息
            if isinstance(msg, HumanMessage) and msg.content.startswith("/delete"):
                delete_instructions.append(msg)
            elif isinstance(msg, AIMessage) and hasattr(msg, 'content') and msg.content and msg.content.startswith("删除"):
                delete_instructions.append(msg)
            else:
                remaining_messages.append(msg)
        
        # 如果有删除指令，执行删除逻辑
        if delete_instructions:
            print(f"检测到删除指令，执行删除操作...")
            
            # 分析删除指令类型
            for instruction in delete_instructions:
                content = instruction.content
                
                # 删除所有消息
                if "/delete all" in content.lower() or "删除所有" in content:
                    print("执行清空所有消息操作")
                    remaining_messages = []  # 清空所有消息
                    break
                
                # 删除特定索引的消息
                elif "/delete index" in content.lower() or "删除索引" in content:
                    try:
                        import re
                        match = re.search(r'/delete\s+index\s+(\d+)', content.lower())
                        if match:
                            index = int(match.group(1))
                        else:
                            match = re.search(r'删除索引\s*(\d+)', content)
                            index = int(match.group(1)) if match else -1
                        
                        if 0 <= index < len(remaining_messages):
                            print(f"删除索引 {index} 的消息")
                            remaining_messages.pop(index)
                    except (ValueError, IndexError):
                        print("删除索引无效")
            
            print(f"删除操作完成，剩余 {len(remaining_messages)} 条消息")
        
        return {"messages": remaining_messages}

    # 创建总结节点
    def summarize_conversation(state: State):
        """总结对话历史"""
        # 获取现有总结
        summary = state.get("summary", "")
        
        # 创建总结提示
        if summary:
            # 如果已有总结，扩展它
            summary_message = (
                f"这是到目前为止的对话总结: {summary}\n\n"
                "请根据上面的新消息扩展这个总结:"
            )
        else:
            # 如果是第一次总结，创建新总结
            summary_message = "请为上面的对话创建一个总结:"
        
        # 添加总结提示到消息历史
        messages = state["messages"] + [HumanMessage(content=summary_message)]
        
        # 调用总结模型
        response = summarization_model.invoke(messages)
        
        # 删除除最近2条消息外的所有消息
        delete_messages = state["messages"][:-2]
        
        return {
            "summary": response.content,
            "messages": state["messages"][-2:]  # 保留最近2条消息
        }

    # 构建工作流图
    builder = StateGraph(State)

    # 添加节点
    builder.add_node("call_llm", call_llm)
    builder.add_node("tools", tool_node)  # 使用自定义工具节点函数
    builder.add_node("custom_delete", custom_delete_messages)  # 使用自定义删除节点
    builder.add_node("summarize", summarize_conversation)  # 添加总结节点

    # 条件判断函数 - 决定是执行删除操作、总结操作还是调用LLM
    def route_to_delete_or_llm(state: State):
        """路由到删除节点、总结节点或LLM节点"""
        messages = state["messages"]
        
        # 检查是否有删除指令
        has_delete_instructions = False
        has_summarize_instructions = False
        
        for msg in messages:
            if isinstance(msg, HumanMessage):
                if msg.content.startswith("/delete"):
                    has_delete_instructions = True
                    break
                elif msg.content.startswith("/summarize"):
                    has_summarize_instructions = True
                    break
        
        if has_delete_instructions:
            # 如果有删除指令，执行删除
            return "custom_delete"
        elif has_summarize_instructions:
            # 如果有总结指令，执行总结
            return "summarize"
        else:
            # 否则调用LLM
            return "call_llm"

    # 添加边
    builder.add_edge("tools", "call_llm")
    builder.add_conditional_edges(
        "call_llm",
        tools_condition,
    )
    # 添加从START到删除节点的条件边
    builder.add_conditional_edges(
        START,
        route_to_delete_or_llm,
        {
            "custom_delete": "custom_delete",
            "summarize": "summarize",
            "call_llm": "call_llm"
        }
    )
    # 总结节点执行后继续到LLM
    builder.add_edge("summarize", "call_llm")
    
    # 删除节点执行后结束
    builder.add_edge("custom_delete", END)
    # 编译图时使用SQLite检查点
    graph = builder.compile(checkpointer=memory)
    
    return graph