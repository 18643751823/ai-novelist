const { contextBridge, ipcRenderer } = require('electron');

// 添加 window.api 对象
contextBridge.exposeInMainWorld('api', {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

contextBridge.exposeInMainWorld('electron', {
    setUnsavedChanges: (hasChanges) => ipcRenderer.invoke('set-unsaved-changes', hasChanges),
    onSaveAndQuitRequest: (callback) => {
        ipcRenderer.on('save-and-quit-request', callback);
    },
    sendSaveAndQuitResponse: (result) => {
        ipcRenderer.send('save-and-quit-response', result);
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});