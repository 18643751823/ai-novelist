
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { state } = require('../../../state-manager');
const { getFileTree } = require('../../../utils/file-tree-builder');
const sortConfigManager = require('../../../utils/sortConfigManager');
const { getNovelPath, generateUniqueName, copyRecursive, flattenFileTree } = require('./sharedUtils');
const chatService = require('../chatService');

// 获取章节列表并更新前端
const getChaptersAndUpdateFrontend = async (mainWindow) => {
    const novelDirPath = getNovelPath();
    try {
        await fs.mkdir(novelDirPath, { recursive: true }).catch(() => {}); // 确保目录存在
        const fileTreeResult = await getFileTree(novelDirPath); // 使用新的文件树构建函数
        let chapters = [];
        if (fileTreeResult.success) {
            // 将文件树的 children 数组作为 chapters 返回
            // 注意：getFileTree 返回的根是 'novel' 目录，我们只需要其子项
            chapters = fileTreeResult.tree;
        } else {
            console.warn(`[fileHandlers.js] 从 file-tree-builder 获取文件树失败: ${fileTreeResult.error}`);
        }

        if (mainWindow && mainWindow.webContents) {
            const payloadToSend = { success: true, chapters };
            console.log(`[fileHandlers.js] 准备发送 chapters-updated 事件。mainWindow.isDestroyed()=${mainWindow.isDestroyed()}, payload类型: ${typeof payloadToSend}, payload.chapters类型: ${typeof payloadToSend.chapters}, payload.chapters是否数组: ${Array.isArray(payloadToSend.chapters)}, 章节数量: ${payloadToSend.chapters.length}, payload JSON长度: ${JSON.stringify(payloadToSend).length}`);
            // 确保 mainWindow 和 webContents 存在，且窗口未被销毁
            if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
                mainWindow.webContents.send('chapters-updated', JSON.stringify(payloadToSend)); // 尝试发送JSON字符串
                console.log('[fileHandlers.js] 已发送 chapters-updated 事件 (JSON 字符串模式)。');
            } else {
                console.warn('[fileHandlers.js] 尝试发送 chapters-updated 事件时 mainWindow 或 webContents 不可用，或窗口已销毁。');
            }
        }
        return { success: true, chapters }; // 也返回给调用者
    } catch (error) {
        console.error('[fileHandlers.js] 获取章节列表并更新前端失败:', error);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('chapters-updated', { success: false, error: error.message });
        }
        return { success: false, error: error.message };
    }
};

// 处理获取章节列表请求 (供渲染进程直接调用，例如首次加载)
const handleGetChapters = async () => {
    return await getChaptersAndUpdateFrontend(state.mainWindow); // 复用逻辑，并确保通过 mainWindow 发送
};

// 处理加载章节内容请求
const handleLoadChapterContent = async (event, chapterId) => {
    const novelDirPath = getNovelPath();
    const chapterFilePath = path.join(novelDirPath, chapterId); // chapterId 已经是相对路径
    console.log(`[fileHandlers.js] handleLoadChapterContent: 尝试加载文件: ${chapterFilePath}`);
    try {
        const content = await fs.readFile(chapterFilePath, 'utf8');
        console.log(`[fileHandlers.js] handleLoadChapterContent: 章节 '${chapterId}' 内容长度: ${content.length}`);
        console.log(`[fileHandlers.js] handleLoadChapterContent: 章节内容前50字符: '${content.substring(0, 50)}...'`);
        return { success: true, content };
    } catch (error) {
        console.error(`[fileHandlers.js] 加载章节内容失败: ${chapterId}`, error);
        return { success: false, error: error.message };
    }
};

// 处理创建新章节请求
const handleCreateChapter = async (event, chapterTitle) => { // 这个名字有点歧义，现在主要用于创建文件
    const novelDirPath = getNovelPath();
    // 确保novel目录存在
    await fs.mkdir(novelDirPath, { recursive: true }).catch(() => {}); // 忽略目录已存在的错误

    const chapterFilePath = path.join(novelDirPath, chapterTitle);
    try {
        await fs.writeFile(chapterFilePath, ''); // 创建空文件
        await getChaptersAndUpdateFrontend(state.mainWindow); // 创建成功后更新前端
        return { success: true, message: `章节 '${chapterTitle}' 创建成功` };
    } catch (error) {
        console.error(`[fileHandlers.js] 创建章节失败: ${chapterTitle}`, error);
        return { success: false, error: error.message };
    }
};

