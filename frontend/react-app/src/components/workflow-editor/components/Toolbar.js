import React from 'react';
import { Box, Button, ButtonGroup, Typography, Paper } from '@mui/material';
import {
  PlayArrow,
  Save,
  Clear,
  ZoomIn,
  ZoomOut,
  FitScreen
} from '@mui/icons-material';

const Toolbar = ({ 
  onRun, 
  onSave, 
  onClear, 
  onZoomIn, 
  onZoomOut, 
  onFitView,
  isRunning = false 
}) => {
  return (
    <Paper 
      elevation={1}
      sx={{
        padding: 2,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 左侧：标题 */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          LangChain 工作流编辑器
        </Typography>

        {/* 中间：操作按钮组 */}
        <ButtonGroup variant="outlined" size="small">
          <Button
            startIcon={<PlayArrow />}
            onClick={onRun}
            disabled={isRunning}
            color="success"
          >
            {isRunning ? '运行中...' : '运行'}
          </Button>
          <Button
            startIcon={<Save />}
            onClick={onSave}
            color="primary"
          >
            保存
          </Button>
          <Button
            startIcon={<Clear />}
            onClick={onClear}
            color="warning"
          >
            清空
          </Button>
        </ButtonGroup>

        {/* 右侧：视图控制 */}
        <ButtonGroup variant="outlined" size="small">
          <Button
            startIcon={<ZoomIn />}
            onClick={onZoomIn}
            title="放大"
          >
            放大
          </Button>
          <Button
            startIcon={<ZoomOut />}
            onClick={onZoomOut}
            title="缩小"
          >
            缩小
          </Button>
          <Button
            startIcon={<FitScreen />}
            onClick={onFitView}
            title="适应视图"
          >
            适应视图
          </Button>
        </ButtonGroup>
      </Box>

      {/* 状态栏 */}
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          💡 拖拽节点构建工作流，连接节点建立数据流
        </Typography>
        <Typography variant="caption" color="text.secondary">
          节点数: 0 | 连接数: 0
        </Typography>
      </Box>
    </Paper>
  );
};

export default Toolbar;