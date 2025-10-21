import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 提取文件名的辅助函数（浏览器环境兼容）
const getFileName = (filePath) => {
  // 移除 novel/ 前缀
  const cleanPath = filePath.replace(/^novel\//, '');
  // 提取文件名（不含扩展名）
  const baseName = cleanPath.split('/').pop().split('\\').pop();
  return baseName.replace(/\.txt$/, '');
};

// 异步 action 来创建小说文件
export const createNovelFile = createAsyncThunk(
  'novel/createNovelFile',
  async ({ filePath }, { rejectWithValue }) => { // 接收 filePath 参数
    try {
      // 假设 window.ipcRenderer 可用 (由 Electron 预加载脚本注入)
      if (window.ipcRenderer) {
        // 调用主进程，传入文件路径和空内容
        const result = await window.ipcRenderer.invoke('create-novel-file', { filePath, content: '' });
        if (result.success) {
          return { newFilePath: result.newFilePath };
        } else {
          return rejectWithValue(result.error);
        }
      } else {
        // 非Electron环境下的模拟或错误处理
        console.warn('ipcRenderer is not available. Simulating file creation.');
        // 在非Electron环境下，可以模拟成功
        return { newFilePath: filePath }; // 模拟成功，返回传入的 filePath
      }
    } catch (error) {
      console.error('Failed to create novel file:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 异步 action 来更新小说文件标题
export const updateNovelTitle = createAsyncThunk(
  'novel/updateNovelTitle',
  async ({ oldFilePath, newTitle }, { rejectWithValue }) => {
    try {
      if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke('update-novel-title', { oldFilePath, newTitle });
        if (result.success) {
          return { newFilePath: result.newFilePath };
        } else {
          return rejectWithValue(result.error);
        }
      } else {
        console.warn('ipcRenderer is not available. Simulating title update.');
        return { newFilePath: `novel/${newTitle}.md` }; // 模拟新的文件路径
      }
    } catch (error) {
      console.error('Failed to update novel title:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 异步 action 来打开或切换标签页
export const openTab = createAsyncThunk(
  'novel/openTab',
  async (filePath, { dispatch, getState, rejectWithValue }) => {
    const { novel } = getState();
    const existingTab = novel.openTabs.find(tab => tab.id === filePath);

    if (existingTab) {
      dispatch(setActiveTab(filePath));
      return { isExisting: true, filePath };
    }

    try {
      if (window.ipcRenderer) {
        // 修正：使用正确的 IPC 通道 'load-chapter-content'
        const result = await window.ipcRenderer.invoke('load-chapter-content', filePath);
        if (result.success) {
          return { filePath, content: result.content, isExisting: false };
        } else {
          throw new Error(result.error);
        }
      } else {
        console.warn('ipcRenderer is not available. Simulating file open.');
        return { filePath, content: `模拟内容 for ${filePath}`, isExisting: false };
      }
    } catch (error) {
      console.error(`Failed to open or read file ${filePath}:`, error);
      return rejectWithValue(error.message);
    }
  }
);

const novelSlice = createSlice({
  name: 'novel',
  initialState: {
    openTabs: [], // { id, title, content, originalContent, suggestedContent, isDirty, viewMode }
    activeTabId: null,
    chapters: [], // 用于存储章节列表
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    refreshCounter: 0,
    // 分屏对比相关状态
    splitView: {
      enabled: false,
      layout: 'horizontal', // 'horizontal' | 'vertical'
      leftTabId: null,
      rightTabId: null,
    },
  },
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTabId = action.payload;
    },
    closeTab: (state, action) => {
      const tabIdToClose = action.payload;
      const tabIndex = state.openTabs.findIndex(tab => tab.id === tabIdToClose);

      if (tabIndex === -1) return;

      // 移除标签页
      state.openTabs.splice(tabIndex, 1);

      // 如果关闭的是当前激活的标签页，则决定下一个激活的标签页
      if (state.activeTabId === tabIdToClose) {
        if (state.openTabs.length > 0) {
          // 优先激活右边的，如果不存在则激活左边的
          const newActiveIndex = Math.min(tabIndex, state.openTabs.length - 1);
          state.activeTabId = state.openTabs[newActiveIndex].id;
        } else {
          state.activeTabId = null;
        }
      }
    },
    updateTabContent: (state, action) => {
      const { tabId, content, isDirty } = action.payload;
      const tab = state.openTabs.find(t => t.id === tabId);
      if (tab) {
        tab.content = content;
        // isDirty 可以被显式传递，例如在保存成功后设为 false
        tab.isDirty = isDirty !== undefined ? isDirty : true;
      }
    },
    startDiff: (state, action) => {
      const { tabId, suggestion } = action.payload;
      const tab = state.openTabs.find(t => t.id === tabId);
      if (tab) {
        tab.suggestedContent = suggestion;
        tab.viewMode = 'diff';
      }
    },
    acceptSuggestion: (state, action) => {
        const tabId = action.payload;
        const tab = state.openTabs.find(t => t.id === tabId);
        if (tab && tab.viewMode === 'diff') {
            tab.content = tab.suggestedContent;
            tab.suggestedContent = null;
            tab.viewMode = 'edit';
            tab.isDirty = true;
        }
    },
    rejectSuggestion: (state, action) => {
        const tabId = action.payload;
        const tab = state.openTabs.find(t => t.id === tabId);
        if (tab && tab.viewMode === 'diff') {
            tab.suggestedContent = null;
            tab.viewMode = 'edit';
        }
    },
    setChapters: (state, action) => {
      state.chapters = action.payload;
    },
    triggerChapterRefresh: (state) => {
      state.refreshCounter += 1;
    },
    // 新增：用于接收后端推送的最新文件内容并同步状态
    syncFileContent: (state, action) => {
        const { filePath, newContent } = action.payload;
        // 关键修复：规范化后端传来的路径，移除 'novel/' 前缀以匹配 tab.id
        const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
        const tab = state.openTabs.find(t => t.id === cleanFilePath);
        
        if (tab) {
            console.log(`[novelSlice] Matched tab '${cleanFilePath}' for content sync.`);
            tab.content = newContent;
            tab.originalContent = newContent; // 更新原始记录，因为这是最新的权威版本
            tab.suggestedContent = null;
            tab.isDirty = false;
            tab.viewMode = 'edit';
            console.log(`[novelSlice] Tab '${filePath}' content synced and view mode reset.`);
        }
    },
    // 新增：用于处理后端 `write_file` 工具执行后的文件写入事件
    fileWritten: (state, action) => {
      const { filePath, content } = action.payload;
      const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
      const existingTab = state.openTabs.find(tab => tab.id === cleanFilePath);

      if (existingTab) {
        // 如果标签页已存在，更新内容
        existingTab.content = content;
        existingTab.isDirty = false; // 刚从后端写入，认为是干净的
        existingTab.originalContent = content; // 同步原始内容
        existingTab.suggestedContent = null;
        existingTab.viewMode = 'edit';
      } else {
        // 如果是新文件，创建新标签页
        const newTab = {
          id: cleanFilePath,
          title: cleanFilePath.replace(/\.txt$/, ''),
          content: content,
          originalContent: content,
          suggestedContent: null,
          isDirty: false,
          viewMode: 'edit',
        };
        state.openTabs.push(newTab);
        state.activeTabId = cleanFilePath; // 自动切换到新文件
      }
      
      // 触发章节列表刷新
      state.refreshCounter += 1;
    },
    // 新增：处理文件删除事件
    fileDeleted: (state, action) => {
      const { filePath } = action.payload;
      const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
      
      // 标记标签页为已删除状态
      const tab = state.openTabs.find(t => t.id === cleanFilePath);
      if (tab) {
        tab.isDeleted = true;
        // 如果删除的是当前激活的标签页，切换到下一个可用的标签页
        if (state.activeTabId === cleanFilePath) {
          const availableTabs = state.openTabs.filter(t => !t.isDeleted);
          if (availableTabs.length > 0) {
            state.activeTabId = availableTabs[0].id;
          } else {
            state.activeTabId = null;
          }
        }
      }
    },
    // 新增：处理文件重命名事件
    fileRenamed: (state, action) => {
      const { oldFilePath, newFilePath } = action.payload;
      const cleanOldPath = oldFilePath.startsWith('novel/') ? oldFilePath.substring(6) : oldFilePath;
      const cleanNewPath = newFilePath.startsWith('novel/') ? newFilePath.substring(6) : newFilePath;
      
      // 更新标签页的ID和标题
      const tab = state.openTabs.find(t => t.id === cleanOldPath);
      if (tab) {
        tab.id = cleanNewPath;
        tab.title = getFileName(cleanNewPath);
        // 如果是当前激活的标签页，也更新activeTabId
        if (state.activeTabId === cleanOldPath) {
          state.activeTabId = cleanNewPath;
        }
      }
    },
    // 新增：拖动排序标签页
    reorderTabs: (state, action) => {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      
      const [movedTab] = state.openTabs.splice(fromIndex, 1);
      state.openTabs.splice(toIndex, 0, movedTab);
    },
    // 新增：分屏对比相关操作
    enableSplitView: (state, action) => {
      const { leftTabId, rightTabId, layout = 'horizontal' } = action.payload;
      state.splitView.enabled = true;
      state.splitView.leftTabId = leftTabId;
      state.splitView.rightTabId = rightTabId;
      state.splitView.layout = layout;
    },
    disableSplitView: (state) => {
      state.splitView.enabled = false;
      state.splitView.leftTabId = null;
      state.splitView.rightTabId = null;
    },
    setSplitViewLayout: (state, action) => {
      state.splitView.layout = action.payload;
    },
    setSplitViewTabs: (state, action) => {
      const { leftTabId, rightTabId } = action.payload;
      state.splitView.leftTabId = leftTabId;
      state.splitView.rightTabId = rightTabId;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createNovelFile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createNovelFile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const newFilePath = action.payload.newFilePath;
        const newTab = {
          id: newFilePath,
          title: getFileName(newFilePath),
          content: '',
          originalContent: null,
          suggestedContent: null,
          isDirty: false,
          viewMode: 'edit',
        };
        state.openTabs.push(newTab);
        state.activeTabId = newFilePath;
      })
      .addCase(createNovelFile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(updateNovelTitle.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateNovelTitle.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const { oldFilePath } = action.meta.arg;
        const { newFilePath } = action.payload;

        // 更新 tab
        const tab = state.openTabs.find(t => t.id === oldFilePath);
        if (tab) {
          tab.id = newFilePath;
          tab.title = getFileName(newFilePath);
        }

        // 如果是当前激活的 tab，也更新 activeTabId
        if (state.activeTabId === oldFilePath) {
          state.activeTabId = newFilePath;
        }

        // 更新 chapters 列表
        state.chapters = state.chapters.map(chapter =>
          chapter === oldFilePath ? newFilePath : chapter
        );
      })
      .addCase(updateNovelTitle.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(openTab.fulfilled, (state, action) => {
        if (action.payload.isExisting) {
          state.status = 'succeeded';
          return;
        }
        
        const { filePath, content } = action.payload;
        const newTab = {
          id: filePath,
          title: getFileName(filePath),
          content: content,
          originalContent: null, // This should be the content from disk
          suggestedContent: null,
          isDirty: false,
          viewMode: 'edit',
        };
        state.openTabs.push(newTab);
        state.activeTabId = filePath;
        state.status = 'succeeded';
      })
      .addCase(openTab.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
  },
});

export const {
  setActiveTab,
  closeTab,
  updateTabContent,
  startDiff,
  acceptSuggestion,
  rejectSuggestion,
  setChapters,
  triggerChapterRefresh,
  syncFileContent,
  fileWritten,
  fileDeleted,
  fileRenamed,
  reorderTabs,
  enableSplitView,
  disableSplitView,
  setSplitViewLayout,
  setSplitViewTabs,
} = novelSlice.actions;

// 为兼容性添加别名导出
export const endDiff = rejectSuggestion;
export const setNovelContent = updateTabContent;
export const setCurrentFile = setActiveTab;
export default novelSlice.reducer;