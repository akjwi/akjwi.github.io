const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const Crawler = require('./backend/crawler');
const { exportCSV, exportJSON, exportHTML } = require('./backend/exporter');

let mainWindow;
let activeCrawler = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0b0e14',
    title: 'SEO Audit Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: Start crawl ----------
ipcMain.handle('crawl:start', async (event, config) => {
  if (activeCrawler) {
    activeCrawler.stop();
  }

  activeCrawler = new Crawler(config, {
    onProgress: (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl:progress', data);
      }
    },
    onPage: (page) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl:page', page);
      }
    },
    onLog: (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl:log', msg);
      }
    }
  });

  try {
    const result = await activeCrawler.run();
    activeCrawler = null;
    return { ok: true, result };
  } catch (err) {
    activeCrawler = null;
    return { ok: false, error: err.message };
  }
});

// ---------- IPC: Stop crawl ----------
ipcMain.handle('crawl:stop', async () => {
  if (activeCrawler) {
    activeCrawler.stop();
    activeCrawler = null;
    return { ok: true };
  }
  return { ok: false, error: 'No active crawl' };
});

// ---------- IPC: Export ----------
ipcMain.handle('export:run', async (event, { format, data }) => {
  const filters = {
    csv: [{ name: 'CSV', extensions: ['csv'] }],
    json: [{ name: 'JSON', extensions: ['json'] }],
    html: [{ name: 'HTML Report', extensions: ['html'] }]
  };

  const defaultName = {
    csv: 'seo-audit.csv',
    json: 'seo-audit.json',
    html: 'seo-report.html'
  };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report',
    defaultPath: defaultName[format],
    filters: filters[format]
  });

  if (canceled || !filePath) return { ok: false, error: 'Cancelled' };

  try {
    let content;
    if (format === 'csv') content = exportCSV(data);
    else if (format === 'json') content = exportJSON(data);
    else if (format === 'html') content = exportHTML(data);

    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------- IPC: Save / Load local project data ----------
const userDataDir = () => {
  const dir = path.join(app.getPath('userData'), 'projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

ipcMain.handle('project:save', async (event, { name, data }) => {
  try {
    const safe = name.replace(/[^a-z0-9_\-]/gi, '_');
    const file = path.join(userDataDir(), `${safe}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('project:list', async () => {
  try {
    const files = fs.readdirSync(userDataDir()).filter(f => f.endsWith('.json'));
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('project:load', async (event, fileName) => {
  try {
    const file = path.join(userDataDir(), fileName);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