// 处理创建文件夹请求
const handleCreateFolder = async (event, folderPathInput) => {
    const novelRootPath = getNovelPath();
    const parentDir = path.dirname(folderPathInput); // 获取父目录
    const folderName = path.basename(folderPathInput); // 获取文件夹名

    const targetDir = path.join(novelRootPath, parentDir);

    await fs.mkdir(targetDir, { recursive: true }).catch(() => {});

    // 使用 generateUniqueName 来获取最终的文件夹名
    const finalUniqueFolderName = await generateUniqueName(targetDir, folderName, true); // true 表示是文件夹
    const fullPath = path.join(targetDir, finalUniqueFolderName);

    try {
        await fs.mkdir(fullPath, { recursive: true });
        await getChaptersAndUpdateFrontend(state.mainWindow);
        return { success: true, message: `文件夹 '${path.relative(novelRootPath, fullPath).replace(/\\/g, '/')}' 创建成功` };
    } catch (error) {
        console.error(`[fileHandlers.js] 创建文件夹失败: ${folderPathInput}`, error);
        return { success: false, error: error.message };
    }
};

// 处理创建新小说文件请求
const handleCreateNovelFile = async (event, { filePath, content = '' }) => { // 实际创建文件 IPC
    console.log(`[IPC] handleCreateNovelFile received: filePath=${filePath}, content length=${content?.length || 0}`);

    if (typeof filePath !== 'string' || !filePath) {
        console.log(`[ERROR][IPC] handleCreateNovelFile: Invalid or missing filePath.`);
        return { success: false, error: 'Invalid or missing filePath' };
    }

    const novelRootPath = getNovelPath();
    // 移除 filePath 开头的 'novel/' 前缀，因为 novelRootPath 已经指向 novel 目录
    const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    
    // 获取目标目录和原始文件名
    const targetDir = path.join(novelRootPath, path.dirname(cleanFilePath));
    const originalFileName = path.basename(cleanFilePath);
    
    // 确保目标目录存在
    await fs.mkdir(targetDir, { recursive: true }).catch(() => {}); // 忽略目录已存在的错误

    // 使用 generateUniqueName 来获取最终的文件名
    const finalUniqueFileName = await generateUniqueName(targetDir, originalFileName, false); // false 表示是文件
    const fullPath = path.join(targetDir, finalUniqueFileName);

    try {
        await fs.writeFile(fullPath, content, 'utf8');
        // 构建返回给前端的相对路径，例如 novel/folder/file.txt
        const relativeFilePath = path.relative(novelRootPath, fullPath).replace(/\\/g, '/');

        // 创建成功后，理论上新文件内容为空，直接返回成功状态和路径
        return {
            success: true,
            newFilePath: `novel/${relativeFilePath}`, // 返回带 'novel/' 前缀的完整相对路径
            content: content, // 返回新文件的内容 (通常为空字符串)
            message: `文件 '${relativeFilePath}' 创建成功`
        };
    } catch (error) {
        console.error(`[fileHandlers.js] 创建小说文件失败: ${fullPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理删除章节请求
const handleDeleteItem = async (event, itemId) => {
    const itemPath = path.join(getNovelPath(), itemId);
    try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
            await fs.rm(itemPath, { recursive: true, force: true }); // 删除目录及其内容
            return { success: true, message: `文件夹 '${itemId}' 及其内容删除成功` };
        } else {
            await fs.unlink(itemPath); // 删除文件
            // 发送文件删除事件通知前端更新标签页状态
            if (state.mainWindow && !state.mainWindow.isDestroyed() && state.mainWindow.webContents) {
                state.mainWindow.webContents.send('file-deleted', { filePath: itemId });
            }
            return { success: true, message: `文件 '${itemId}' 删除成功` };
        }
    } catch (error) {
        console.error(`[fileHandlers.js] 删除失败: ${itemId}`, error);
        return { success: false, error: error.message };
    } finally {
        await getChaptersAndUpdateFrontend(state.mainWindow); // 始终更新前端
    }
};

// 处理重命名章节请求
const handleRenameItem = async (event, oldItemId, newItemName) => {
    const novelRootPath = getNovelPath();
    const oldItemPath = path.join(novelRootPath, oldItemId);
    const parentDir = path.dirname(oldItemPath); // 目标文件夹

    let isFolder = false;
    try {
        const stats = await fs.stat(oldItemPath);
        isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[fileHandlers.js] 重命名项目时获取源项目信息失败: ${oldItemId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 使用 generateUniqueName 生成唯一的名称
    const uniqueNewItemName = await generateUniqueName(parentDir, newItemName, isFolder);
    const newItemPath = path.join(parentDir, uniqueNewItemName);

    try {
        await fs.rename(oldItemPath, newItemPath);
        // 发送文件重命名事件通知前端更新标签页状态
        if (state.mainWindow && !state.mainWindow.isDestroyed() && state.mainWindow.webContents) {
            const relativeNewItemPath = path.relative(novelRootPath, newItemPath).replace(/\\/g, '/');
            state.mainWindow.webContents.send('file-renamed', {
                oldFilePath: oldItemId,
                newFilePath: relativeNewItemPath
            });
        }
        await getChaptersAndUpdateFrontend(state.mainWindow); // 始终更新前端
        // 返回新的相对路径，以便前端更新当前文件
        const relativeNewItemPath = path.relative(novelRootPath, newItemPath).replace(/\\/g, '/');
        return { success: true, message: `项目 '${oldItemId}' 已重命名为 '${uniqueNewItemName}'`, newFilePath: relativeNewItemPath };
    } catch (error) {
        console.error(`[fileHandlers.js] 重命名失败: ${oldItemId} -> ${newItemName}`, error);
        return { success: false, error: error.message };
    }
};

// 处理复制项目请求
const handleCopyItem = async (event, sourceId, targetFolderId) => {
    const novelRootPath = getNovelPath();
    const sourcePath = path.join(novelRootPath, sourceId);
    
    // 确保 targetFolderId 为空时目标目录是 novel 根目录
    const targetFolderPath = targetFolderId ? path.join(novelRootPath, targetFolderId) : novelRootPath;
    
    // 获取源文件/文件夹的原始名称（带拓展名）
    const originalBasename = path.basename(sourceId);
    
    // 判断源是文件还是文件夹
    let isFolder = false;
    try {
        const stats = await fs.stat(sourcePath);
    isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[fileHandlers.js] 复制项目时获取源项目信息失败: ${sourceId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 调用 generateUniqueName 生成唯一的名称
    const uniqueTargetName = await generateUniqueName(targetFolderPath, originalBasename, isFolder);
    const newTargetPath = path.join(targetFolderPath, uniqueTargetName);

    try {
        await copyRecursive(sourcePath, newTargetPath);
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端以反映变化
        return { success: true, message: `项目 '${sourceId}' 已成功复制为 '${uniqueTargetName}'` };
    } catch (error) {
        console.error(`[fileHandlers.js] 复制失败: ${sourceId} -> ${newTargetPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理移动项目请求 (相当于剪切+粘贴)
const handleMoveItem = async (event, sourceId, targetFolderId) => {
    const novelRootPath = getNovelPath();
    const sourcePath = path.join(novelRootPath, sourceId);
    const targetFolderPath = targetFolderId ? path.join(novelRootPath, targetFolderId) : novelRootPath;

    // 获取源文件/文件夹的原始名称（带拓展名）
    const originalBasename = path.basename(sourceId);

    // 判断源是文件还是文件夹
    let isFolder = false;
    try {
        const stats = await fs.stat(sourcePath);
        isFolder = stats.isDirectory();
    } catch (error) {
        console.error(`[fileHandlers.js] 移动项目时获取源项目信息失败: ${sourceId}`, error);
        return { success: false, error: `源项目不存在或无法访问: ${error.message}` };
    }

    // 调用 generateUniqueName 生成唯一的名称
    const uniqueTargetName = await generateUniqueName(targetFolderPath, originalBasename, isFolder);
    const newTargetPath = path.join(targetFolderPath, uniqueTargetName);

    try {
        await fs.rename(sourcePath, newTargetPath); // rename 在同一文件系统内是移动
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端以反映变化
        return { success: true, message: `项目 '${sourceId}' 已成功移动为 '${uniqueTargetName}'` };
    } catch (error) {
        console.error(`[fileHandlers.js] 移动失败: ${sourceId} -> ${newTargetPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理更新项目排序顺序
const handleUpdateItemOrder = async (event, { directoryPath, itemIds }) => {
    const novelRootPath = getNovelPath();
    
    try {
        // 确保排序配置管理器已初始化
        await sortConfigManager.initialize(novelRootPath);
        
        // 设置自定义排序
        await sortConfigManager.setCustomOrder(directoryPath, itemIds);
        
        await getChaptersAndUpdateFrontend(state.mainWindow);
        return { success: true, message: '排序顺序更新成功' };
    } catch (error) {
        console.error(`[fileHandlers.js] 更新排序顺序失败: ${directoryPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理更新小说文件标题请求
const handleUpdateNovelTitle = async (event, { oldFilePath, newTitle }) => {
    const novelDirPath = getNovelPath();
    // 处理 oldFilePath：移除 'novel/' 前缀（如果存在），然后构建完整路径
    const cleanOldFilePath = oldFilePath.startsWith('novel/') ? oldFilePath.substring(6) : oldFilePath;
    const oldFullPath = path.join(novelDirPath, cleanOldFilePath);
    // 清理新标题以确保文件名合法
    const sanitize = (name) => name.replace(/[<>:"/\\|?*]/g, '_');
    const sanitizedNewTitle = sanitize(newTitle);
    
    // 构建新文件的完整路径，保持原有的目录结构
    const oldDir = path.dirname(cleanOldFilePath);
    const newFullPath = oldDir !== '.' ?
        path.join(novelDirPath, oldDir, `${sanitizedNewTitle}.txt`) :
        path.join(novelDirPath, `${sanitizedNewTitle}.txt`);

    console.log(`[fileHandlers.js] handleUpdateNovelTitle: 尝试将 '${oldFullPath}' 重命名为 '${newFullPath}'`);
    try {
        await fs.rename(oldFullPath, newFullPath); // 重命名文件
        await getChaptersAndUpdateFrontend(state.mainWindow); // 更新前端章节列表

        // 构建新的相对文件路径，保持原有的目录结构
        const oldDir = path.dirname(cleanOldFilePath);
        const newRelativePath = oldDir !== '.' ?
            `novel/${oldDir}/${sanitizedNewTitle}.txt` :
            `novel/${sanitizedNewTitle}.txt`;
        
        return { success: true, newFilePath: newRelativePath, message: `文件 '${path.basename(oldFilePath)}' 已重命名为 '${sanitizedNewTitle}.txt'` };
    } catch (error) {
        console.error(`[fileHandlers.js] 更新小说文件标题失败: ${oldFilePath} -> ${newTitle}`, error);
        return { success: false, error: error.message };
    }
};

// 处理保存小说文件内容的请求
const handleSaveNovelContent = async (event, filePath, content) => {
    const novelDirPath = getNovelPath();

    // 严谨性检查：确保 filePath 是有效的相对路径且不为空
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '' || filePath === '未选择') {
        const errorMessage = `文件路径无效: ${filePath}`;
        console.error(`[fileHandlers.js] handleSaveNovelContent: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }

    // 确保 filePath 是相对于 novelDirPath 的路径，不应包含盘符或绝对路径
    // 如果 filePath 包含了 novel/ 前缀，需要移除，以避免路径重复
    let cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    cleanFilePath = cleanFilePath.replace(/\\/g, '/'); // 统一路径分隔符

    const fullPath = path.join(novelDirPath, cleanFilePath); // 正确拼接路径

    console.log(`[fileHandlers.js] handleSaveNovelContent: 尝试保存文件: ${fullPath}`);
    try {
        // 确保文件所在的目录存在
        const dirForFile = path.dirname(fullPath);
        await fs.mkdir(dirForFile, { recursive: true }).catch(() => {});
        
        await fs.writeFile(fullPath, content, 'utf8');
        return { success: true, message: `文件 '${cleanFilePath}' 保存成功` };
    } catch (error) {
        console.error(`[fileHandlers.js] 保存小说文件内容失败: ${fullPath}`, error);
        return { success: false, error: error.message };
    }
};

// 处理列出 novel 目录下所有文件请求
const handleListNovelFiles = async () => {
    try {
        const fileTreeResult = await getFileTree(getNovelPath()); // 获取 novel 目录的文件树
        console.log('[handleListNovelFiles] fileTreeResult.tree:', JSON.stringify(fileTreeResult.tree, null, 2)); // 添加日志

        if (fileTreeResult.success) {
            const files = flattenFileTree(fileTreeResult.tree);
            console.log('[handleListNovelFiles] 扁平化后的文件列表 (files):', files); // 添加日志
            return { success: true, files };
        } else {
            console.error(`[fileHandlers.js] 获取 novel 文件列表失败: ${fileTreeResult.error}`);
            return { success: false, error: fileTreeResult.error };
        }
    } catch (error) {
        console.error('[fileHandlers.js] 列出 novel 文件时发生异常:', error);
        return { success: false, error: error.message };
    }
};

// 处理搜索novel文件夹中的文件内容
const handleSearchNovelFiles = async (event, searchQuery) => {
    try {
        const novelDirPath = getNovelPath();
        console.log(`[handleSearchNovelFiles] 搜索novel目录: ${novelDirPath}, 查询: ${searchQuery}`);
        
        // 使用ripgrep搜索文件内容
        const ripgrepService = require('../../../tool-service/ripgrep-service');
        const searchResults = await ripgrepService.regexSearchFiles(
            novelDirPath,
            novelDirPath,
            searchQuery,
            '*' // 搜索所有文件
        );

        // 解析搜索结果并返回格式化的结果
        const results = parseSearchResults(searchResults, novelDirPath);
        return { success: true, results };
    } catch (error) {
        console.error('[handleSearchNovelFiles] 搜索novel文件时发生异常:', error);
        return { success: false, error: error.message };
    }
};

// 解析ripgrep搜索结果
function parseSearchResults(searchOutput, novelDirPath) {
    const results = [];
    const lines = searchOutput.split('\n');
    let currentFile = null;
    
    for (const line of lines) {
        if (line.startsWith('# ')) {
            // 文件路径行
            const filePath = line.substring(2).trim();
            currentFile = {
                name: path.basename(filePath),
                path: filePath,
                preview: ''
            };
            results.push(currentFile);
        } else if (line.trim() && !line.startsWith('---') && currentFile) {
            // 内容行，添加到预览
            if (currentFile.preview.length < 100) { // 限制预览长度
                currentFile.preview += line.trim() + ' ';
            }
        }
    }
    
    return results;
}

// 注册文件相关IPC处理器
function registerFileHandlers() {
    console.log('[fileHandlers.js] 注册文件相关IPC处理器...');
    
    ipcMain.handle('list-novel-files', handleListNovelFiles); // 新增：注册列出 novel 目录下所有文件请求
    ipcMain.handle('search-novel-files', handleSearchNovelFiles); // 新增：注册搜索novel文件请求
    ipcMain.handle('get-chapters', handleGetChapters); // 注册新的IPC处理器
    ipcMain.handle('load-chapter-content', handleLoadChapterContent); // 注册新的IPC处理器
    ipcMain.handle('create-chapter', handleCreateChapter); // 注册新的IPC处理器
    ipcMain.handle('create-folder', handleCreateFolder); // 新增：创建文件夹
    ipcMain.handle('create-novel-file', handleCreateNovelFile); // 注册新的IPC处理器
    ipcMain.handle('delete-item', handleDeleteItem); // 修改：删除文件/文件夹
    ipcMain.handle('rename-item', handleRenameItem); // 修改：重命名文件/文件夹
    ipcMain.handle('copy-item', handleCopyItem); // 新增：复制文件/文件夹
    ipcMain.handle('move-item', handleMoveItem); // 新增：移动文件/文件夹 (剪切)
    ipcMain.handle('update-item-order', handleUpdateItemOrder); // 新增：更新项目排序顺序
    ipcMain.handle('update-novel-title', handleUpdateNovelTitle); // 注册新的IPC处理器
    console.log('[fileHandlers.js] 注册 save-novel-content 处理器...');
    ipcMain.handle('save-novel-content', handleSaveNovelContent);
}

module.exports = {
    registerFileHandlers,
    getChaptersAndUpdateFrontend,
    handleGetChapters,
    handleLoadChapterContent,
    handleCreateChapter,
    handleCreateFolder,
    handleCreateNovelFile,
    handleDeleteItem,
    handleRenameItem,
    handleCopyItem,
    handleMoveItem,
    handleUpdateItemOrder,
    handleUpdateNovelTitle,
    handleSaveNovelContent,
    handleListNovelFiles,
    handleSearchNovelFiles
};