import React from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Typography, Paper } from '@mui/material';
import { NODE_CATEGORIES } from '../types';

const CustomNode = ({ data, selected }) => {
  const category = data.category || NODE_CATEGORIES.LLM;

  return (
    <Paper
      elevation={selected ? 4 : 2}
      sx={{
        minWidth: 180,
        padding: 2,
        border: `2px solid ${category.color}`,
        borderRadius: 2,
        backgroundColor: 'white',
        boxShadow: selected ? `0 0 10px ${category.color}40` : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      {/* 输入句柄 */}
      {data.inputs && data.inputs.map((input, index) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{
            top: `${(index + 1) * 25}px`,
            background: category.color,
            border: '2px solid white'
          }}
        />
      ))}

      {/* 节点内容 */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 'bold',
            color: category.color,
            marginBottom: 1
          }}
        >
          {data.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem'
          }}
        >
          {category.description}
        </Typography>
        
        {/* 显示配置信息 */}
        {data.config && Object.keys(data.config).length > 0 && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              已配置
            </Typography>
            {Object.entries(data.config).slice(0, 2).map(([key, value]) => (
              <Typography key={key} variant="caption" color="text.secondary" display="block">
                {key}: {String(value).substring(0, 10)}...
              </Typography>
            ))}
            {Object.keys(data.config).length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{Object.keys(data.config).length - 2} 更多
              </Typography>
            )}
          </Box>
        )}
        
        {/* 提示点击配置 */}
        {(!data.config || Object.keys(data.config).length === 0) && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              💡 点击配置
            </Typography>
          </Box>
        )}
      </Box>

      {/* 输出句柄 */}
      {data.outputs && data.outputs.map((output, index) => (
        <Handle
          key={`output-${output.id}`}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{
            top: `${(index + 1) * 25}px`,
            background: category.color,
            border: '2px solid white'
          }}
        />
      ))}
    </Paper>
  );
};

export default CustomNode;