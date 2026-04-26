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
  getAzzi001SyncTables: () => Promise<{ success: boolean; tables: Azzi001SyncTableConfig[]; error?: string }>
  getAzzi001List: () => Promise<{ success: boolean; entList: number[]; error?: string }>
  azzi001Preview: (sourceEnt: number) => Promise<{ success: boolean; preview: Azzi001SyncPreview[]; error?: string }>
  azzi001SyncAll: (sourceEnt: number, targetEnt: number) => Promise<Azzi001SyncAllResult>
  getT100Configs: () => Promise<T100ConfigsResult>
  getT100ActiveConfig: () => Promise<T100ActiveConfigResult>
  setT100ActiveConfig: (name: string) => Promise<{ success: boolean }>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
