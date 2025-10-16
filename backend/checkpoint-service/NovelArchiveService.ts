import * as path from "path";
import * as fs from "fs/promises";

// 定义存档的元数据结构
export interface NovelArchive {
    id: string; // 通常是时间戳
    message: string;
    path: string; // 存档文件夹的完整路径
}

export class NovelArchiveService {
    private archivesDir: string;
    private workspaceDir: string; // 小说的工作目录，例如 d:/ai-novel/novel
    private log: (message: string) => void;

    constructor(archivesDir: string, workspaceDir: string, log: (message: string) => void = console.log) {
        this.archivesDir = archivesDir;
        this.workspaceDir = workspaceDir;
        this.log = log;
    }

    async init() {
        await fs.mkdir(this.archivesDir, { recursive: true });
        this.log(`[NovelArchiveService] Initialized. Archives directory: ${this.archivesDir}`);
    }

    async createNovelArchive(message: string): Promise<NovelArchive> {
        // 1. 生成一个基于时间戳的唯一ID和文件夹名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        // Sanitize the message to remove characters that are invalid in filenames
        const sanitizedMessage = message.replace(/[<>:"/\\|?*\s]/g, '_');
        const archiveId = `${timestamp}_${sanitizedMessage}`;
        const archivePath = path.join(this.archivesDir, archiveId);

        // 2. 在 archivesDir 中创建这个新文件夹
        await fs.mkdir(archivePath, { recursive: true });

        // 3. 将 workspaceDir 的内容完整复制到新文件夹中
        await fs.cp(this.workspaceDir, archivePath, { recursive: true });

        const newArchive: NovelArchive = {
            id: archiveId,
            message: message,
            path: archivePath,
        };
        
        this.log(`[NovelArchiveService] Created new archive: ${archiveId}`);
        return newArchive;
    }

    async restoreNovelArchive(archiveId: string): Promise<void> {
        // 1. 根据 archiveId 找到存档文件夹的路径
        const archivePath = path.join(this.archivesDir, archiveId);
        if (!await fs.stat(archivePath).then(s => s.isDirectory()).catch(() => false)) {
            throw new Error(`Archive with ID "${archiveId}" not found.`);
        }

        // 2. 清空 workspaceDir
        await fs.rm(this.workspaceDir, { recursive: true, force: true });
        await fs.mkdir(this.workspaceDir, { recursive: true });

        // 3. 将存档文件夹的内容复制回 workspaceDir
        await fs.cp(archivePath, this.workspaceDir, { recursive: true });
        
        this.log(`[NovelArchiveService] Restored workspace from archive: ${archiveId}`);
    }

    async listNovelArchives(): Promise<NovelArchive[]> {
        // 1. 检查存档目录是否存在，如果不存在则返回空数组
        try {
            await fs.access(this.archivesDir);
        } catch (error) {
            // 如果目录不存在，返回空数组而不是抛出错误
            return [];
        }
        
        // 2. 读取 archivesDir 下的所有子文件夹
        const entries = await fs.readdir(this.archivesDir, { withFileTypes: true });
        const archiveFolders = entries.filter(e => e.isDirectory());

        const archives: NovelArchive[] = archiveFolders.map(folder => {
            const [timestamp, ...messageParts] = folder.name.split('_');
            return {
                id: folder.name,
                message: messageParts.join(' ').replace(/_/g, ' '),
                path: path.join(this.archivesDir, folder.name),
            };
        });

        // 按时间戳降序排序
        return archives.sort((a, b) => b.id.localeCompare(a.id));
    }
    async deleteNovelArchive(archiveId: string): Promise<void> {
        const archivePath = path.join(this.archivesDir, archiveId);
        if (!await fs.stat(archivePath).then(s => s.isDirectory()).catch(() => false)) {
            throw new Error(`Archive with ID "${archiveId}" not found for deletion.`);
        }
        await fs.rm(archivePath, { recursive: true, force: true });
        this.log(`[NovelArchiveService] Deleted archive: ${archiveId}`);
    }
}