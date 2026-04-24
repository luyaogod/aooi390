/// <reference types="vite/client" />

interface SQLiteStatus {
  connected: boolean
  status: string
  dbType: string
  dbPath: string
  error?: string
}

interface ExternalDBConnection {
  id: string
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

interface ElectronAPI {
  getSQLiteStatus: () => Promise<SQLiteStatus>
  getExternalDBConnections: () => Promise<ExternalDBConnectionsResult>
  testExternalDBConnection: (connectionId: string) => Promise<ExternalDBTestResult>
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  off: (channel: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
