import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { appDB, externalDB } from './db/clients'
import { getSqliteDBPath } from './utils/paths'
import { dbConnectionManager } from './config/db-connections'
import { t100GlobalManager } from './config/t100-global'
import { entSyncService } from './core/ent-sync-service'
import logger from './utils/logger'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    show: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.maximize()
  win.show()

  // 隐藏默认菜单栏（File Edit View Window Help）
  Menu.setApplicationMenu(null)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC: 获取 SQLite 数据库连接状态
ipcMain.handle('db:get-sqlite-status', async () => {
  try {
    const isHealthy = await appDB.healthCheck()
    return {
      connected: isHealthy,
      status: isHealthy ? '已连接' : '未连接',
      dbType: 'SQLite',
      dbPath: getSqliteDBPath(),
    }
  } catch (error) {
    return {
      connected: false,
      status: '连接失败',
      dbType: 'SQLite',
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 获取外部数据库连接配置列表
ipcMain.handle('db:get-external-connections', async () => {
  try {
    await dbConnectionManager.initialize()
    const connections = dbConnectionManager.getAllConnections()
    return {
      success: true,
      connections: connections.map(conn => ({
        name: conn.name,
        type: conn.type,
        isDefault: conn.isDefault,
        description: conn.description,
      })),
    }
  } catch (error) {
    logger.error(error, '[Main] 获取外部数据库连接配置失败')
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      connections: [],
    }
  }
})

// IPC: 测试外部数据库连接
ipcMain.handle('db:test-external-connection', async (_event, connectionName: string) => {
  try {
    await dbConnectionManager.initialize()
    const connection = dbConnectionManager.getConnectionByName(connectionName)

    if (!connection) {
      return {
        success: false,
        connected: false,
        message: '未找到连接配置',
      }
    }

    // 先断开当前连接（如果有）
    if (externalDB.isConnected) {
      await externalDB.disconnect()
    }

    // 尝试连接
    await externalDB.connect(
      connection.type === 'kingbase'
        ? { type: 'kingbase', config: connection.config as import('./db/clients').KingbaseConfig }
        : { type: 'oracle', config: connection.config as import('./db/clients').OracleConfig }
    )

    // 健康检查
    const isHealthy = await externalDB.healthCheck()

    if (isHealthy) {
      return {
        success: true,
        connected: true,
        message: `${connection.type === 'kingbase' ? 'Kingbase' : 'Oracle'} 连接成功`,
        dbType: connection.type,
        name: connection.name,
      }
    } else {
      return {
        success: false,
        connected: false,
        message: '连接建立但健康检查失败',
        dbType: connection.type,
        name: connection.name,
      }
    }
  } catch (error) {
    logger.error(error, '[Main] 测试外部数据库连接失败')
    return {
      success: false,
      connected: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 获取ENT同步表配置
ipcMain.handle('ent:get-sync-tables', async () => {
  try {
    const tables = entSyncService.getSyncTables()
    return { success: true, tables }
  } catch (error) {
    logger.error(error, '[Main] 获取ENT同步表配置失败')
    return { success: false, error: String(error), tables: [] }
  }
})

// IPC: 获取ENT编号列表
ipcMain.handle('ent:get-ent-list', async () => {
  try {
    const entList = await entSyncService.getEntList()
    return { success: true, entList }
  } catch (error) {
    logger.error(error, '[Main] 获取ENT列表失败')
    return { success: false, error: String(error), entList: [] }
  }
})

// IPC: ENT同步预览（查询源ENT数据条数）
ipcMain.handle('ent:preview', async (_event, sourceEnt: number) => {
  try {
    const preview = await entSyncService.preview(sourceEnt)
    return { success: true, preview }
  } catch (error) {
    logger.error(error, '[Main] ENT同步预览失败')
    return { success: false, error: String(error), preview: [] }
  }
})

// IPC: 执行ENT同步
ipcMain.handle('ent:sync-all', async (_event, sourceEnt: number, targetEnt: number) => {
  try {
    const result = await entSyncService.syncAll(sourceEnt, targetEnt)
    return result
  } catch (error) {
    logger.error(error, '[Main] ENT同步失败')
    return {
      success: false,
      results: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 获取 T100 全局变量配置列表
ipcMain.handle('t100:get-configs', async () => {
  try {
    await t100GlobalManager.initialize()
    const configs = t100GlobalManager.getAllConfigs()
    return {
      success: true,
      configs: configs.map(c => ({
        name: c.name,
        globals: c.globals,
        isDefault: c.isDefault,
        description: c.description,
      })),
    }
  } catch (error) {
    logger.error(error, '[Main] 获取T100全局配置失败')
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      configs: [],
    }
  }
})

// IPC: 获取当前激活的 T100 全局变量配置
ipcMain.handle('t100:get-active-config', async () => {
  try {
    await t100GlobalManager.initialize()
    const config = t100GlobalManager.getActiveConfig()
    return {
      success: true,
      config: config ? {
        name: config.name,
        globals: config.globals,
        isDefault: config.isDefault,
        description: config.description,
      } : null,
    }
  } catch (error) {
    logger.error(error, '[Main] 获取当前T100配置失败')
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      config: null,
    }
  }
})

// IPC: 切换 T100 全局变量配置
ipcMain.handle('t100:set-active-config', async (_event, name: string) => {
  try {
    await t100GlobalManager.initialize()
    const result = await t100GlobalManager.setActiveConfig(name)
    return { success: result }
  } catch (error) {
    logger.error(error, '[Main] 切换T100配置失败')
    return { success: false }
  }
})

app.whenReady().then(async () => {
  createWindow()

  // Test appDB (SQLite) connection
  logger.info('[Main] Starting database connection test...')
  try {
    await appDB.connect()
    await appDB.testConnection()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(error, '[Main] appDB connection test failed')
    dialog.showErrorBox('SQLite 数据库连接失败', msg)
  }
})
