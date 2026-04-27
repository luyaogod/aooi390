import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // SQLite 本地数据库 API
  getSQLiteStatus: () => ipcRenderer.invoke('db:get-sqlite-status'),

  // 外部数据库 API
  getExternalDBConnections: () => ipcRenderer.invoke('db:get-external-connections'),
  testExternalDBConnection: (connectionName: string) => ipcRenderer.invoke('db:test-external-connection', connectionName),

  // Azzi001 同步 API
  getAzzi001SyncTables: () => ipcRenderer.invoke('azzi001:get-sync-tables'),
  getAzzi001List: () => ipcRenderer.invoke('azzi001:get-ent-list'),
  azzi001Preview: (sourceEnt: number) => ipcRenderer.invoke('azzi001:preview', sourceEnt),
  azzi001SyncAll: (sourceEnt: number, targetEnt: number) => ipcRenderer.invoke('azzi001:sync-all', sourceEnt, targetEnt),

  // Aooi200 校验 API
  getAooi200EntList: () => ipcRenderer.invoke('aooi200:get-ent-list'),
  getAooi200Ooba001List: () => ipcRenderer.invoke('aooi200:get-ooba001-list'),
  aooi200Validate: (entFrom: string, entTo: string, dlang: string, ooba001: string, mode: string) => ipcRenderer.invoke('aooi200:validate', entFrom, entTo, dlang, ooba001, mode),

  // T100 全局变量 API
  getT100Configs: () => ipcRenderer.invoke('t100:get-configs'),
  getT100ActiveConfig: () => ipcRenderer.invoke('t100:get-active-config'),
  setT100ActiveConfig: (name: string) => ipcRenderer.invoke('t100:set-active-config', name),

  // 通用 IPC（保留原有能力）
  on(channel: string, listener: (...args: unknown[]) => void) {
    return ipcRenderer.on(channel, (_event, ...args) => listener(...args))
  },
  off(channel: string, listener: (...args: unknown[]) => void) {
    return ipcRenderer.off(channel, listener)
  },
})
