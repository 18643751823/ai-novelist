import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import fileService from '../../services/fileService.js';

// 提取文件名的辅助函数（浏览器环境兼容）
const getFileName = (filePath) => {
  // 移除 novel/ 前缀
  const cleanPath = filePath.replace(/^novel\//, '');
  // 提取文件名（不含扩展名）
  const baseName = cleanPath.split('/').pop().split('\\').pop();
  const lastDotIndex = baseName.lastIndexOf('.');
  return lastDotIndex !== -1 ? baseName.substring(0, lastDotIndex) : baseName;
};

// 异步 action 来创建小说文件
export const createNovelFile = createAsyncThunk(
  'novel/createNovelFile',
  async ({ filePath }, { rejectWithValue }) => { // 接收 filePath 参数
    try {
      // 使用文件服务创建文件
      const result = await fileService.createFile(filePath, '');
      if (result.success) {
        return { newFilePath: filePath };
      } else {
        return rejectWithValue(result.error);
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
      // 使用文件服务重命名文件
      const result = await fileService.renameItem(oldFilePath, newTitle);
      if (result.success) {
        // 确保返回的路径包含正确的扩展名，但不添加novel/前缀
        const hasExtension = newTitle.includes('.');
        const finalPath = hasExtension ? newTitle : `${newTitle}.md`;
        return { newFilePath: finalPath };
      } else {
        return rejectWithValue(result.error);
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
      // 使用文件服务读取文件内容
      const result = await fileService.readFile(filePath);
      if (result.success) {
        return { filePath, content: result.content, isExisting: false };
      } else {
        throw new Error(result.error);
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
        // isDirty 可以被显式传递，如果没有传递则比较内容是否变化
        if (isDirty !== undefined) {
          tab.isDirty = isDirty;
        } else {
          // 只有当内容与原始内容不同时才标记为脏
          tab.isDirty = content !== tab.originalContent;
        }
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
          title: getFileName(cleanFilePath), // 使用统一的文件名获取函数
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
          originalContent: '', // 设置原始内容为空字符串
          suggestedContent: null,
          isDirty: false, // 新创建的文件不应标记为脏
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
          originalContent: content, // 设置原始内容，用于比较变更
          suggestedContent: null,
          isDirty: false, // 新打开的文件不应标记为脏
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
