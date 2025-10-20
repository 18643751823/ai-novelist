const { ipcMain } = require('electron');
const intentAnalyzer = require('./IntentAnalyzer');
const retriever = require('./retriever');

/**
 * 意图分析IPC处理器 - 提供前端控制意图分析的功能
 */
class IntentAnalysisIpcHandler {
    constructor() {
        if (IntentAnalysisIpcHandler.instance) {
            return IntentAnalysisIpcHandler.instance;
        }
        
        this.isInitialized = false;
        IntentAnalysisIpcHandler.instance = this;
    }

    /**
     * 初始化IPC处理器
     * @param {Object} store electron-store实例
     */
    initialize(store) {
        if (this.isInitialized) {
            return;
        }

        console.log('[IntentAnalysisIpcHandler] 初始化IPC处理器...');

        // 注册IPC处理器
        this.registerHandlers();

        this.isInitialized = true;
        console.log('[IntentAnalysisIpcHandler] IPC处理器初始化完成');
    }

    /**
     * 注册IPC消息处理器
     */
    registerHandlers() {
        // 获取可用的标签类别
        ipcMain.handle('get-intent-analysis-tags', async () => {
            try {
                const tags = intentAnalyzer.getAvailableTags();
                return { success: true, tags };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取标签失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 设置意图分析启用状态
        ipcMain.handle('set-intent-analysis-enabled', async (event, enabled) => {
            try {
                retriever.setIntentAnalysis(enabled);
                return { success: true, enabled };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 设置启用状态失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 获取意图分析启用状态
        ipcMain.handle('get-intent-analysis-enabled', async () => {
            try {
                // 这里需要访问retriever的内部状态，暂时返回true
                return { success: true, enabled: true };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取启用状态失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 设置意图分析模型
        ipcMain.handle('set-intent-analysis-model', async (event, modelId) => {
            try {
                if (!modelId || typeof modelId !== 'string') {
                    return { success: false, error: '无效的模型ID' };
                }

                // 检查模型可用性
                const isAvailable = await intentAnalyzer.checkModelAvailability(modelId);
                if (!isAvailable) {
                    return { success: false, error: `模型 '${modelId}' 不可用或未配置API Key` };
                }

                // 保存到存储
                if (this.store) {
                    this.store.set('intentAnalysisModel', modelId);
                }

                console.log(`[IntentAnalysisIpcHandler] 设置意图分析模型: ${modelId}`);
                return { success: true, modelId };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 设置模型失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 获取当前意图分析模型
        ipcMain.handle('get-intent-analysis-model', async () => {
            try {
                const modelId = intentAnalyzer.getDefaultAnalysisModel();
                const isAvailable = await intentAnalyzer.checkModelAvailability(modelId);
                
                return {
                    success: true,
                    modelId,
                    isAvailable
                };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取模型失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 获取所有可用的模型
        ipcMain.handle('get-available-intent-models', async () => {
            try {
                const { getModelRegistry } = require('../engine/models/modelProvider');
                const modelRegistry = getModelRegistry();
                
                // 获取所有已注册的模型
                const allModels = [];
                for (const [modelId, adapterName] of Object.entries(modelRegistry.modelMapping)) {
                    const adapter = modelRegistry.adapters[adapterName];
                    if (adapter && adapter.getModelInfo) {
                        try {
                            const modelInfo = adapter.getModelInfo(modelId);
                            allModels.push({
                                id: modelId,
                                name: modelInfo.name || modelId,
                                description: modelInfo.description || '',
                                provider: adapterName
                            });
                        } catch (error) {
                            // 忽略无法获取信息的模型
                            console.log(`[IntentAnalysisIpcHandler] 跳过模型 ${modelId}: ${error.message}`);
                        }
                    }
                }

                return { success: true, models: allModels };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取可用模型失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 设置自定义意图分析提示词
        ipcMain.handle('set-intent-analysis-prompt', async (event, prompt) => {
            try {
                if (typeof prompt !== 'string') {
                    return { success: false, error: '提示词必须是字符串类型' };
                }

                // 设置自定义提示词
                intentAnalyzer.setCustomPrompt(prompt);
                
                console.log(`[IntentAnalysisIpcHandler] 设置自定义意图分析提示词: ${prompt.substring(0, 50)}...`);
                return { success: true, prompt: prompt };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 设置提示词失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 获取当前意图分析提示词
        ipcMain.handle('get-intent-analysis-prompt', async () => {
            try {
                const prompt = intentAnalyzer.getCurrentPrompt();
                return { success: true, prompt };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取提示词失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 重置意图分析提示词为默认值
        ipcMain.handle('reset-intent-analysis-prompt', async () => {
            try {
                intentAnalyzer.resetToDefaultPrompt();
                console.log('[IntentAnalysisIpcHandler] 重置意图分析提示词为默认值');
                return { success: true, prompt: intentAnalyzer.getCurrentPrompt() };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 重置提示词失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 获取意图分析设置（统一数据流管理使用）
        ipcMain.handle('get-intent-analysis-settings', async () => {
            try {
                console.log('[IntentAnalysisIpcHandler] 获取意图分析设置');
                
                // 获取当前意图分析模型
                const modelId = intentAnalyzer.getDefaultAnalysisModel();
                const isAvailable = await intentAnalyzer.checkModelAvailability(modelId);
                const model = isAvailable ? modelId : '';
                
                // 获取当前意图分析提示词
                const prompt = intentAnalyzer.getCurrentPrompt();
                
                // 返回统一格式的设置数据
                return {
                    success: true,
                    model: model,
                    prompt: prompt
                };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 获取意图分析设置失败:', error);
                return { success: false, error: error.message };
            }
        });

        // 测试意图分析功能
        ipcMain.handle('test-intent-analysis', async () => {
            try {
                const { testIntentAnalyzer } = require('./test-intent-analyzer');
                await testIntentAnalyzer();
                return { success: true, message: '测试完成，请查看控制台输出' };
            } catch (error) {
                console.error('[IntentAnalysisIpcHandler] 测试失败:', error);
                return { success: false, error: error.message };
            }
        });
    }

    /**
     * 设置存储实例
     * @param {Object} store electron-store实例
     */
    setStore(store) {
        this.store = store;
    }

    /**
     * 销毁处理器
     */
    destroy() {
        // 移除所有处理器
        ipcMain.removeHandler('get-intent-analysis-tags');
        ipcMain.removeHandler('set-intent-analysis-enabled');
        ipcMain.removeHandler('get-intent-analysis-enabled');
        ipcMain.removeHandler('set-intent-analysis-prompt');
        ipcMain.removeHandler('get-intent-analysis-prompt');
        ipcMain.removeHandler('reset-intent-analysis-prompt');
        ipcMain.removeHandler('test-intent-analysis');
        
        this.isInitialized = false;
        console.log('[IntentAnalysisIpcHandler] 处理器已销毁');
    }
}

module.exports = new IntentAnalysisIpcHandler();