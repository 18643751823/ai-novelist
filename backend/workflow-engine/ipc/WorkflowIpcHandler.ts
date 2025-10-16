import { ipcMain } from 'electron';
import { WorkflowDefinition, WorkflowExecutionResult } from '../types';
import { workflowEngine } from '../index';

/**
 * 工作流IPC处理器 - 处理前端与工作流引擎的通信
 */
export class WorkflowIpcHandler {
  private isInitialized = false;

  /**
   * 初始化IPC处理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化工作流引擎
      await workflowEngine.initialize();

      // 注册IPC处理器
      this.registerIpcHandlers();

      this.isInitialized = true;
      console.log('Workflow IPC handler initialized');

    } catch (error) {
      console.error('Failed to initialize workflow IPC handler:', error);
      throw error;
    }
  }

  /**
   * 注册IPC处理器
   */
  private registerIpcHandlers(): void {
    // 执行工作流
    ipcMain.handle('workflow:execute', async (event, workflow: WorkflowDefinition, inputs: Record<string, any> = {}) => {
      try {
        const result = await workflowEngine.executeWorkflow(workflow, inputs);
        return { success: true, data: result };
      } catch (error) {
        console.error('Workflow execution failed:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // 验证工作流
    ipcMain.handle('workflow:validate', async (event, workflow: WorkflowDefinition) => {
      try {
        const validation = workflowEngine.validateWorkflow(workflow);
        return { success: true, data: validation };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Validation failed' 
        };
      }
    });

    // 获取支持的节点类型
    ipcMain.handle('workflow:getNodeTypes', async () => {
      try {
        const nodeTypes = workflowEngine.getSupportedNodeTypes();
        return { success: true, data: nodeTypes };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get node types' 
        };
      }
    });

    // 获取可用工具
    ipcMain.handle('workflow:getTools', async () => {
      try {
        const tools = workflowEngine.getAvailableTools();
        return { success: true, data: tools };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get tools' 
        };
      }
    });

    // 检查工具是否存在
    ipcMain.handle('workflow:hasTool', async (event, toolName: string) => {
      try {
        const exists = workflowEngine.hasTool(toolName);
        return { success: true, data: exists };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to check tool' 
        };
      }
    });

    // 保存工作流
    ipcMain.handle('workflow:save', async (event, workflow: WorkflowDefinition) => {
      try {
        // 这里需要实现工作流保存逻辑
        // 可以保存到文件系统或数据库
        console.log('Saving workflow:', workflow.id);
        
        // 临时实现：返回成功
        return { success: true, data: { id: workflow.id, saved: true } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to save workflow' 
        };
      }
    });

    // 加载工作流
    ipcMain.handle('workflow:load', async (event, workflowId: string) => {
      try {
        // 这里需要实现工作流加载逻辑
        console.log('Loading workflow:', workflowId);
        
        // 临时实现：返回空数据
        return { 
          success: true, 
          data: null // 在实际实现中返回工作流数据
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to load workflow' 
        };
      }
    });

    // 获取工作流列表
    ipcMain.handle('workflow:list', async () => {
      try {
        // 这里需要实现工作流列表获取逻辑
        console.log('Getting workflow list');
        
        // 临时实现：返回空列表
        return { success: true, data: [] };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get workflow list' 
        };
      }
    });

    // 删除工作流
    ipcMain.handle('workflow:delete', async (event, workflowId: string) => {
      try {
        // 这里需要实现工作流删除逻辑
        console.log('Deleting workflow:', workflowId);
        
        return { success: true, data: { id: workflowId, deleted: true } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to delete workflow' 
        };
      }
    });

    // 获取工作流执行状态
    ipcMain.handle('workflow:status', async (event, executionId: string) => {
      try {
        // 这里需要实现执行状态查询逻辑
        console.log('Getting workflow status:', executionId);
        
        return { 
          success: true, 
          data: { 
            executionId, 
            status: 'completed', // 或其他状态
            progress: 100 
          } 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get workflow status' 
        };
      }
    });

    console.log('Workflow IPC handlers registered');
  }

  /**
   * 注销IPC处理器
   */
  unregisterIpcHandlers(): void {
    // 注销所有工作流相关的IPC处理器
    const handlers = [
      'workflow:execute',
      'workflow:validate', 
      'workflow:getNodeTypes',
      'workflow:getTools',
      'workflow:hasTool',
      'workflow:save',
      'workflow:load',
      'workflow:list',
      'workflow:delete',
      'workflow:status'
    ];

    handlers.forEach(handler => {
      ipcMain.removeHandler(handler);
    });

    console.log('Workflow IPC handlers unregistered');
  }
}

// 创建全局IPC处理器实例
export const workflowIpcHandler = new WorkflowIpcHandler();