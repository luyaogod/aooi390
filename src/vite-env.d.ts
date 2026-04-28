/// <reference types="vite/client" />

interface SQLiteStatus {
  connected: boolean
  status: string
  dbType: string
  dbPath: string
  error?: string
}

interface ExternalDBConnection {
  name: string
  type: 'kingbase' | 'oracle'
  isDefault?: boolean
  description?: string
}

interface ExternalDBConnectionsResult {
  success: boolean
  connections: ExternalDBConnection[]
  error?: string
}

interface ExternalDBTestResult {
  success: boolean
  connected: boolean
  message: string
  dbType?: string
  name?: string
}

interface Azzi001SyncTableConfig {
  tableName: string
  entField: string
}

interface Azzi001SyncPreview {
  tableName: string
  entField: string
  sourceCount: number
}

interface Azzi001SyncStepResult {
  tableName: string
  success: boolean
  sourceCount: number
  tempCount: number
  deletedCount: number
  insertedCount: number
  verifyCount: number
  error?: string
}

interface Azzi001SyncAllResult {
  success: boolean
  results: Azzi001SyncStepResult[]
  message: string
}

interface T100GlobalItem {
  name: string
  globals: {
    g_user: string
    g_dept: string
    g_enterprise: string
    g_site: string
    g_lang: string
    g_dlang: string
  }
  isDefault?: boolean
  description?: string
}

interface T100ConfigsResult {
  success: boolean
  configs: T100GlobalItem[]
  error?: string
}

interface T100ActiveConfigResult {
  success: boolean
  config: T100GlobalItem | null
  error?: string
}

interface ElectronAPI {
  getSQLiteStatus: () => Promise<SQLiteStatus>
  getExternalDBConnections: () => Promise<ExternalDBConnectionsResult>
  testExternalDBConnection: (connectionName: string) => Promise<ExternalDBTestResult>
  refreshExternalDBConnections: () => Promise<ExternalDBConnectionsResult>
  editExternalDBConfig: () => Promise<{ success: boolean; error?: string }>
  getAzzi001SyncTables: () => Promise<{ success: boolean; tables: Azzi001SyncTableConfig[]; error?: string }>
  getAzzi001List: () => Promise<{ success: boolean; entList: number[]; error?: string }>
  azzi001Preview: (sourceEnt: number) => Promise<{ success: boolean; preview: Azzi001SyncPreview[]; error?: string }>
  azzi001SyncAll: (sourceEnt: number, targetEnt: number) => Promise<Azzi001SyncAllResult>
  getAooi200EntList: () => Promise<{ success: boolean; entList: number[]; error?: string }>
  getAooi200Ooba001List: (ent: number) => Promise<{ success: boolean; ooba001List: string[]; error?: string }>
  aooi200EcomCheck: (entFrom: string, entTo: string) => Promise<Aooi200ValidateResult>
  aooi200Validate: (entFrom: string, entTo: string, dlang: string, ooba001: string, mode: string) => Promise<Aooi200ValidateResult>
  // 参数差异查询 API
  getEnterpriseParams: (ent: string, dlang: string) => Promise<{ success: boolean; rows: EnterpriseParamRow[]; error?: string }>
  getSiteParams: (ent: string, site: string, dlang: string) => Promise<{ success: boolean; rows: SiteParamRow[]; error?: string }>

  getT100Configs: () => Promise<T100ConfigsResult>
  getT100ActiveConfig: () => Promise<T100ActiveConfigResult>
  setT100ActiveConfig: (name: string) => Promise<{ success: boolean }>
  refreshT100Configs: () => Promise<T100ConfigsResult>
  editT100Config: () => Promise<{ success: boolean; error?: string }>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }

  interface Aooi200ValidateError {
    table: string
    field: string
    label: string
    value: string
    message: string
  }

  interface Aooi200ValidateResult {
    success: boolean
    errors: Aooi200ValidateError[]
    message: string
  }

  interface EnterpriseParamRow {
    ooaaent: string
    ooaa001: string
    ooaa002: string
    gzszl004: string
    gzszl005: string
    gzszl006: string
    gzszl007: string
  }

  interface SiteParamRow {
    ooabent: string
    ooabsite: string
    ooab001: string
    ooab002: string
    gzszl004: string
    gzszl005: string
    gzszl006: string
    gzszl007: string
  }
}

export {}
