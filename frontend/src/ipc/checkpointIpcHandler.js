const ipcRenderer = window.ipcRenderer;

export const saveArchive = async (taskId, message) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:save', { taskId, message });
    return result;
  } catch (error) {
    console.error('Error saving archive:', error);
    throw error;
  }
};

export const restoreNovelArchive = async (taskId, archiveId) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:restoreNovel', { taskId, archiveId });
    return result;
  } catch (error) {
    console.error('Error restoring novel archive:', error);
    throw error;
  }
};

export const restoreChatCheckpoint = async (taskId, archiveId) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:restoreChat', { taskId, archiveId });
    return result;
  } catch (error) {
    console.error('Error restoring chat checkpoint:', error);
    throw error;
  }
};

export const deleteNovelArchive = async (taskId, archiveId) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:delete', { taskId, archiveId });
    return result;
  } catch (error) {
    console.error('Error deleting archive:', error);
    throw error;
  }
};

export const getDiff = async (taskId, from, to) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:getDiff', { taskId, from, to });
    return result;
  } catch (error) {
    console.error('Error getting diff:', error);
    throw error;
  }
};

// We also need a way to get the checkpoint history.
// I'll add the handler for this in the backend, and the function here.
export const getHistory = async (taskId) => {
  try {
    const result = await ipcRenderer.invoke('checkpoints:getHistory', { taskId });
    return result;
  } catch (error) {
    console.error('Error getting history:', error);
    throw error;
  }
};