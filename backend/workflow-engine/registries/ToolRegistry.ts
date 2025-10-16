import { ToolDefinition } from '../types';

/**
 * 工具注册器 - 管理所有可用工具
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具
   */
  getTool(toolName: string): ToolDefinition {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool;
  }

  /**
   * 执行工具
   */
  async executeTool(toolName: string, inputs: Record<string, any>): Promise<any> {
    const tool = this.getTool(toolName);
    return await tool.execute(inputs);
  }

  /**
   * 获取所有工具列表
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * 从现有工具系统加载工具
   * 这里需要集成项目现有的工具定义
   */
  async loadToolsFromExistingSystem(): Promise<void> {
    try {
      // 这里需要集成现有的工具系统
      // 例如从 backend/tool-service/tools/definitions.js 加载工具
      console.log('Loading tools from existing system...');
      
      // 示例：注册一些基础工具
      this.registerTool({
        name: 'search_files',
        description: '搜索文件内容',
        parameters: {
          pattern: { type: 'string', description: '搜索模式' },
          path: { type: 'string', description: '搜索路径' }
        },
        execute: async (inputs) => {
          // 这里需要调用现有的搜索工具
          return { results: [] };
        }
      });

      this.registerTool({
        name: 'execute_command',
        description: '执行系统命令',
        parameters: {
          command: { type: 'string', description: '要执行的命令' }
        },
        execute: async (inputs) => {
          // 这里需要调用现有的命令执行工具
          return { output: '', error: null };
        }
      });

      console.log(`Loaded ${this.tools.size} tools from existing system`);
    } catch (error) {
      console.error('Failed to load tools from existing system:', error);
    }
  }
}

// 创建全局工具注册器实例
export const toolRegistry = new ToolRegistry();