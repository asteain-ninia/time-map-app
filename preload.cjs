// preload.cjs

const { contextBridge, ipcRenderer } = require('electron');

try {
    // ここでは logger の読み込みなどは一切行いません
    // ログをメインプロセスに記録したい場合はレンダラから IPC を送る手法にします

    contextBridge.exposeInMainWorld('electronAPI', {
        send: (channel, data) => {
            try {
                const validChannels = ['save-data', 'load-data', 'start-logging', 'log-message'];
                if (validChannels.includes(channel)) {
                    ipcRenderer.send(channel, data);
                }
            } catch (error) {
                // preload内は簡易的にconsole.errorしておく
                console.error('electronAPI.send() 内でエラー:', error);
            }
        },
        invoke: (channel, data) => {
            try {
                const validChannels = ['show-confirm-dialog'];
                if (validChannels.includes(channel)) {
                    return ipcRenderer.invoke(channel, data);
                }
            } catch (error) {
                console.error('electronAPI.invoke() 内でエラー:', error);
            }
        },
        on: (channel, func) => {
            try {
                const validChannels = ['load-data-reply', 'save-data-reply'];
                if (validChannels.includes(channel)) {
                    ipcRenderer.on(channel, (event, ...args) => func(...args));
                }
            } catch (error) {
                console.error('electronAPI.on() 内でエラー:', error);
            }
        },
    });
} catch (error) {
    console.error('preload.cjs トップレベル エラー:', error);
}
