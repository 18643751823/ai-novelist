const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const log = require('../utils/logger');

class FlowiseService {
    constructor() {
        this.process = null;
        this.status = 'stopped'; // stopped, starting, running, error
        this.port = 3001; // 使用 3001 端口，避免与 React 开发服务器冲突
        this.baseURL = `http://localhost:${this.port}`;
        this.flowisePath = path.join(__dirname, '../../../flowise-integration');
        this.eventHandlers = {
            onStatusChange: null
        };
    }

    /**
     * 设置事件处理器
     */
    setEventHandler(event, handler) {
        this.eventHandlers[event] = handler;
    }

    /**
     * 发送状态变化事件
     */
    emitStatusChange(status) {
        if (this.eventHandlers.onStatusChange) {
            this.eventHandlers.onStatusChange(status);
        }
    }

    /**
     * 启动 Flowise 服务
     */
    async start() {
        if (this.status !== 'stopped') {
            log.info(`[FlowiseService] 服务状态为 ${this.status}，无法启动`);
            return { success: false, message: `服务状态为 ${this.status}，无法启动` };
        }

        try {
            this.status = 'starting';
            log.info('[FlowiseService] 正在启动 Flowise 服务...');
            
            // 发送启动状态事件
            this.emitStatusChange({
                status: this.status,
                port: this.port,
                baseURL: this.baseURL,
                pid: null
            });

            // 检查 Flowise 目录是否存在
            try {
                await fs.access(this.flowisePath);
            } catch (error) {
                log.error('[FlowiseService] Flowise 目录不存在:', error.message);
                this.status = 'error';
                return { success: false, message: 'Flowise 目录不存在' };
            }

            // 启动 Flowise 服务，设置端口为 3001
            this.process = spawn('npm', ['run', 'start'], {
                cwd: this.flowisePath,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
                env: {
                    ...process.env,
                    PORT: '3001'
                }
            });

            // 处理标准输出
            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                log.info('[FlowiseService] 服务输出:', output);

                // 检测服务启动成功
                if (output.includes('Flowise Server is listening at')) {
                    this.status = 'running';
                    log.info('[FlowiseService] Flowise 服务启动成功');
                    this.emitStatusChange({
                        status: this.status,
                        port: this.port,
                        baseURL: this.baseURL,
                        pid: this.process.pid
                    });
                }
                log.info(`[FlowiseService] ${output.trim()}`);
                
                // 检测服务启动成功
                if (output.includes('Server running on port') || output.includes('Listening on port')) {
                    this.status = 'running';
                    log.info('[FlowiseService] Flowise 服务启动成功');
                }
            });

            // 处理错误输出
            this.process.stderr.on('data', (data) => {
                const error = data.toString();
                log.error(`[FlowiseService] ${error.trim()}`);
                
                if (error.includes('EADDRINUSE')) {
                    this.status = 'error';
                    log.error('[FlowiseService] 端口被占用，请检查端口 3001');
                }
            });

            // 处理进程退出
            this.process.on('close', (code) => {
                log.info(`[FlowiseService] Flowise 进程退出，退出码: ${code}`);
                this.status = 'stopped';
                this.process = null;
            });

            // 等待服务启动
            await this.waitForServiceStart();

            return { success: true, message: 'Flowise 服务启动成功' };

        } catch (error) {
            log.error('[FlowiseService] 启动服务失败:', error);
            this.status = 'error';
            return { success: false, message: `启动失败: ${error.message}` };
        }
    }

    /**
     * 停止 Flowise 服务
     */
    async stop() {
        if (this.status !== 'running' && this.status !== 'starting') {
            log.info(`[FlowiseService] 服务状态为 ${this.status}，无需停止`);
            return { success: true, message: `服务状态为 ${this.status}，无需停止` };
        }

        try {
            log.info('[FlowiseService] 正在停止 Flowise 服务...');
            
            if (this.process) {
                this.process.kill('SIGTERM');
                this.process = null;
            }

            // 等待进程完全停止
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.status = 'stopped';
            log.info('[FlowiseService] Flowise 服务已停止');
            
            // 发送状态变化事件
            this.emitStatusChange({
                status: this.status,
                port: this.port,
                baseURL: this.baseURL,
                pid: null
            });

            return { success: true, message: 'Flowise 服务已停止' };

        } catch (error) {
            log.error('[FlowiseService] 停止服务失败:', error);
            return { success: false, message: `停止失败: ${error.message}` };
        }
    }

    /**
     * 获取服务状态
     */
    async getStatus() {
        try {
            // 如果状态为运行中，检查服务是否真的在运行
            if (this.status === 'running') {
                const isAlive = await this.checkServiceHealth();
                if (!isAlive) {
                    this.status = 'error';
                }
            } else if (this.status === 'stopped') {
                // 如果状态为停止，检查服务是否实际上在运行
                const isAlive = await this.checkServiceHealth();
                if (isAlive) {
                    this.status = 'running';
                    log.info('[FlowiseService] 检测到 Flowise 服务已在运行');
                    // 发送状态更新事件
                    this.emitStatusChange({
                        status: this.status,
                        port: this.port,
                        baseURL: this.baseURL,
                        pid: null
                    });
                }
            }

            return {
                status: this.status,
                port: this.port,
                baseURL: this.baseURL,
                pid: this.process ? this.process.pid : null
            };

        } catch (error) {
            log.error('[FlowiseService] 获取状态失败:', error);
            return {
                status: 'error',
                port: this.port,
                baseURL: this.baseURL,
                pid: null
            };
        }
    }

    /**
     * 检查服务健康状态
     */
    async checkServiceHealth() {
        try {
            const response = await fetch(`${this.baseURL}/api/v1/version`, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 等待服务启动
     */
    async waitForServiceStart(timeout = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (this.status === 'running') {
                return true;
            }
            
            // 检查服务是否可用
            const isAlive = await this.checkServiceHealth();
            if (isAlive) {
                this.status = 'running';
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.status = 'error';
        throw new Error('Flowise 服务启动超时');
    }

    /**
     * 重启服务
     */
    async restart() {
        log.info('[FlowiseService] 正在重启 Flowise 服务...');
        
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return await this.start();
    }
}

// 创建单例实例
const flowiseService = new FlowiseService();

module.exports = flowiseService;