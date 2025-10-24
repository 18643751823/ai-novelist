import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Chip
} from '@mui/material';

const NodeConfigPanel = ({ node, onConfigChange, onClose }) => {
  if (!node) {
    return (
      <Paper
        elevation={3}
        sx={{
          width: 300,
          height: '100%',
          backgroundColor: 'background.paper',
          p: 2
        }}
      >
        <Typography variant="h6" color="text.secondary" align="center">
          选择节点进行配置
        </Typography>
      </Paper>
    );
  }

  const { data } = node;
  const { name, category, inputs = [], outputs = [], config = {} } = data;

  // 处理配置变更
  const handleConfigChange = (key, value) => {
    const newConfig = {
      ...config,
      [key]: value
    };
    onConfigChange(node.id, newConfig);
  };

  // 渲染不同类型的输入字段
  const renderInputField = (input) => {
    const { id, type, label, options } = input;
    const value = config[id] || '';

    switch (type) {
      case 'string':
        return (
          <TextField
            key={id}
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handleConfigChange(id, e.target.value)}
            size="small"
            margin="dense"
            multiline={input.multiline}
            rows={input.multiline ? 4 : 1}
            placeholder={input.defaultValue ? `默认: ${input.defaultValue}` : ''}
          />
        );
      
      case 'number':
        return (
          <TextField
            key={id}
            fullWidth
            type="number"
            label={label}
            value={value}
            onChange={(e) => handleConfigChange(id, parseFloat(e.target.value) || 0)}
            size="small"
            margin="dense"
            placeholder={input.defaultValue ? `默认: ${input.defaultValue}` : ''}
          />
        );
      
      case 'boolean':
        return (
          <FormControl fullWidth size="small" margin="dense" key={id}>
            <InputLabel>{label}</InputLabel>
            <Select
              value={value}
              label={label}
              onChange={(e) => handleConfigChange(id, e.target.value)}
            >
              <MenuItem value={true}>是</MenuItem>
              <MenuItem value={false}>否</MenuItem>
            </Select>
          </FormControl>
        );
      
      case 'select':
        return (
          <FormControl fullWidth size="small" margin="dense" key={id}>
            <InputLabel>{label}</InputLabel>
            <Select
              value={value}
              label={label}
              onChange={(e) => handleConfigChange(id, e.target.value)}
            >
              {options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      default:
        return (
          <TextField
            key={id}
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handleConfigChange(id, e.target.value)}
            size="small"
            margin="dense"
          />
        );
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: 300,
        height: '100%',
        backgroundColor: 'background.paper',
        overflow: 'auto'
      }}
    >
      {/* 头部 */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {name}
          </Typography>
          <Button size="small" onClick={onClose}>
            关闭
          </Button>
        </Box>
        <Chip
          label={category.name}
          size="small"
          sx={{
            backgroundColor: category.color,
            color: 'white',
            fontSize: '0.75rem'
          }}
        />
      </Box>

      {/* 配置表单 */}
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
          节点配置
        </Typography>

        {inputs.length > 0 ? (
          inputs.map((input) => (
            <Box key={input.id} sx={{ mb: 2 }}>
              {renderInputField(input)}
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" align="center">
            该节点无需配置
          </Typography>
        )}

        {/* 输入输出信息 */}
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          输入输出
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            输入端口:
          </Typography>
          {inputs.map((input) => (
            <Chip
              key={input.id}
              label={`${input.label} (${input.type})`}
              size="small"
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
            />
          ))}
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            输出端口:
          </Typography>
          {outputs.map((output) => (
            <Chip
              key={output.id}
              label={`${output.label} (${output.type})`}
              size="small"
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  );
};

export default NodeConfigPanel;