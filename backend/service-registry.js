// 服务注册中心
const MCPService = require('./mcp-service');
const path = require('path');

// 延迟加载服务以避免循环依赖
let _services = null;

let isInitialized = false;

function getServices() {
  if (!_services) {
    throw new Error('Services not initialized. Call initializeServices() first');
  }
  return _services;
}

async function initializeServices() {
  if (_services) return _services;
  
  console.log('[ServiceRegistry] Initializing services...');
  
  // 延迟加载核心服务
  const toolService = require('./tool-service');
  const stateService = require('./state-manager');
  const engine = require('./engine'); // 直接导入对象，不再尝试将其作为函数调用
  const filesystemClient = new MCPService(path.join(process.cwd(), 'novel'));

  _services = {
    toolService,
    stateService,
    engine,
    filesystem: filesystemClient,
    logService: {
      writeLog: (msg) => console.log('[LOG]', msg)
    }
  };
  
  console.log('[ServiceRegistry] All services initialized');
  isInitialized = true;
  return _services;
}

// 导出getter函数而不是直接导出对象
// 改为导出getServices函数，允许延迟初始化
module.exports = {
  getServices,
  initializeServices
};