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
  aooi200SwitchConnection: (connectionName: string) => Promise<{ success: boolean; error?: string }>
  aooi200CleanSqlite: () => Promise<{ success: boolean; error?: string }>
  aooi200GenData: (connectionName?: string) => Promise<{ success: boolean; results: { table: string; count: number }[]; error?: string }>
  aooi200ExportTemplate: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  aooi200ImportTemplate: (mode: string, connectionName?: string) => Promise<{ success: boolean; canceled?: boolean; rows?: ImportRow[]; error?: string }>
  aooi200ExportResult: (rows: unknown[], ooba001?: string) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
  aooi200ExportConfig: () => Promise<{ success: boolean; canceled?: boolean; results?: { table: string; count: number }[]; error?: string }>
  aooi200ImportConfig: () => Promise<{ success: boolean; canceled?: boolean; results?: { table: string; count: number }[]; error?: string }>
  aooi200QueryEnt: () => Promise<{ success: boolean; rows: { gzou001: string; gzou003: string }[]; error?: string }>
  aooi200QueryWfOobx: (schema: string, ent: number) => Promise<{ success: boolean; rows: WfOobxRow[]; error?: string }>
  aooi200ReplaceOoblWf: (schema: string, ent: number, rows: WfOobxRow[]) => Promise<{ success: boolean; count?: number; error?: string }>
  aooi200QueryOoba001List: (schema: string, ent: number) => Promise<{ success: boolean; list: string[]; error?: string }>
  aooi200CompareOobaRef: (schemaFrom: string, schemaTo: string, ent1: number, ent2: number, ooba001From: string, ooba001To: string) =>
    Promise<{ success: boolean; matched: MatchedOobaRow[]; onlyEnt1: OobaRefRow[]; onlyEnt2: OobaRefRow[]; error?: string }>
  aooi200ValidateDocConfig: (schemaFrom: string, schemaTo: string, ent1: number, ent2: number, ooba001From: string, ooba001To: string, ooba002List: string[], mode: string) =>
    Promise<{ success: boolean; errors: ValidateError[]; error?: string }>
  aooi200CopyDocConfig: (schemaFrom: string, schemaTo: string, ent1: number, ent2: number, ooba001From: string, ooba001To: string, ooba002List: string[], mode: string) =>
    Promise<{ success: boolean; timestamp: number; results: { table: string; deleted: number; inserted: number }[]; errors: ValidateError[]; error?: string }>
  aooi200RestoreFromBackup: (schema: string, timestamp: number) =>
    Promise<{ success: boolean; restored: string[]; error?: string }>
  aooi200CleanBackups: (schema: string, timestamp?: number) =>
    Promise<{ success: boolean; cleaned: string[]; error?: string }>
  aooi200ListBackups: (schema: string) => Promise<{ success: boolean; versions: BackupVersion[]; error?: string }>
  // 参数差异查询 API
  getEnterpriseParams: (ent: string, dlang: string) => Promise<{ success: boolean; rows: EnterpriseParamRow[]; error?: string }>
  getSiteParams: (ent: string, site: string, dlang: string) => Promise<{ success: boolean; rows: SiteParamRow[]; error?: string }>
  getSites: (ent: string) => Promise<{ success: boolean; sites: string[]; error?: string }>

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

  interface ImportRow {
    oobxent: number
    oobx001: string
    oobx002: string | null
    oobx003: string | null
    oobx004: string | null
    oobx005: string | null
    oobx006: string | null
    oobx007: number | null
    oobx008: string | null
    oobx009: string | null
    oobxstus: string | null
    oobxl003: string
  }

  interface WfOobxRow {
    oobx001: string
    oobxl003: string | null
    oobx004: string | null
    oobx003: string | null
    oobx002: string | null
  }

  interface OobaRefRow {
    ooba002: string
    oobxl003: string | null
    oobx002: string | null
    oobx003: string | null
    oobx004: string | null
  }

  interface MatchedOobaRow {
    ooba002: string
    oobxl003Ent1: string | null
    oobxl003Ent2: string | null
    oobx002: string | null
    oobx003: string | null
    oobx004: string | null
  }

  interface ValidateError {
    table: string
    field: string
    label: string
    value: string
    message: string
  }

  interface BackupVersion {
    timestamp: number
    tables: string[]
  }
}

export {}
