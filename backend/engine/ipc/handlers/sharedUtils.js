const { app } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs').promises;

let storeInstance = null;

// 统一获取 novel 目录路径的辅助函数
const getNovelPath = () => {
    if (isDev) {
        // 开发环境：位于项目根目录
        return path.join(app.getAppPath(), 'novel');
    } else {
        // 生产环境：位于 .exe 文件同级目录
        return path.join(path.dirname(app.getPath('exe')), 'novel');
    }
};

// 辅助函数：生成唯一的文件或文件夹名称
const generateUniqueName = async (targetDir, originalFullName, isFolder) => {
    let baseName = path.basename(originalFullName, path.extname(originalFullName));
    let extName = isFolder ? '' : path.extname(originalFullName);
    let counter = 0;
    let uniqueName = originalFullName;
    let newFullPath;

    while (true) {
        let currentTryName;
        if (counter === 0) {
            currentTryName = originalFullName;
        } else {
            currentTryName = `${baseName}-副本${counter}${extName}`;
        }
        newFullPath = path.join(targetDir, currentTryName);

        try {
            await fs.access(newFullPath, fs.constants.F_OK);
            // 如果文件或目录存在，则继续尝试下一个副本
            counter++;
        } catch (e) {
            // 如果文件或目录不存在，则找到唯一名称
            uniqueName = currentTryName;
            break;
        }
    }
    return uniqueName;
};

// 获取检查点目录
const getCheckpointDirs = async () => {
    if (!storeInstance) {
        const StoreModule = await import('electron-store');
        const Store = StoreModule.default;
        storeInstance = new Store();
    }
    const novelDirPath = getNovelPath();
    const userDataPath = storeInstance.get('customStoragePath') || path.join(require('electron').app.getPath('userData'));
    return { workspaceDir: novelDirPath, shadowDir: userDataPath };
};

// 辅助函数：递归复制
const copyRecursive = async (src, dest) => {
    const stats = await fs.stat(src);
    if (stats.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        await fs.copyFile(src, dest);
    }
};

// 辅助函数：将文件树扁平化为文件路径数组
const flattenFileTree = (nodes) => {
    let filePaths = [];
    nodes.forEach(node => {
        if (!node.isFolder) { // 如果不是文件夹，那就是文件
            filePaths.push(node.id); // 使用 node.id 来获取文件路径
        } else if (node.isFolder && node.children) { // 如果是文件夹且有子节点
            filePaths = filePaths.concat(flattenFileTree(node.children));
        }
    });
    return filePaths;
};

// 设置存储实例
const setStoreInstance = (store) => {
    storeInstance = store;
};

module.exports = {
    getNovelPath,
    generateUniqueName,
    getCheckpointDirs,
    copyRecursive,
    flattenFileTree,
    setStoreInstance
};