import { app, BrowserWindow, dialog, Menu, session, shell } from "electron";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalServer } from "./local-server.mjs";

const DESKTOP_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MACOS_WINDOW_CSS = `
  .topbar {
    padding-left: 88px !important;
    -webkit-app-region: drag;
  }
  .topbar button,
  .topbar input,
  .topbar select,
  .topbar a,
  .topbar [role="button"] {
    -webkit-app-region: no-drag;
  }
`;
const isDevelopment = !app.isPackaged;
let mainWindow = null;
let localServer = null;

if (!app.requestSingleInstanceLock()) app.quit();

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function isLocalAppUrl(rawUrl, localOrigin) {
  try {
    return new URL(rawUrl).origin === localOrigin;
  } catch {
    return false;
  }
}

function installApplicationMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: "关于图作" },
        { type: "separator" },
        { role: "hide", label: "隐藏图作" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "全部显示" },
        { type: "separator" },
        { role: "quit", label: "退出图作" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新载入" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "进入全屏" },
        ...(isDevelopment
          ? [{ type: "separator" }, { role: "toggleDevTools", label: "开发者工具" }]
          : []),
      ],
    },
    { role: "windowMenu", label: "窗口" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: "图作",
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#e9ecef",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 19 },
    icon: join(DESKTOP_ROOT, "desktop", "resources", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isLocalAppUrl(url, localServer.origin)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(localServer.url);
  if (process.platform === "darwin") {
    await mainWindow.webContents.insertCSS(MACOS_WINDOW_CSS);
  }
  mainWindow.show();
  if (process.env.TUZUO_DESKTOP_SMOKE === "1") {
    console.log(`TUZUO_DESKTOP_READY:${mainWindow.webContents.getTitle()}`);
    setTimeout(() => app.quit(), 100);
  }
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setName("图作");
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  installApplicationMenu();
  localServer = await startLocalServer({ rootDirectory: DESKTOP_ROOT });
  await createWindow();

  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) void createWindow();
  });
}).catch((error) => {
  console.error("Unable to start 图作", error);
  dialog.showErrorBox(
    "图作无法启动",
    "本机运行环境启动失败，请退出图作后重新打开。",
  );
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (localServer) void localServer.close().catch(() => {});
});
