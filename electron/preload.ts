import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // SQLite 本地数据库 API
  getSQLiteStatus: () => ipcRenderer.invoke('db:get-sqlite-status'),

  // 外部数据库 API
  getExternalDBConnections: () => ipcRenderer.invoke('db:get-external-connections'),
  testExternalDBConnection: (connectionName: string) => ipcRenderer.invoke('db:test-external-connection', connectionName),

  // ENT 同步 API
  getEntSyncTables: () => ipcRenderer.invoke('ent:get-sync-tables'),
  getEntList: () => ipcRenderer.invoke('ent:get-ent-list'),
  entPreview: (sourceEnt: number) => ipcRenderer.invoke('ent:preview', sourceEnt),
  entSyncAll: (sourceEnt: number, targetEnt: number) => ipcRenderer.invoke('ent:sync-all', sourceEnt, targetEnt),

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
