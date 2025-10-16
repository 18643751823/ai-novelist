import * as path from "path";
import * as fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitDetectionResult {
  available: boolean;
  gitPath?: string;
  version?: string;
  type: "portable" | "system" | "none";
  error?: string;
}

export class GitDetector {
  /**
   * 检测Git可用性，按照优先级：便携Git -> 系统Git
   */
  public static async detectGit(): Promise<GitDetectionResult> {
    // 1. 首先尝试便携Git
    const portableResult = await this.detectPortableGit();
    if (portableResult.available) {
      return portableResult;
    }

    // 2. 然后尝试系统Git
    const systemResult = await this.detectSystemGit();
    if (systemResult.available) {
      return systemResult;
    }

    // 3. 如果都不可用，返回错误
    return {
      available: false,
      type: "none",
      error: "Git不可用：未找到便携Git或系统Git"
    };
  }

  /**
   * 检测便携Git
   */
  private static async detectPortableGit(): Promise<GitDetectionResult> {
    try {
      // 便携Git的可能路径
      const possiblePaths = [
        path.join(process.cwd(), "PortableGit", "bin", "git.exe"),
        path.join(process.cwd(), "PortableGit", "cmd", "git.exe"),
        path.join(process.cwd(), "PortableGit", "git.exe"),
        path.join(process.cwd(), "..", "PortableGit", "bin", "git.exe"),
        path.join(process.cwd(), "..", "PortableGit", "cmd", "git.exe"),
        path.join(process.cwd(), "..", "PortableGit", "git.exe")
      ];

      for (const gitPath of possiblePaths) {
        try {
          await fs.access(gitPath);
          // 验证Git是否可用
          const { stdout } = await execAsync(`"${gitPath}" --version`);
          const version = stdout.trim();
          
          return {
            available: true,
            gitPath,
            version,
            type: "portable"
          };
        } catch (error) {
          // 继续尝试下一个路径
          continue;
        }
      }

      return {
        available: false,
        type: "portable",
        error: "未找到便携Git"
      };
    } catch (error) {
      return {
        available: false,
        type: "portable",
        error: `检测便携Git时出错: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 检测系统Git
   */
  private static async detectSystemGit(): Promise<GitDetectionResult> {
    try {
      // 尝试直接调用git命令
      const { stdout } = await execAsync("git --version");
      const version = stdout.trim();
      
      return {
        available: true,
        gitPath: "git", // 系统PATH中的git
        version,
        type: "system"
      };
    } catch (error) {
      return {
        available: false,
        type: "system",
        error: `系统Git不可用: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取Git可执行文件路径
   */
  public static async getGitPath(): Promise<string> {
    const result = await this.detectGit();
    if (!result.available) {
      throw new Error(result.error || "Git不可用");
    }
    return result.gitPath!;
  }

  /**
   * 检查Git是否可用
   */
  public static async isGitAvailable(): Promise<boolean> {
    const result = await this.detectGit();
    return result.available;
  }

  /**
   * 获取Git版本信息
   */
  public static async getGitVersion(): Promise<string> {
    const result = await this.detectGit();
    if (!result.available) {
      throw new Error(result.error || "Git不可用");
    }
    return result.version!;
  }
}