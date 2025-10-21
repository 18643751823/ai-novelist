import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { NODE_TYPES, NODE_CATEGORIES } from '../types';

// 节点类型到类别的映射
const NODE_TYPE_TO_CATEGORY = {
  [NODE_TYPES.LLM]: NODE_CATEGORIES.LLM,
  [NODE_TYPES.TOOL]: NODE_CATEGORIES.TOOL,
  [NODE_TYPES.CONDITION]: NODE_CATEGORIES.CONDITION,
  [NODE_TYPES.INPUT]: NODE_CATEGORIES.INPUT,
  [NODE_TYPES.OUTPUT]: NODE_CATEGORIES.OUTPUT,
  [NODE_TYPES.MEMORY]: NODE_CATEGORIES.MEMORY
};

const NodeLibrary = () => {
  // 节点库数据
  const nodeLibrary = [
    {
      type: NODE_TYPES.LLM,
      name: 'ChatModel',
      description: '语言模型调用节点',
      icon: '🤖'
    },
    {
      type: NODE_TYPES.TOOL,
      name: '工具节点',
      description: '执行工具函数',
      icon: '🛠️'
    },
    {
      type: NODE_TYPES.CONDITION,
      name: '条件分支',
      description: '条件判断和分支',
      icon: '⚖️'
    },
    {
      type: NODE_TYPES.INPUT,
      name: '输入节点',
      description: '数据输入',
      icon: '📥'
    },
    {
      type: NODE_TYPES.OUTPUT,
      name: '输出节点',
      description: '数据输出',
      icon: '📤'
    },
    {
      type: NODE_TYPES.MEMORY,
      name: '记忆节点',
      description: '记忆管理',
      icon: '🧠'
    }
  ];

  // 拖拽开始处理
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Paper
      elevation={2}
      sx={{
        width: 250,
        height: '100%',
        backgroundColor: 'background.paper',
        overflow: 'auto'
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            marginBottom: 2,
            color: 'primary.main'
          }}
        >
          节点库
        </Typography>
        
        <List dense>
          {nodeLibrary.map((node) => {
            const category = NODE_TYPE_TO_CATEGORY[node.type];
            return (
              <ListItem
                key={node.type}
                sx={{
                  marginBottom: 1,
                  borderRadius: 1,
                  border: `1px solid ${category.color}30`,
                  backgroundColor: `${category.color}10`,
                  cursor: 'grab',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: `${category.color}20`,
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                draggable
                onDragStart={(e) => onDragStart(e, node.type)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: category.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '16px'
                    }}
                  >
                    {node.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {node.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {node.description}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>

        {/* 使用说明 */}
        <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 拖拽节点到画布开始构建工作流
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default NodeLibrary;