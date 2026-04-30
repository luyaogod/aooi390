import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { appDB, externalDB } from './db/clients'
import { getSqliteDBPath } from './utils/paths'
import { dbConnectionManager } from './config/db-connections'
import { t100GlobalManager } from './config/t100-global'
import { syncAzzi001Service } from './core/sync-azzi001'
import { syncAooi200Service } from './core/sync-aooi200'
import { genAooi200, cleanSqliteTables, switchExternalConnection } from './core/gen-aooi200'
import { paramDiffService } from './core/param-diff'
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

// IPC: 获取Azzi001同步表配置
ipcMain.handle('azzi001:get-sync-tables', async () => {
  try {
    const tables = syncAzzi001Service.getSyncTables()
    return { success: true, tables }
  } catch (error) {
    logger.error(error, '[Main] 获取Azzi001同步表配置失败')
    return { success: false, error: String(error), tables: [] }
  }
})

// IPC: 获取ENT编号列表
ipcMain.handle('azzi001:get-ent-list', async () => {
  try {
    const entList = await syncAzzi001Service.getEntList()
    return { success: true, entList }
  } catch (error) {
    logger.error(error, '[Main] 获取ENT列表失败')
    return { success: false, error: String(error), entList: [] }
  }
})

// IPC: Azzi001同步预览（查询源ENT数据条数）
ipcMain.handle('azzi001:preview', async (_event, sourceEnt: number) => {
  try {
    const preview = await syncAzzi001Service.preview(sourceEnt)
    return { success: true, preview }
  } catch (error) {
    logger.error(error, '[Main] Azzi001同步预览失败')
    return { success: false, error: String(error), preview: [] }
  }
})

