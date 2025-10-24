const { ipcMain, dialog } = require('electron');
const knowledgeBaseManager = require('../../rag-service/knowledgeBaseManager');
const ragIpcHandler = require('../../rag-service/ragIpcHandler');
const intentAnalysisIpcHandler = require('../../rag-service/IntentAnalysisIpcHandler');
const { state } = require('../../../state-manager');

let storeInstance = null;

// 新增：处理添加文件到知识库的请求
const handleAddFileToKb = async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(state.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }
            ]
        });

        if (canceled || !filePaths || filePaths.length === 0) {
            return { success: false, message: '用户取消了文件选择。' };
        }

        const filePath = filePaths[0];
        const result = await knowledgeBaseManager.addFileToKnowledgeBase(filePath);
        return result;

    } catch (error) {
        console.error('[ragHandlers.js] 添加文件到知识库失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理列出知识库文件请求
const handleListKbFiles = async () => {
    try {
        const result = await knowledgeBaseManager.listFiles();
        return { success: true, files: result };
    } catch (error) {
        console.error('[ragHandlers.js] 列出知识库文件失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理删除知识库文件请求
const handleDeleteKbFile = async (event, filename) => {
    try {
        const result = await knowledgeBaseManager.deleteFile(filename);
        return result;
    } catch (error) {
        console.error('[ragHandlers.js] 删除知识库文件失败:', error);
        return { success: false, error: error.message };
    }
};

// 新增：处理重命名知识库文件请求
const handleRenameKbFile = async (event, oldFilename, newFilename) => {
    try {
        const result = await knowledgeBaseManager.renameFile(oldFilename, newFilename);
        return result;
    } catch (error) {
        console.error('[ragHandlers.js] 重命名知识库文件失败:', error);
        return { success: false, error: error.message };
    }
};

// 设置存储实例
const setStoreInstance = (store) => {
    storeInstance = store;
    
    // 设置存储实例给RAG相关服务（实现API key自动加载）
    if (knowledgeBaseManager) {
        knowledgeBaseManager.setStore(store);
    }
    if (ragIpcHandler) {
        ragIpcHandler.setStore(store);
    }
    
    if (intentAnalysisIpcHandler) {
        intentAnalysisIpcHandler.setStore(store);
        intentAnalysisIpcHandler.initialize(store);
    }
    
    // 设置IntentAnalyzer的存储实例
    const intentAnalyzer = require('../../../rag-service/IntentAnalyzer');
    if (intentAnalyzer && intentAnalyzer.setStore) {
        intentAnalyzer.setStore(store);
    }
};

// 注册RAG相关IPC处理器
function registerRagHandlers() {
    console.log('[ragHandlers.js] 注册RAG相关IPC处理器...');
    
    ipcMain.handle('add-file-to-kb', handleAddFileToKb); // 新增：注册添加文件到知识库的处理器
    ipcMain.handle('list-kb-files', handleListKbFiles); // 新增：注册列出知识库文件处理器
    ipcMain.handle('delete-kb-file', handleDeleteKbFile); // 新增：注册删除知识库文件处理器
    ipcMain.handle('rename-kb-file', handleRenameKbFile); // 新增：注册重命名知识库文件处理器
    
    // RAG嵌入函数处理器
    ipcMain.handle('reinitialize-embedding-function', ragIpcHandler.reinitializeEmbeddingFunction.bind(ragIpcHandler));
    ipcMain.handle('set-embedding-dimensions', ragIpcHandler.setEmbeddingDimensions.bind(ragIpcHandler));
    ipcMain.handle('get-embedding-dimensions', ragIpcHandler.getEmbeddingDimensions.bind(ragIpcHandler));
    ipcMain.handle('set-embedding-model', ragIpcHandler.setEmbeddingModel.bind(ragIpcHandler));
    
    // RAG分段参数处理器
    ipcMain.handle('set-rag-chunk-settings', ragIpcHandler.setRagChunkSettings.bind(ragIpcHandler));
    ipcMain.handle('get-rag-chunk-settings', ragIpcHandler.getRagChunkSettings.bind(ragIpcHandler));

    // 检索设置处理器
    ipcMain.handle('set-retrieval-top-k', ragIpcHandler.setRetrievalTopK.bind(ragIpcHandler));
    ipcMain.handle('get-retrieval-top-k', ragIpcHandler.getRetrievalTopK.bind(ragIpcHandler));

    // RAG相关IPC处理器
    ipcMain.handle('get-embedding-status', async () => {
        return await ragIpcHandler.getEmbeddingStatus();
    });

    // 重新初始化阿里云嵌入函数处理器
    ipcMain.handle('reinitialize-aliyun-embedding', async () => {
        return await ragIpcHandler.reinitializeAliyunEmbedding();
    });

    // 获取知识库集合列表处理器
    ipcMain.handle('list-kb-collections', async () => {
        return await ragIpcHandler.listKbCollections();
    });
}

module.exports = {
    registerRagHandlers,
    handleAddFileToKb,
    handleListKbFiles,
    handleDeleteKbFile,
    handleRenameKbFile,
    setStoreInstance
};