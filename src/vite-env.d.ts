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

interface SyncResult {
  tableName: string
  success: boolean
  sourceCount: number
  insertedCount: number
  error?: string
}

interface SyncAllResult {
  success: boolean
  results: SyncResult[]
  message: string
}

interface EntSyncTableConfig {
  tableName: string
  entField: string
}

interface EntSyncPreview {
  tableName: string
  entField: string
  sourceCount: number
}

interface EntSyncStepResult {
  tableName: string
  success: boolean
  sourceCount: number
  tempCount: number
  deletedCount: number
  insertedCount: number
  verifyCount: number
  error?: string
}

interface EntSyncAllResult {
  success: boolean
  results: EntSyncStepResult[]
  message: string
}

interface ElectronAPI {
  getSQLiteStatus: () => Promise<SQLiteStatus>
  getExternalDBConnections: () => Promise<ExternalDBConnectionsResult>
  testExternalDBConnection: (connectionName: string) => Promise<ExternalDBTestResult>
  getSyncTables: () => Promise<{ success: boolean; tables: string[]; error?: string }>
  syncAllTables: () => Promise<SyncAllResult>
  getEntSyncTables: () => Promise<{ success: boolean; tables: EntSyncTableConfig[]; error?: string }>
  getEntList: () => Promise<{ success: boolean; entList: number[]; error?: string }>
  entPreview: (sourceEnt: number) => Promise<{ success: boolean; preview: EntSyncPreview[]; error?: string }>
  entSyncAll: (sourceEnt: number, targetEnt: number) => Promise<EntSyncAllResult>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
