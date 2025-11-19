import httpClient from '../utils/httpClient.js';

/**
 * 工具调用服务 - 处理AI工具调用的用户审批流程
 * 适配新的中断机制
 */
class ToolCallService {
  constructor(dispatch) {
    this.dispatch = dispatch;
  }

  /**
   * 发送中断响应
   * @param {Object} interruptData 中断响应数据
   * @returns {Promise<Object>} 响应结果
   */
  async sendInterruptResponse(interruptData) {
    try {
      const response = await httpClient.post('/api/chat/interrupt-response', {
        interrupt_id: interruptData.interruptId,
        choice: interruptData.choice, // '1'=恢复, '2'=取消
        additional_data: interruptData.additionalData || '',
        thread_id: interruptData.threadId || 'default'
      });
      
      console.log(`中断响应已发送: ${interruptData.interruptId}`, response);
      return response;
    } catch (error) {
      console.error(`发送中断响应失败: ${interruptData.interruptId}`, error);
      throw error;
    }
  }

  /**
   * 处理中断响应
   * @param {string} action 操作类型 ('approve' 或 'reject')
   * @param {Object} interruptInfo 中断信息
   * @param {string} userInput 用户输入
   */
  async handleInterruptResponse(action, interruptInfo, userInput = '') {
    try {
      const choice = action === 'approve' ? '1' : '2';
      
      const response = await this.sendInterruptResponse({
        interruptId: interruptInfo.id,
        choice: choice,
        additionalData: userInput,
        threadId: interruptInfo.sessionId || 'default'
      });
      
      console.log(`中断响应处理完成: ${action}`, response);
      return response;
    } catch (error) {
      console.error(`处理中断响应失败: ${action}`, error);
      throw error;
    }
  }

  /**
   * 解析工具调用参数
   * @param {Object} toolCall 工具调用对象
   * @returns {Object} 解析后的参数
   */
  parseToolArguments(toolCall) {
    try {
      // 直接返回 args
      if (toolCall.args) {
        return toolCall.args;
      }
      
      if (toolCall.function && toolCall.function.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        return args;
      }
      
      if (toolCall.arguments) {
        return toolCall.arguments;
      }
      
      return {};
    } catch (error) {
      console.error('解析工具参数失败:', error, toolCall);
      return { error: '参数解析失败' };
    }
  }

  /**
   * 格式化工具调用显示信息
   * @param {Object} toolCall 工具调用对象
   * @returns {Object} 格式化后的信息
   */
  formatToolCallDisplay(toolCall) {
    const toolName = toolCall.name || toolCall.function?.name;
    const args = this.parseToolArguments(toolCall);
    
    let displayText = '';
    
    switch (toolName) {
      case 'read_file':
        displayText = `读取文件: ${args.file_path || args.path}`;
        if (args.start_paragraph || args.end_paragraph) {
          displayText += ` (段落 ${args.start_paragraph || 1}-${args.end_paragraph || '末尾'})`;
        }
        break;
        
      case 'write_file':
        displayText = `写入文件: ${args.path} (${args.content?.length || 0} 字符)`;
        break;
        
      case 'search_files':
        displayText = `搜索文件: ${args.path} (模式: ${args.regex})`;
        break;
        
      case 'execute_command':
        displayText = `执行命令: ${args.command}`;
        if (args.working_directory) {
          displayText += ` (工作目录: ${args.working_directory})`;
        }
        break;
        
      case 'insert_content':
        displayText = `插入内容到文件: ${args.path} (位置: ${args.paragraph})`;
        break;
        
      case 'search_and_replace':
        displayText = `搜索替换: ${args.path} ("${args.search}" -> "${args.replace}")`;
        break;
        
      case 'apply_diff':
        displayText = `应用差异: ${args.path}`;
        break;
        
      case 'ask_user_question':
        displayText = `向用户提问: ${args.question}`;
        if (args.options) {
          displayText += ` (选项: ${args.options.join(', ')})`;
        }
        break;
        
      default:
        displayText = `执行工具: ${toolName}`;
        if (Object.keys(args).length > 0) {
          displayText += ` (参数: ${JSON.stringify(args)})`;
        }
    }
    
    return {
      toolName,
      displayText,
      arguments: args,
      requestId: toolCall.toolCallId || toolCall.request_id
    };
  }

  /**
   * 从中断信息中提取工具调用
   * @param {Object} interruptInfo 中断信息
   * @returns {Array} 工具调用列表
   */
  extractToolCallsFromInterrupt(interruptInfo) {
    const { reason, value } = interruptInfo;
    
    if (reason === 'tool_call') {
      if (Array.isArray(value)) {
        return value;
      } else if (typeof value === 'object') {
        return [value];
      }
    }
    
    return [];
  }

  /**
   * 检查是否为工具调用中断
   * @param {Object} interruptInfo 中断信息
   * @returns {boolean} 是否为工具调用中断
   */
  isToolCallInterrupt(interruptInfo) {
    return interruptInfo && interruptInfo.reason === 'tool_call';
  }

  /**
   * 检查是否为用户确认中断
   * @param {Object} interruptInfo 中断信息
   * @returns {boolean} 是否为用户确认中断
   */
  isUserConfirmationInterrupt(interruptInfo) {
    return interruptInfo && interruptInfo.reason === 'user_confirmation';
  }

  /**
   * 检查是否为用户提问中断
   * @param {Object} interruptInfo 中断信息
   * @returns {boolean} 是否为用户提问中断
   */
  isAskUserInterrupt(interruptInfo) {
    return interruptInfo && interruptInfo.reason === 'ask_user';
  }
}

export default ToolCallService;