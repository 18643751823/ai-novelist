from langgraph.types import Command
from langchain_core.messages import HumanMessage
from ai_agent.config import State


def main_loop(graph,cleanup_function=None):
    # 主循环
    while True:
        print("\n请选择操作:")
        print("1. 开始对话")
        print("2. 清理对话数据")
        print("3. 触发对话总结")
        print("4. 退出")
    
        main_choice = input("\n请输入选择 (1-4): ").strip()
    
        if main_choice == "1":
            user_id = input("请输入用户ID: ")
            user_rollback_choice=input("是否回档？1/2")
            if user_rollback_choice =="1":
                # 使用用户输入的user_id来获取检查点历史
                user_config = {"configurable": {"thread_id": user_id}}
                states = list(graph.get_state_history(user_config))
                print("\n可用的回档点:")
                for index, state in enumerate(states):
                    print(f"[{index}] {state.next}")
                    print(f"    检查点ID: {state.config['configurable']['checkpoint_id']}")
                
                    # 显示最后一条消息内容
                    messages = state.values.get("messages", [])
                    if messages:
                        last_message = messages[-1]
                        message_type = last_message.type if hasattr(last_message, 'type') else 'unknown'
                        content = last_message.content if hasattr(last_message, 'content') else str(last_message)
                    
                        # 如果是工具调用，显示工具信息
                        if message_type == 'ai' and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                            tool_names = [tc.get('name', 'unknown') for tc in last_message.tool_calls]
                            content = f"工具调用: {', '.join(tool_names)}"
                    
                        print(f"    最后消息: [{message_type}] {content[:80]}{'...' if len(content) > 80 else ''}")
                    else:
                        print("    最后消息: [无消息]")
                    print()
                # 选择回档点
                user_rollback_id=int(input("选择回档点开始创建分支"))
                # 打印该存档点信息
                selected_state = states[user_rollback_id]
                print(selected_state.next)
                print(selected_state.values)
                # 只允许从非tools检查点回档
                # 如果没有中断或工具调用，继续正常对话
            
                user_rollback_update=input("请输入覆盖信息：")
                # 更新状态：获取整个消息列表，去掉最后一条用户信息，添加新的用户消息
                current_messages = selected_state.values.get("messages", [])
            
                # 如果消息列表为空，直接添加新消息
                if not current_messages:
                    new_messages = [HumanMessage(content=user_rollback_update)]
                else:
                    # 检查最后一条消息是否是用户消息
                    last_message = current_messages[-1]
                    if hasattr(last_message, 'type') and last_message.type == 'human':
                        # 如果最后一条是用户消息，替换它
                        new_messages = current_messages[:-1] + [HumanMessage(content=user_rollback_update)]
                    else:
                        # 如果最后一条不是用户消息，直接添加新消息
                        new_messages = current_messages + [HumanMessage(content=user_rollback_update)]
            
                # 用整个新状态替换原本的旧状态
                new_config = graph.update_state(selected_state.config, values={"messages": new_messages})
                print(f"更新成功{new_config}")
                # 触发回复

                # 使用流式传输处理回档响应
                print("回档响应:")
                for chunk in graph.stream(None, new_config, stream_mode="updates"):
                    print(chunk)
                rollback_response = graph.get_state(new_config)
                print(f"回档完成，当前状态: {rollback_response}")
            else:
                print("从上次退出点，继续对话")
                # 动态设置thread_id，支持多用户
                config = {"configurable": {"thread_id": user_id}}
            
                # 获取当前状态以保持对话历史
                current_state = graph.get_state(config)
                current_messages = current_state.values.get("messages", [])
                current_summary = current_state.values.get("summary", "")
                
                # 显示当前总结（如果有）
                if current_summary:
                    print(f"\n📝 当前对话总结: {current_summary}")
                
                # 询问是否删除消息
                delete_choice = input("是否删除消息后再对话？(1=是, 2=否): ").strip()
                
                if delete_choice == "1":
                    # 显示当前消息列表
                    print("\n当前消息历史:")
                    for i, msg in enumerate(current_messages):
                        msg_type = msg.type if hasattr(msg, 'type') else 'unknown'
                        msg_content = msg.content if hasattr(msg, 'content') else str(msg)
                        print(f"  [{i}] ID: {msg.id} | {msg_type}: {msg_content[:50]}{'...' if len(msg_content) > 50 else ''}")
                    
                    # 询问要删除的消息ID
                    delete_ids_input = input("请输入要删除的消息ID（多个ID用逗号分隔，或输入'all'删除所有）: ").strip()
                    
                    if delete_ids_input.lower() == 'all':
                        # 使用自定义删除指令删除所有消息
                        delete_instruction = HumanMessage(content="/delete all")
                        updated_messages = current_messages + [delete_instruction]
                        
                        # 调用图，条件边会自动路由到自定义删除节点
                        result = graph.invoke(
                            {"messages": updated_messages},
                            config
                        )
                        print("已删除所有消息")
                        current_messages = result["messages"]
                    else:
                        # 删除指定消息
                        delete_ids = [id.strip() for id in delete_ids_input.split(',')]
                        
                        # 为每个要删除的消息创建删除指令
                        for msg_id in delete_ids:
                            try:
                                index = int(msg_id)
                                if 0 <= index < len(current_messages):
                                    # 使用自定义删除指令删除特定索引的消息
                                    delete_instruction = HumanMessage(content=f"/delete index {index}")
                                    updated_messages = current_messages + [delete_instruction]
                                    
                                    # 调用图，条件边会自动路由到自定义删除节点
                                    result = graph.invoke(
                                        {"messages": updated_messages},
                                        config
                                    )
                                    current_messages = result["messages"]
                                    print(f"已删除索引 {index} 的消息")
                                else:
                                    print(f"无效的消息索引: {index}")
                            except ValueError:
                                print(f"无效的消息ID格式: {msg_id}")
                        
                        continue
                
                # 进行对话
                user_input = input("请输入对话文本: ")
                # 将新消息添加到现有消息列表中
                updated_messages = current_messages + [HumanMessage(content=user_input)]
                input_state = State(messages=updated_messages)
            
                # 使用流式传输处理对话响应
                print("AI响应:")
                for chunk in graph.stream(input_state, config, stream_mode="updates"):
                    print(chunk)
                result = graph.get_state(config)
                print(f"对话完成，当前状态: {result}")
        
                # 处理工具中断循环
                while hasattr(result, 'interrupts') and result.interrupts:
                    print(f"工具中断: {result}")
                    for interrupt in result.interrupts:
                        print(f"中断信息: {interrupt.value}")
                    
                    choice_action = input("请选择操作 (1=恢复, 2=取消): ").strip()
                    choice_data = input("请输入附加信息: ").strip()
                    
                    human_response = Command(
                        resume= {
                            "choice_action": choice_action,
                            "choice_data": choice_data
                        }
                    )
                    # 使用流式传输处理中断响应
                    print("中断响应:")
                    for chunk in graph.stream(human_response, config, stream_mode="updates"):
                        print(chunk)
                    result = graph.get_state(config)
                    print(f"工具中断处理完成，当前状态: {result}")
    
        elif main_choice == "2":
            if cleanup_function:
                cleanup_function()
            else:
                print("清理功能不可用")
    
        elif main_choice == "3":
            # 触发对话总结
            user_id = input("请输入用户ID: ")
            config = {"configurable": {"thread_id": user_id}}
            
            # 获取当前状态
            current_state = graph.get_state(config)
            current_messages = current_state.values.get("messages", [])
            current_summary = current_state.values.get("summary", "")
            
            if not current_messages:
                print("没有对话历史可总结")
                continue
                
            # 显示当前总结（如果有）
            if current_summary:
                print(f"\n📝 当前对话总结: {current_summary}")
            
            # 使用总结指令触发总结
            summarize_instruction = HumanMessage(content="/summarize")
            updated_messages = current_messages + [summarize_instruction]
            input_state = State(messages=updated_messages)
            print(input_state)
            print("正在生成对话总结...")
            # 使用流式传输处理总结响应
            print("总结生成中...")
            for chunk in graph.stream(input_state, config, stream_mode="updates"):
                print(chunk)
            result = graph.get_state(config)
            
            # 显示更新后的总结
            updated_state = graph.get_state(config)
            updated_summary = updated_state.values.get("summary", "")
            if updated_summary:
                print(f"\n📝 更新后的对话总结: {updated_summary}")
            else:
                print("总结生成失败")
        
        elif main_choice == "4":
            print("程序退出")
            break

        else:
            print("无效选择，请重新输入")