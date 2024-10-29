// preload.cjs

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        // 許可されたチャネルのみを受け付ける
        const validChannels = ['save-data', 'load-data'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = ['show-confirm-dialog'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    on: (channel, func) => {
        const validChannels = ['load-data-reply', 'save-data-reply'];
        if (validChannels.includes(channel)) {
            // イベントオブジェクトを除去してコールバックを実行
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
});