// IPC: 执行Azzi001同步
ipcMain.handle('azzi001:sync-all', async (_event, sourceEnt: number, targetEnt: number) => {
  try {
    const result = await syncAzzi001Service.syncAll(sourceEnt, targetEnt)
    return result
  } catch (error) {
    logger.error(error, '[Main] Azzi001同步失败')
    return {
      success: false,
      results: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 获取Aooi200 ENT编号列表
ipcMain.handle('aooi200:get-ent-list', async () => {
  try {
    const entList = await syncAooi200Service.getEntList()
    return { success: true, entList }
  } catch (error) {
    logger.error(error, '[Main] 获取Aooi200 ENT列表失败')
    return { success: false, error: String(error), entList: [] }
  }
})

// IPC: 获取Aooi200参照表编号列表
ipcMain.handle('aooi200:get-ooba001-list', async (_event, ent: number) => {
  try {
    const ooba001List = await syncAooi200Service.getOoba001List(ent)
    return { success: true, ooba001List }
  } catch (error) {
    logger.error(error, '[Main] 获取Aooi200参照表编号列表失败')
    return { success: false, error: String(error), ooba001List: [] }
  }
})

// IPC: 获取系统分类码选项
ipcMain.handle('aooi200:get-scc-options', async (_event, scc: string) => {
  try {
    const rows = await syncAooi200Service.getSccOptions(scc)
    return { success: true, rows }
  } catch (error) {
    logger.error(error, '[Main] 获取SCC选项失败')
    return { success: false, rows: [], error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 执行Aooi199校验（单据别字段校验）
ipcMain.handle('aooi200:validate-aooi199', async (event, entFrom: string, entTo: string, dlang: string, mode: string, oobx006?: string, recalculate?: boolean) => {
  try {
    const onProgress = (current: number, total: number) => {
      event.sender.send('aooi200:validation-progress', { current, total })
    }
    const result = await syncAooi200Service.runValidateAooi199(entFrom, entTo, dlang, mode as 'collect' | 'failFast', oobx006, recalculate, onProgress)
    return result
  } catch (error) {
    logger.error(error, '[Main] Aooi199校验失败')
    return {
      success: false,
      errors: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 执行Aooi200校验
ipcMain.handle('aooi200:validate-aooi200', async (event, entFrom: string, entTo: string, dlang: string, ooba001: string, mode: string) => {
  try {
    const onProgress = (current: number, total: number) => {
      event.sender.send('aooi200:validation-progress', { current, total })
    }
    const result = await syncAooi200Service.runValidateAooi200(entFrom, entTo, dlang, ooba001, mode as 'collect' | 'failFast', onProgress)
    return result
  } catch (error) {
    logger.error(error, '[Main] Aooi200校验失败')
    return {
      success: false,
      errors: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 执行Aooi200 E-COM 参数检查
ipcMain.handle('aooi200:ecom-check', async (_event, entFrom: string, entTo: string) => {
  try {
    const result = await syncAooi200Service.runEcomCheck(entFrom, entTo)
    return result
  } catch (error) {
    logger.error(error, '[Main] Aooi200 E-COM 参数检查失败')
    return {
      success: false,
      errors: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

// IPC: 切换外部数据库连接
ipcMain.handle('aooi200:switch-connection', async (_event, connectionName: string) => {
  try {
    await switchExternalConnection(connectionName)
    return { success: true }
  } catch (error) {
    logger.error(error, '[Main] 切换外部连接失败')
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 清空 SQLite gen-aooi200 相关表
ipcMain.handle('aooi200:clean-sqlite', async () => {
  try {
    await cleanSqliteTables()
    return { success: true }
  } catch (error) {
    logger.error(error, '[Main] 清空 SQLite 表失败')
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 同步 gen-aooi200 数据到内部 SQLite
ipcMain.handle('aooi200:gen-data', async (_event, connectionName?: string) => {
  try {
    const results = await genAooi200(connectionName)
    return { success: true, results }
  } catch (error) {
    logger.error(error, '[Main] genAooi200 同步失败')
    return { success: false, results: [], error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 查询集团级参数
ipcMain.handle('param-diff:enterprise-params', async (_event, ent: string, dlang: string) => {
  try {
    const rows = await paramDiffService.getEnterpriseParams(ent, dlang)
    return { success: true, rows }
  } catch (error) {
    logger.error(error, '[Main] 查询集团级参数失败')
    return { success: false, error: error instanceof Error ? error.message : String(error), rows: [] }
  }
})

// IPC: 查询据点级参数
ipcMain.handle('param-diff:site-params', async (_event, ent: string, site: string, dlang: string) => {
  try {
    const rows = await paramDiffService.getSiteParams(ent, site, dlang)
    return { success: true, rows }
  } catch (error) {
    logger.error(error, '[Main] 查询据点级参数失败')
    return { success: false, error: error instanceof Error ? error.message : String(error), rows: [] }
  }
})

// IPC: 查询指定集团的据点列表
ipcMain.handle('param-diff:sites', async (_event, ent: string) => {
  try {
    const sites = await paramDiffService.getSites(ent)
    return { success: true, sites }
  } catch (error) {
    logger.error(error, '[Main] 查询据点列表失败')
    return { success: false, error: error instanceof Error ? error.message : String(error), sites: [] }
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

// IPC: 用系统默认程序打开配置文件
ipcMain.handle('config:open-file', async (_event, filePath: string) => {
  try {
    const result = await shell.openPath(filePath)
    if (result) {
      logger.warn('[Main] 打开文件失败: %s, 错误: %s', filePath, result)
      return { success: false, error: result }
    }
    return { success: true }
  } catch (error) {
    logger.error(error, '[Main] 打开文件失败')
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 刷新外部数据库连接配置
ipcMain.handle('db:refresh-connections', async () => {
  try {
    await dbConnectionManager.reload()
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
    logger.error(error, '[Main] 刷新外部数据库连接配置失败')
    return { success: false, error: error instanceof Error ? error.message : String(error), connections: [] }
  }
})

// IPC: 编辑外部数据库配置文件
ipcMain.handle('db:edit-config', async () => {
  try {
    const filePath = dbConnectionManager.getConfigFilePath()
    const result = await shell.openPath(filePath)
    if (result) {
      return { success: false, error: result }
    }
    return { success: true }
  } catch (error) {
    logger.error(error, '[Main] 打开外部数据库配置文件失败')
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// IPC: 刷新 T100 全局变量配置
ipcMain.handle('t100:refresh-configs', async () => {
  try {
    await t100GlobalManager.reload()
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
    logger.error(error, '[Main] 刷新T100全局配置失败')
    return { success: false, error: error instanceof Error ? error.message : String(error), configs: [] }
  }
})

// IPC: 编辑 T100 全局变量配置文件
ipcMain.handle('t100:edit-config', async () => {
  try {
    const filePath = t100GlobalManager.getConfigFilePath()
    const result = await shell.openPath(filePath)
    if (result) {
      return { success: false, error: result }
    }
    return { success: true }
  } catch (error) {
    logger.error(error, '[Main] 打开T100配置文件失败')
    return { success: false, error: error instanceof Error ? error.message : String(error) }
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
