const { contextBridge, ipcRenderer } = require('electron');

// Define GM-like APIs (fetch and localStorage-based implementations)
function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

function GM_addElement(tagName, attributes) {
    const element = document.createElement(tagName);
    for (const [key, value] of Object.entries(attributes)) {
        element[key] = value;
    }
    document.body.appendChild(element);
    return element;
}

const GM_API = `
    if (typeof GM_xmlhttpRequest === 'undefined') {
        window.GM_xmlhttpRequest = function(details) {
            return fetch(details.url, {
                method: details.method || 'GET',
                headers: details.headers || {},
                body: details.data || null,
            }).then(response => response.text());
        };
    }

    if (typeof GM_setValue === 'undefined') {
        window.GM_setValue = function(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        };
    }

    if (typeof GM_getValue === 'undefined') {
        window.GM_getValue = function(key, defaultValue) {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        };
    }

    if (typeof GM_deleteValue === 'undefined') {
        window.GM_deleteValue = function(key) {
            localStorage.removeItem(key);
        };
    }

    if (typeof GM_log === 'undefined') {
        window.GM_log = console.log;
    }
`;

// Inject the GM API into the page context
window.addEventListener('DOMContentLoaded', () => {
    window.eval(GM_API);
});

// Listen for the script being sent from the main process
ipcRenderer.on('inject-userscript', (event, scriptContent) => {
  try {
    // Evaluate the userscript content
    eval(scriptContent);
  } catch (error) {
    console.error('Failed to inject userscript:', error);
  }
});

// Expose Electron-related APIs to the renderer
contextBridge.exposeInMainWorld('electron', {
    sendUrl: (url) => ipcRenderer.send('url', url),
    receiveStoredUrl: (callback) => ipcRenderer.on('stored-url', callback),
    receivePageContent: (callback) => ipcRenderer.on('page-content', callback),
});

// Expose GM-like functions to the renderer
contextBridge.exposeInMainWorld('GM', {
    addStyle: GM_addStyle,
    xmlhttpRequest: (details) => ipcRenderer.invoke('gm-xmlhttp-request', details),
    setValue: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    getValue: (key, defaultValue) => {
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : defaultValue;
    },
    deleteValue: (key) => localStorage.removeItem(key),
    notification: (options) => {
        const notification = new Notification(options.title || 'Notification', {
            body: options.text || '',
            icon: options.image || undefined,
        });
        if (options.onclick) {
            notification.onclick = options.onclick;
        }
    },
    addElement: GM_addElement,
});
