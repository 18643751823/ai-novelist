import React, { useState, useCallback, useRef } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import WorkflowCanvas from './WorkflowCanvas';
import NodeLibrary from './NodeLibrary';
import NodeConfigPanel from './NodeConfigPanel';
import Toolbar from './Toolbar';
import workflowIpcHandler from '../../../ipc/workflowIpcHandler';

const WorkflowEditor = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [selectedNode, setSelectedNode] = useState(null);
  const workflowCanvasRef = useRef();

  // 显示通知
  const showNotification = useCallback((message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);

  // 关闭通知
  const handleCloseNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  // 获取当前工作流数据
  const getCurrentWorkflow = useCallback(() => {
    if (workflowCanvasRef.current) {
      return workflowCanvasRef.current.getWorkflowData();
    }
    return null;
  }, []);

  // 工具栏操作处理函数
  const handleRun = useCallback(async () => {
    setIsRunning(true);
    
    try {
      const workflow = getCurrentWorkflow();
      if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
        showNotification('请先添加节点到画布', 'warning');
        setIsRunning(false);
        return;
      }

      // 验证工作流
      const validationResult = await workflowIpcHandler.validateWorkflow(workflow);
      if (!validationResult.success) {
        showNotification(`工作流验证失败: ${validationResult.error}`, 'error');
        setIsRunning(false);
        return;
      }

      if (!validationResult.data.valid) {
        const errors = validationResult.data.errors.join(', ');
        showNotification(`工作流验证错误: ${errors}`, 'error');
        setIsRunning(false);
        return;
      }

      // 执行工作流
      const executionResult = await workflowIpcHandler.executeWorkflow(workflow, {});
      
      if (executionResult.success) {
        showNotification('工作流执行成功', 'success');
        console.log('工作流执行结果:', executionResult.data);
      } else {
        showNotification(`工作流执行失败: ${executionResult.error}`, 'error');
      }

    } catch (error) {
      console.error('工作流执行错误:', error);
      showNotification(`执行错误: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  }, [getCurrentWorkflow, showNotification]);

  const handleSave = useCallback(async () => {
    try {
      const workflow = getCurrentWorkflow();
      if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
        showNotification('没有可保存的工作流', 'warning');
        return;
      }

      const saveResult = await workflowIpcHandler.saveWorkflow(workflow);
      if (saveResult.success) {
        showNotification('工作流保存成功', 'success');
      } else {
        showNotification(`保存失败: ${saveResult.error}`, 'error');
      }
    } catch (error) {
      console.error('保存工作流错误:', error);
      showNotification(`保存错误: ${error.message}`, 'error');
    }
  }, [getCurrentWorkflow, showNotification]);

  const handleClear = useCallback(() => {
    if (workflowCanvasRef.current) {
      workflowCanvasRef.current.clearWorkflow();
      showNotification('工作流已清空', 'info');
    }
  }, [showNotification]);

  const handleZoomIn = useCallback(() => {
    if (workflowCanvasRef.current) {
      workflowCanvasRef.current.zoomIn();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (workflowCanvasRef.current) {
      workflowCanvasRef.current.zoomOut();
    }
  }, []);

  const handleFitView = useCallback(() => {
    if (workflowCanvasRef.current) {
      workflowCanvasRef.current.fitView();
    }
  }, []);

  // 处理节点选择
  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  // 处理节点配置变更
  const handleNodeConfigChange = useCallback((nodeId, config) => {
    if (workflowCanvasRef.current) {
      workflowCanvasRef.current.updateNodeConfig(nodeId, config);
    }
  }, []);

  // 关闭配置面板
  const handleCloseConfigPanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <Box sx={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.default'
    }}>
      {/* 工具栏 */}
      <Toolbar
        onRun={handleRun}
        onSave={handleSave}
        onClear={handleClear}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        isRunning={isRunning}
      />

      {/* 主要内容区域 */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* 节点库 */}
        <NodeLibrary />

        {/* 画布区域 */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <WorkflowCanvas
            ref={workflowCanvasRef}
            onNodeSelect={handleNodeSelect}
          />
        </Box>

        {/* 配置面板 */}
        <NodeConfigPanel
          node={selectedNode}
          onConfigChange={handleNodeConfigChange}
          onClose={handleCloseConfigPanel}
        />
      </Box>

      {/* 通知 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkflowEditor;