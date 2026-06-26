const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Crawl control
  startCrawl: (config) => ipcRenderer.invoke('crawl:start', config),
  stopCrawl: () => ipcRenderer.invoke('crawl:stop'),

  // Crawl events
  onProgress: (cb) => ipcRenderer.on('crawl:progress', (e, d) => cb(d)),
  onPage: (cb) => ipcRenderer.on('crawl:page', (e, d) => cb(d)),
  onLog: (cb) => ipcRenderer.on('crawl:log', (e, d) => cb(d)),

  // Export
  exportReport: (format, data) => ipcRenderer.invoke('export:run', { format, data }),

  // Projects (local storage)
  saveProject: (name, data) => ipcRenderer.invoke('project:save', { name, data }),
  listProjects: () => ipcRenderer.invoke('project:list'),
  loadProject: (file) => ipcRenderer.invoke('project:load', file)
});
