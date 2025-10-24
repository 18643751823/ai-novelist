import React, { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import { Box } from '@mui/material';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import { NODE_TYPES, createNodeData, TYPE_COMPATIBILITY } from '../types';

// 节点类型映射
const nodeTypes = {
  [NODE_TYPES.LLM]: CustomNode,
  [NODE_TYPES.TOOL]: CustomNode,
  [NODE_TYPES.CONDITION]: CustomNode,
  [NODE_TYPES.INPUT]: CustomNode,
  [NODE_TYPES.OUTPUT]: CustomNode,
  [NODE_TYPES.MEMORY]: CustomNode
};

const WorkflowCanvas = forwardRef((props, ref) => {
  const { onNodeSelect } = props;
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getWorkflowData: () => ({
      id: `workflow-${Date.now()}`,
      name: '自定义工作流',
      description: '用户创建的工作流',
      nodes: nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          config: node.data.config || {}
        }
      })),
      edges,
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    clearWorkflow: () => {
      setNodes([]);
      setEdges([]);
    },
    updateNodeConfig: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  config: { ...node.data.config, ...config }
                }
              }
            : node
        )
      );
    },
    zoomIn: () => zoomIn(),
    zoomOut: () => zoomOut(),
    fitView: () => fitView()
  }));

  // 连接验证
  const isValidConnection = useCallback((connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    
    // 获取源节点和目标节点
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    
    if (!sourceNode || !targetNode) return false;
    
    // 获取输出和输入类型
    const sourceOutput = sourceNode.data.outputs?.find(o => o.id === sourceHandle);
    const targetInput = targetNode.data.inputs?.find(i => i.id === targetHandle);
    
    if (!sourceOutput || !targetInput) return false;
    
    // 检查类型兼容性
    const sourceType = sourceOutput.type || 'any';
    const targetType = targetInput.type || 'any';
    
    return TYPE_COMPATIBILITY[sourceType]?.includes(targetType) || false;
  }, [nodes]);

  // 连接处理
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // 节点选择处理
  const onNodeClick = useCallback((event, node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }, [onNodeSelect]);

  // 节点拖拽放置处理
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      
      const position = {
        x: event.clientX - 200, // 减去侧边栏宽度
        y: event.clientY - 100  // 减去顶部偏移
      };
      
      const newNode = createNodeData(type, position);
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        fitView
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => node.data.category?.color || '#ddd'}
          zoomable
          pannable
        />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </Box>
  );
});

// 包装组件以提供ReactFlowProvider
const WorkflowCanvasWrapper = forwardRef((props, ref) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

export default WorkflowCanvasWrapper;