import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setStreamingState } from '../../../store/slices/chatSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';

// 流式传输支持组件
const StreamingSupport = ({ 
  isStreaming, 
  onStopStreaming 
}) => {
  const dispatch = useDispatch();
  const { on, removeListener, stopStreaming: stopStreamingIpc } = useIpcRenderer();

  // 处理ai-response事件，包括流式传输状态
  useEffect(() => {
    const handleAiResponse = (event, data) => {
      const { type, payload } = data;
      
      if (type === 'streaming_started') {
        console.log('[StreamingSupport] 收到流式传输开始事件');
        dispatch(setStreamingState({ isStreaming: true, abortController: null }));
      } else if (type === 'streaming_ended') {
        console.log('[StreamingSupport] 收到流式传输结束事件');
        dispatch(setStreamingState({ isStreaming: false, abortController: null }));
      }
    };

    on('ai-response', handleAiResponse);

    return () => {
      removeListener('ai-response', handleAiResponse);
    };
  }, [on, removeListener, dispatch]);

  // 停止流式传输的处理函数
  const handleStopStreaming = async () => {
    try {
      console.log('[StreamingSupport] 用户点击停止按钮');
      onStopStreaming();
      await stopStreamingIpc();
      console.log('[StreamingSupport] 停止请求已发送到后端');
    } catch (error) {
      console.error('[StreamingSupport] 停止流式传输失败:', error);
    }
  };

  return null; // 这个组件不渲染UI，只处理逻辑
};

export default StreamingSupport;