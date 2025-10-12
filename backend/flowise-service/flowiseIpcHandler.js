const flowiseService = require('./index');
const logger = require('../utils/logger');

/**
 * Flowise IPC 处理器
 */
class FlowiseIpcHandler {
    /**
     * 注册所有 Flowise 相关的 IPC 处理器
     */
    static registerIpcHandlers(ipcMain, mainWindow) {
        console.log('[FlowiseIpcHandler] 注册 Flowise IPC 处理器');

        // 设置 Flowise 服务的事件处理器
        flowiseService.setEventHandler('onStatusChange', (status) => {
            console.log('[FlowiseIpcHandler] 收到服务状态变化:', status);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('flowise-service-status-update', status);
            }
        });

        // 启动 Flowise 服务
        ipcMain.handle('flowise-start-service', async () => {
            try {
                console.log('[FlowiseIpcHandler] 收到启动 Flowise 服务请求');
                const result = await flowiseService.start();
                return result;
            } catch (error) {
                console.error('[FlowiseIpcHandler] 启动 Flowise 服务失败:', error);
                return { success: false, message: error.message };
            }
        });

        // 停止 Flowise 服务
        ipcMain.handle('flowise-stop-service', async () => {
            try {
                console.log('[FlowiseIpcHandler] 收到停止 Flowise 服务请求');
                const result = await flowiseService.stop();
                return result;
            } catch (error) {
                console.error('[FlowiseIpcHandler] 停止 Flowise 服务失败:', error);
                return { success: false, message: error.message };
            }
        });

        // 获取服务状态
        ipcMain.handle('flowise-get-status', async () => {
            try {
                const status = await flowiseService.getStatus();
                return { success: true, status };
            } catch (error) {
                console.error('[FlowiseIpcHandler] 获取 Flowise 服务状态失败:', error);
                return { success: false, message: error.message };
            }
        });

        // 重启服务
        ipcMain.handle('flowise-restart-service', async () => {
            try {
                console.log('[FlowiseIpcHandler] 收到重启 Flowise 服务请求');
                const result = await flowiseService.restart();
                return result;
            } catch (error) {
                console.error('[FlowiseIpcHandler] 重启 Flowise 服务失败:', error);
                return { success: false, message: error.message };
            }
        });

        // 检查服务健康状态
        ipcMain.handle('flowise-check-health', async () => {
            try {
                const isHealthy = await flowiseService.checkServiceHealth();
                return { success: true, isHealthy };
            } catch (error) {
                console.error('[FlowiseIpcHandler] 检查 Flowise 服务健康状态失败:', error);
                return { success: false, message: error.message };
            }
        });

        // 获取工作流列表
        ipcMain.handle('flowise-get-workflows', async () => {
            try {
                const status = await flowiseService.getStatus();
                
                if (status.status !== 'running') {
                    return { success: false, message: 'Flowise 服务未运行', workflows: [] };
                }

                // 这里可以调用 Flowise API 获取工作流列表
                // 暂时返回空列表，后续实现
                return { success: true, workflows: [] };
            } catch (error) {
                console.error('[FlowiseIpcHandler] 获取工作流列表失败:', error);
                return { success: false, message: error.message, workflows: [] };
            }
        });

        console.log('[FlowiseIpcHandler] Flowise IPC 处理器注册完成');
    }

    /**
     * 清理 IPC 处理器
     */
    static cleanupIpcHandlers(ipcMain) {
        const handlers = [
            'flowise-start-service',
            'flowise-stop-service', 
            'flowise-get-status',
            'flowise-restart-service',
            'flowise-check-health',
            'flowise-get-workflows'
        ];

        handlers.forEach(handler => {
            ipcMain.removeHandler(handler);
        });

        console.log('[FlowiseIpcHandler] Flowise IPC 处理器已清理');
    }
}

module.exports = FlowiseIpcHandler;