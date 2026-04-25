import * as fs from 'fs';
import { appDB, externalDB } from '../db/clients';
import { pathManager } from '../utils/paths';
import { dbConnectionManager } from '../config/db-connections';
import logger from '../utils/logger';

// ==================== 类型定义 ====================

interface SyncConfig {
  tables: string[];
}

export interface SyncResult {
  tableName: string;
  success: boolean;
  sourceCount: number;
  insertedCount: number;
  error?: string;
}

export interface SyncAllResult {
  success: boolean;
  results: SyncResult[];
  message: string;
}

// ==================== DBSyncService ====================

/**
 * 数据库同步服务
 * 将外部数据库（Kingbase/Oracle）的数据同步到本地 SQLite
 * 支持全量同步（清空本地表后插入）
 */
export class DBSyncService {
  private syncConfigPath: string;

  constructor() {
    this.syncConfigPath = pathManager.getConfigFile('table-names-sync.json');
  }

  /**
   * 加载同步配置
   */
  public async loadSyncConfig(): Promise<SyncConfig> {
    try {
      const data = await fs.promises.readFile(this.syncConfigPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(error, '[DBSyncService] 加载同步配置失败');
      return { tables: [] };
    }
  }

  /**
   * 确保外部数据库已连接
   * 如果未连接，尝试使用默认连接配置连接
   */
  public async ensureExternalDBConnected(): Promise<boolean> {
    if (externalDB.isConnected) {
      return true;
    }

    try {
      await dbConnectionManager.initialize();
      const defaultConn = dbConnectionManager.getDefaultConnection();

      if (!defaultConn) {
        logger.error('[DBSyncService] 未找到默认外部数据库连接配置');
        return false;
      }

      await externalDB.connect(
        defaultConn.type === 'kingbase'
          ? { type: 'kingbase', config: defaultConn.config as import('../db/clients').KingbaseConfig }
          : { type: 'oracle', config: defaultConn.config as import('../db/clients').OracleConfig }
      );

      logger.info('[DBSyncService] 外部数据库已连接: %s', defaultConn.name);
      return true;
    } catch (error) {
      logger.error(error, '[DBSyncService] 连接外部数据库失败');
      return false;
    }
  }

  /**
   * 同步单张表
   * @param tableName 表名
   */
  public async syncTable(tableName: string): Promise<SyncResult> {
    const result: SyncResult = {
      tableName,
      success: false,
      sourceCount: 0,
      insertedCount: 0,
    };

    try {
      // 1. 检查外部数据库连接
      const connected = await this.ensureExternalDBConnected();
      if (!connected) {
        result.error = '外部数据库未连接';
        return result;
      }

      // 2. 从外部数据库查询数据
      logger.info('[DBSyncService] 开始同步表: %s', tableName);
      const queryResult = await externalDB.query(`SELECT * FROM "${tableName}"`);

      // 处理不同数据库驱动的结果格式
      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(queryResult.rows)) {
        rows = queryResult.rows as Record<string, unknown>[];
      }

      result.sourceCount = rows.length;
      logger.info('[DBSyncService] %s: 从外部数据库读取到 %d 条记录', tableName, rows.length);

      if (rows.length === 0) {
        // 清空本地表
        const prisma = appDB.getPrisma();
        await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
        result.success = true;
        return result;
      }

      // 3. 在 SQLite 中同步数据
      const prisma = appDB.getPrisma();

      // 标准化字段名（Oracle 返回大写，统一转小写）
      const rawColumns = Object.keys(rows[0]);
      const columns = rawColumns.map(c => c.toLowerCase());

      // 将数据字段名统一转为小写
      const normalizedRows = rows.map(row => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[key.toLowerCase()] = value;
        }
        return normalized;
      });

      // 使用事务：清空 + 插入
      await prisma.$transaction(async (tx) => {
        // 清空表
        await tx.$executeRawUnsafe(`DELETE FROM "${tableName}"`);

        // 逐行插入
        for (const row of normalizedRows) {
          const values = columns.map(col => this.normalizeValue(row[col]));
          const placeholders = values.map(() => '?').join(',');
          const columnNames = columns.map(c => `"${c}"`).join(',');

          await tx.$executeRawUnsafe(
            `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`,
            ...values
          );
          result.insertedCount++;
        }
      });

      result.success = true;
      logger.info('[DBSyncService] %s: 同步成功，插入 %d 条记录', tableName, result.insertedCount);
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      logger.error('[DBSyncService] %s: 同步失败: %s', tableName, result.error);
      return result;
    }
  }

  /**
   * 同步所有配置的表
   */
  public async syncAll(): Promise<SyncAllResult> {
    const config = await this.loadSyncConfig();

    if (config.tables.length === 0) {
      return {
        success: false,
        results: [],
        message: '同步配置为空，未配置要同步的表',
      };
    }

    logger.info('[DBSyncService] 开始全量同步，共 %d 张表', config.tables.length);
    const results: SyncResult[] = [];
    let successCount = 0;

    for (const tableName of config.tables) {
      const result = await this.syncTable(tableName);
      results.push(result);
      if (result.success) successCount++;
    }

    const allSuccess = successCount === config.tables.length;
    const message = allSuccess
      ? `全量同步完成，${successCount}/${config.tables.length} 张表同步成功`
      : `部分同步完成，${successCount}/${config.tables.length} 张表同步成功`;

    logger.info('[DBSyncService] %s', message);
    return { success: allSuccess, results, message };
  }

  /**
   * 获取同步配置中的表列表
   */
  public async getSyncTables(): Promise<string[]> {
    const config = await this.loadSyncConfig();
    return config.tables;
  }

  // ==================== 私有方法 ====================

  /**
   * 标准化值类型
   * 处理 Date 对象等需要转换的类型
   */
  private normalizeValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
  }
}

// ==================== 导出便捷实例 ====================

export const dbSyncService = new DBSyncService();
