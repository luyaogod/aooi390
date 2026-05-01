import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // SQLite 本地数据库 API
  getSQLiteStatus: () => ipcRenderer.invoke('db:get-sqlite-status'),

  // 外部数据库 API
  getExternalDBConnections: () => ipcRenderer.invoke('db:get-external-connections'),
  testExternalDBConnection: (connectionName: string) => ipcRenderer.invoke('db:test-external-connection', connectionName),
  refreshExternalDBConnections: () => ipcRenderer.invoke('db:refresh-connections'),
  editExternalDBConfig: () => ipcRenderer.invoke('db:edit-config'),

  // Azzi001 同步 API
  getAzzi001SyncTables: () => ipcRenderer.invoke('azzi001:get-sync-tables'),
  getAzzi001List: () => ipcRenderer.invoke('azzi001:get-ent-list'),
  azzi001Preview: (sourceEnt: number) => ipcRenderer.invoke('azzi001:preview', sourceEnt),
  azzi001SyncAll: (sourceEnt: number, targetEnt: number) => ipcRenderer.invoke('azzi001:sync-all', sourceEnt, targetEnt),

  // Aooi200 校验 API
  getAooi200EntList: () => ipcRenderer.invoke('aooi200:get-ent-list'),
  getAooi200Ooba001List: (ent: number) => ipcRenderer.invoke('aooi200:get-ooba001-list', ent),
  aooi200EcomCheck: (entFrom: string, entTo: string) => ipcRenderer.invoke('aooi200:ecom-check', entFrom, entTo),
  getAooi200SccOptions: (scc: string) => ipcRenderer.invoke('aooi200:get-scc-options', scc),
  aooi200ValidateAooi199: (entFrom: string, entTo: string, dlang: string, mode: string, oobx006?: string, recalculate?: boolean) => ipcRenderer.invoke('aooi200:validate-aooi199', entFrom, entTo, dlang, mode, oobx006, recalculate),
  aooi200ValidateAooi200: (entFrom: string, entTo: string, dlang: string, ooba001: string, mode: string) => ipcRenderer.invoke('aooi200:validate-aooi200', entFrom, entTo, dlang, ooba001, mode),
  aooi200SwitchConnection: (connectionName: string) => ipcRenderer.invoke('aooi200:switch-connection', connectionName),
  aooi200CleanSqlite: () => ipcRenderer.invoke('aooi200:clean-sqlite'),
  aooi200GenData: (connectionName?: string) => ipcRenderer.invoke('aooi200:gen-data', connectionName),
  aooi200ExportTemplate: () => ipcRenderer.invoke('aooi200:export-template'),
  aooi200ImportTemplate: (mode: string, connectionName?: string) => ipcRenderer.invoke('aooi200:import-template', mode, connectionName),
  aooi200ExportResult: (rows: unknown[], ooba001?: string) => ipcRenderer.invoke('aooi200:export-result', rows, ooba001),
  aooi200ExportConfig: () => ipcRenderer.invoke('aooi200:export-config'),
  aooi200ImportConfig: () => ipcRenderer.invoke('aooi200:import-config'),

  // IC行业单据别批次设置MULTI
  aooi200QueryEnt: () => ipcRenderer.invoke('aooi200:query-ent'),
  aooi200QueryWfOobx: (ent: number) => ipcRenderer.invoke('aooi200:query-wf-oobx', ent),
  aooi200ReplaceOoblWf: (ent: number, rows: unknown[]) => ipcRenderer.invoke('aooi200:replace-oobl-wf', ent, rows),
  onAooi200ValidationProgress: (callback: (data: { current: number; total: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { current: number; total: number }) => callback(data)
    ipcRenderer.on('aooi200:validation-progress', listener)
    return () => { ipcRenderer.removeListener('aooi200:validation-progress', listener) }
  },

  // 参数差异查询 API
  getEnterpriseParams: (ent: string, dlang: string) => ipcRenderer.invoke('param-diff:enterprise-params', ent, dlang),
  getSiteParams: (ent: string, site: string, dlang: string) => ipcRenderer.invoke('param-diff:site-params', ent, site, dlang),
  getSites: (ent: string) => ipcRenderer.invoke('param-diff:sites', ent),

  // T100 全局变量 API
  getT100Configs: () => ipcRenderer.invoke('t100:get-configs'),
  getT100ActiveConfig: () => ipcRenderer.invoke('t100:get-active-config'),
  setT100ActiveConfig: (name: string) => ipcRenderer.invoke('t100:set-active-config', name),
  refreshT100Configs: () => ipcRenderer.invoke('t100:refresh-configs'),
  editT100Config: () => ipcRenderer.invoke('t100:edit-config'),

  // 通用 IPC（保留原有能力）
  on(channel: string, listener: (...args: unknown[]) => void) {
    return ipcRenderer.on(channel, (_event, ...args) => listener(...args))
  },
  off(channel: string, listener: (...args: unknown[]) => void) {
    return ipcRenderer.off(channel, listener)
  },
})
