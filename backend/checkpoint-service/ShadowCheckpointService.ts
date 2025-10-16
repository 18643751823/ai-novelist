import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit } from "simple-git"

import { fileExistsAtPath } from "../utils/fs"
import { executeRipgrep } from "../services/ripgrep"
import { GitDetector } from "../utils/git-detector"

import { GIT_DISABLED_SUFFIX } from "./constants"
import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected shadowGitConfigWorktree?: string

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log?: (message: string) => void) {
		super()

		// The `log` parameter is now optional and deprecated, as we use electron-log via console.
		if (log) {
			console.warn("[ShadowCheckpointService] The `log` parameter in the constructor is deprecated.")
		}

		const homedir = os.homedir()
		const desktopPath = path.join(homedir, "Desktop")
		const documentsPath = path.join(homedir, "Documents")
		const downloadsPath = path.join(homedir, "Downloads")
		const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir

		this.dotGitDir = path.join(this.checkpointsDir, ".git")
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		// 检测Git可用性
		const gitDetection = await GitDetector.detectGit()
		if (!gitDetection.available) {
			throw new Error(`Git不可用：${gitDetection.error}`)
		}

		console.log(`[${this.constructor.name}#initShadowGit] 使用${gitDetection.type === "portable" ? "便携" : "系统"}Git: ${gitDetection.version}`)

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		
		// 配置simple-git使用检测到的Git路径
		const gitOptions = gitDetection.type === "portable" && gitDetection.gitPath
			? { binary: gitDetection.gitPath }
			: {}
			
		const git = simpleGit(this.checkpointsDir, gitOptions)
		
		let created = false
		const startTime = Date.now()

		try {
			// 验证Git连接
			const gitVersion = await git.version()
			console.log(`[${this.constructor.name}#create] git = ${gitVersion}`)

			if (await fileExistsAtPath(this.dotGitDir)) {
				console.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
				const worktree = await this.getShadowGitConfigWorktree(git)

				if (worktree && worktree !== this.workspaceDir) {
					console.warn(
						`[ShadowCheckpointService] Workspace directory has changed. Updating from "${worktree}" to "${this.workspaceDir}".`,
					)
					await git.addConfig("core.worktree", this.workspaceDir)
				}

				await this.writeExcludeFile()
				this.baseHash = await git.revparse(["HEAD"])
			} else {
				console.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`)
				await git.init()
				await git.addConfig("core.worktree", this.workspaceDir) // Sets the working tree to the current workspace.
				await git.addConfig("commit.gpgSign", "false") // Disable commit signing for shadow repo.
				await git.addConfig("user.name", "Roo Code")
				await git.addConfig("user.email", "noreply@example.com")
				await this.writeExcludeFile()
				await this.stageAll(git) // <-- This is now desired behavior based on user feedback.
				const { commit } = await git.commit("initial commit", { "--allow-empty": null })
				this.baseHash = commit
				created = true
			}

			const duration = Date.now() - startTime

			console.log(
				`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
			)

			this.git = git

			await onInit?.()

			this.emit("initialize", {
				type: "initialize",
				workspaceDir: this.workspaceDir,
				baseHash: this.baseHash,
				created,
				duration,
			})

			return { created, duration }
		} catch (error) {
			console.error(`[${this.constructor.name}#initShadowGit] Git操作失败:`, error)
			throw new Error(`Git操作失败: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	// Add basic excludes directly in git config, while respecting any
	// .gitignore in the workspace.
	// .git/info/exclude is local to the shadow git repo, so it's not
	// shared with the main repo - and won't conflict with user's
	// .gitignore.
	protected async writeExcludeFile() {
		await fs.mkdir(path.join(this.dotGitDir, "info"), { recursive: true })
		const patterns = await getExcludePatterns(this.workspaceDir)
		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	private async stageAll(git: SimpleGit) {
		await this.renameNestedGitRepos(true)

		try {
			await git.add(".")
		} catch (error) {
			console.error(`[${this.constructor.name}#stageAll] failed to add files to git:`, error)
		} finally {
			await this.renameNestedGitRepos(false)
		}
	}

	// Since we use git to track checkpoints, we need to temporarily disable
	// nested git repos to work around git's requirement of using submodules for
	// nested repos.
	private async renameNestedGitRepos(disable: boolean) {
		try {
			// Find all .git directories that are not at the root level.
			const gitDir = ".git" + (disable ? "" : GIT_DISABLED_SUFFIX)
			const args = ["--files", "--hidden", "--follow", "-g", `**/${gitDir}/HEAD`, this.workspaceDir]

			const gitPaths = await (
				await executeRipgrep({ args, workspacePath: this.workspaceDir })
			).filter(({ type, path }) => type === "folder" && path.includes(".git") && !path.startsWith(".git"))

		if (!gitPaths || gitPaths.length === 0) {
			console.log(`[${this.constructor.name}#renameNestedGitRepos] no nested git repos found or ripgrep failed. Skipping.`);
			return;
		}

			// For each nested .git directory, rename it based on operation.
			for (const gitPath of gitPaths) {
				if (gitPath.path.startsWith(".git")) {
					continue
				}

				const currentPath = path.join(this.workspaceDir, gitPath.path)
				let newPath: string

				if (disable) {
					newPath = !currentPath.endsWith(GIT_DISABLED_SUFFIX)
						? currentPath + GIT_DISABLED_SUFFIX
						: currentPath
				} else {
					newPath = currentPath.endsWith(GIT_DISABLED_SUFFIX)
						? currentPath.slice(0, -GIT_DISABLED_SUFFIX.length)
						: currentPath
				}

				if (currentPath === newPath) {
					continue
				}

				try {
					await fs.rename(currentPath, newPath)

					console.log(
						`[${this.constructor.name}#renameNestedGitRepos] ${disable ? "disabled" : "enabled"} nested git repo ${currentPath}`,
					)
				} catch (error) {
					console.error(
						`[${this.constructor.name}#renameNestedGitRepos] failed to ${disable ? "disable" : "enable"} nested git repo ${currentPath}:`,
						error,
					)
				}
			}
		} catch (error) {
			console.error(
				`[${this.constructor.name}#renameNestedGitRepos] failed to ${disable ? "disable" : "enable"} nested git repos:`,
				error,
			)
		}
	}

	private async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined
			} catch (error) {
				console.error(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree:`,
					error,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	public async saveCheckpoint(message: string): Promise<CheckpointResult | undefined> {
		try {
			console.log(`[${this.constructor.name}#saveCheckpoint] starting checkpoint save`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const startTime = Date.now()
			await this.stageAll(this.git)
			const result = await this.git.commit(message)
			const isFirst = this._checkpoints.length === 0
			const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash!
			const toHash = result.commit || fromHash
			this._checkpoints.push(toHash)
			const duration = Date.now() - startTime

			if (isFirst || result.commit) {
				this.emit("checkpoint", { type: "checkpoint", isFirst, fromHash, toHash, duration })
			}

			if (result.commit) {
				console.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)
				            // 修正：返回一个标准的 CheckpointResult 对象
				            // 修正：返回一个兼容 CheckpointResult 的对象
				            // CommitResult 对象本身就包含了 commit 字段，可以直接返回
				            return result;
			} else {
				console.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`)
				return undefined
			}
		} catch (error) {
			console.error(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint:`, error)
			this.emit("error", { type: "error", error: error as Error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		try {
			console.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const start = Date.now()
			// Per user request, perform a hard reset.
			// The frontend is now responsible for warning the user about data loss.
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash, duration })
			console.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
			return { success: true, commitHash }
		} catch (error) {
			console.error(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint:`, error)
			this.emit("error", { type: "error", error: error as Error })
			throw error
		}
	}

	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const result: CheckpointDiff[] = []

		if (!from) {
			from = (await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim()
		}

		// Stage all changes so that untracked files appear in diff summary.
		await this.stageAll(this.git)

		console.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`)
		const { files } = to ? await this.git.diffSummary([`${from}..${to}`]) : await this.git.diffSummary([from])

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""

		for (const file of files) {
			const relPath = file.file
			const absPath = path.join(cwdPath, relPath)
			const before = await this.git.show([`${from}:${relPath}`]).catch(() => "")

			const after = to
				? await this.git.show([`${to}:${relPath}`]).catch(() => "")
				: await fs.readFile(absPath, "utf8").catch(() => "")

			result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
		}

		return result
	}

	public async getHistory() {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}
		return await this.git.log()
	}

	/**
		* EventEmitter
	 */

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	/**
	 * Storage
	 */

	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	protected static taskRepoDir({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		return path.join(globalStorageDir, "tasks", taskId, "checkpoints")
	}

	protected static workspaceRepoDir({
		globalStorageDir,
		workspaceDir,
	}: {
		globalStorageDir: string
		workspaceDir: string
	}) {
		return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir))
	}

	public static async deleteTask({
		taskId,
		globalStorageDir,
		workspaceDir,
	}: {
		taskId: string
		globalStorageDir: string
		workspaceDir: string
	}) {
		const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir })
		const branchName = `roo-${taskId}`
		const git = simpleGit(workspaceRepoDir)
		const success = await this.deleteBranch(git, branchName)

		if (success) {
			console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`)
			return false
		}

		const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

		if (currentBranch === branchName) {
			const worktree = await git.getConfig("core.worktree")

			try {
				await git.raw(["config", "--unset", "core.worktree"])
				await git.reset(["--hard"])
				await git.clean("f", ["-d"])
				const defaultBranch = branches.all.includes("main") ? "main" : "master"
				await git.checkout([defaultBranch, "--force"])

				const { default: pWaitFor } = await import("p-wait-for")
				await pWaitFor(
					async () => {
						const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
						return newBranch === defaultBranch
					},
					{ interval: 500, timeout: 2_000 },
				)

				await git.branch(["-D", branchName])
				return true
			} catch (error) {
				console.error(
					`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			return true
		}
	}
}