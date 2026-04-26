import { externalDB } from '../db/clients';
import { dbConnectionManager } from '../config/db-connections';
import logger from '../utils/logger';

// ==================== 类型定义 ====================

interface Azzi001SyncTableConfig {
  tableName: string;
  entField: string;
}

/** Azzi001同步表固定配置 */
const AZZI001_SYNC_TABLES: Azzi001SyncTableConfig[] = [
  { tableName: 'gzwe_t',  entField: 'gzweent' },
  { tableName: 'gzwel_t', entField: 'gzwelent' },
  { tableName: 'gzba_t',  entField: 'gzbaent' },
  { tableName: 'gzbal_t', entField: 'gzbalent' },
  { tableName: 'gzbb_t',  entField: 'gzbbent' },
  { tableName: 'gzbbl_t', entField: 'gzbblent' },
  { tableName: 'gzbd_t',  entField: 'gzbdent' },
  { tableName: 'gzbdl_t', entField: 'gzbdlent' },
];

/** 单张表预览结果 */
export interface Azzi001SyncPreview {
  tableName: string;
  entField: string;
  sourceCount: number;
}

/** 单张表同步结果 */
export interface Azzi001SyncStepResult {
  tableName: string;
  success: boolean;
  sourceCount: number;
  tempCount: number;
  deletedCount: number;
  insertedCount: number;
  verifyCount: number;
  error?: string;
}

/** 全量同步结果 */
export interface Azzi001SyncAllResult {
  success: boolean;
  results: Azzi001SyncStepResult[];
  message: string;
}

// ==================== SyncAzzi001Service ====================

/**
 * Azzi001 同步服务
 * 将外部数据库中指定 ENT 的数据复制为目标 ENT
 * 流程：创建临时表 → 更新ENT字段 → 删除目标ENT原数据 → 插入新数据 → 验证 → 清理临时表
 */
export class SyncAzzi001Service {
  /**
   * 获取 Azzi001 同步表配置列表
   */
  public getSyncTables(): Azzi001SyncTableConfig[] {
    return AZZI001_SYNC_TABLES;
  }

  /**
   * 获取所有 ENT 编号列表（从 gzou_t 表查询 gzou001）
   */
  public async getEntList(): Promise<number[]> {
    await this.ensureConnected();

    try {
      const result = await externalDB.query('SELECT gzou001 FROM gzou_t');
      const rows = result.rows as Record<string, unknown>[];
      return rows.map(row => Number(row.gzou001)).filter(n => !isNaN(n));
    } catch (error) {
      logger.error(error, '[SyncAzzi001Service] 查询ENT列表失败');
      throw error;
    }
  }

  /**
   * 预览：获取各表在源 ENT 下的数据条数
   */
  public async preview(sourceEnt: number): Promise<Azzi001SyncPreview[]> {
    await this.ensureConnected();

    const results: Azzi001SyncPreview[] = [];

    for (const table of AZZI001_SYNC_TABLES) {
      try {
        const sql = `SELECT COUNT(*) AS cnt FROM "${table.tableName}" WHERE "${table.entField}" = ${sourceEnt}`;
        const queryResult = await externalDB.query(sql);
        const rows = queryResult.rows as Record<string, unknown>[];
        const count = Number(rows[0]?.cnt ?? 0);

        results.push({
          tableName: table.tableName,
          entField: table.entField,
          sourceCount: count,
        });
      } catch (error) {
        logger.error(error, '[SyncAzzi001Service] 预览表 %s 失败', table.tableName);
        results.push({
          tableName: table.tableName,
          entField: table.entField,
          sourceCount: -1, // -1 表示查询失败
        });
      }
    }

    return results;
  }

  /**
   * 执行单张表的 ENT 同步
   */
  public async syncTable(
    tableName: string,
    entField: string,
    sourceEnt: number,
    targetEnt: number
  ): Promise<Azzi001SyncStepResult> {
    const result: Azzi001SyncStepResult = {
      tableName,
      success: false,
      sourceCount: 0,
      tempCount: 0,
      deletedCount: 0,
      insertedCount: 0,
      verifyCount: 0,
    };

    const tempTable = `${tableName}_temp`;

    try {
      // 1. 创建临时表：复制源 ENT 数据
      await externalDB.query(
        `CREATE TABLE "${tempTable}" AS SELECT * FROM "${tableName}" WHERE "${entField}" = ${sourceEnt}`
      );
      logger.info('[SyncAzzi001Service] %s: 创建临时表完成', tableName);

      // 2. 更新临时表中的 ENT 字段为目标值
      await externalDB.query(
        `UPDATE "${tempTable}" SET "${entField}" = ${targetEnt}`
      );
      logger.info('[SyncAzzi001Service] %s: 更新临时表ENT字段完成', tableName);

      // 3. 查询临时表条数
      const tempCountResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM "${tempTable}"`
      );
      result.tempCount = Number((tempCountResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

      // 4. 删除目标 ENT 在原表中的数据
      const deleteResult = await externalDB.query(
        `DELETE FROM "${tableName}" WHERE "${entField}" = ${targetEnt}`
      );
      // pg 返回 rowCount，Oracle 返回 rowsAffected
      const deleteRows = (deleteResult as { rowCount?: number }).rowCount
        ?? (deleteResult as { rowsAffected?: number }).rowsAffected
        ?? 0;
      result.deletedCount = Number(deleteRows);
      logger.info('[SyncAzzi001Service] %s: 删除目标ENT数据 %d 条', tableName, result.deletedCount);

      // 5. 从临时表插入到原表
      await externalDB.query(
        `INSERT INTO "${tableName}" SELECT * FROM "${tempTable}"`
      );
      result.insertedCount = result.tempCount;
      logger.info('[SyncAzzi001Service] %s: 插入数据 %d 条', tableName, result.insertedCount);

      // 6. 验证目标 ENT 数据条数
      const verifyResult = await externalDB.query(
        `SELECT COUNT(*) AS cnt FROM "${tableName}" WHERE "${entField}" = ${targetEnt}`
      );
      result.verifyCount = Number((verifyResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);

      result.success = true;
      logger.info('[SyncAzzi001Service] %s: 同步完成，验证条数 %d', tableName, result.verifyCount);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      logger.error(error, '[SyncAzzi001Service] %s: 同步失败', tableName);
    } finally {
      // 7. 清理临时表（无论成功失败都要清理）
      try {
        await externalDB.query(`DROP TABLE IF EXISTS "${tempTable}"`);
        logger.info('[SyncAzzi001Service] %s: 临时表已清理', tableName);
      } catch (dropError) {
        logger.error(dropError, '[SyncAzzi001Service] %s: 清理临时表失败', tableName);
      }
    }

    return result;
  }

  /**
   * 执行全量 Azzi001 同步
   */
  public async syncAll(sourceEnt: number, targetEnt: number): Promise<Azzi001SyncAllResult> {
    await this.ensureConnected();

    if (AZZI001_SYNC_TABLES.length === 0) {
      return {
        success: false,
        results: [],
        message: 'Azzi001同步配置为空',
      };
    }

    logger.info('[SyncAzzi001Service] 开始同步: 源=%d, 目标=%d, 共%d张表', sourceEnt, targetEnt, AZZI001_SYNC_TABLES.length);

    const results: Azzi001SyncStepResult[] = [];
    let successCount = 0;

    for (const table of AZZI001_SYNC_TABLES) {
      const stepResult = await this.syncTable(table.tableName, table.entField, sourceEnt, targetEnt);
      results.push(stepResult);
      if (stepResult.success) successCount++;
    }

    const allSuccess = successCount === AZZI001_SYNC_TABLES.length;
    const message = allSuccess
      ? `同步完成，${successCount}/${AZZI001_SYNC_TABLES.length} 张表同步成功`
      : `同步部分完成，${successCount}/${AZZI001_SYNC_TABLES.length} 张表同步成功`;

    logger.info('[SyncAzzi001Service] %s', message);
    return { success: allSuccess, results, message };
  }

  /**
   * 确保外部数据库已连接
   */
  private async ensureConnected(): Promise<void> {
    if (externalDB.isConnected) {
      return;
    }

    try {
      await dbConnectionManager.initialize();
      const defaultConn = dbConnectionManager.getDefaultConnection();

      if (!defaultConn) {
        throw new Error('未找到默认外部数据库连接配置');
      }

      await externalDB.connect(
        defaultConn.type === 'kingbase'
          ? { type: 'kingbase', config: defaultConn.config as import('../db/clients').KingbaseConfig }
          : { type: 'oracle', config: defaultConn.config as import('../db/clients').OracleConfig }
      );

      logger.info('[SyncAzzi001Service] 外部数据库已连接: %s', defaultConn.name);
    } catch (error) {
      logger.error(error, '[SyncAzzi001Service] 连接外部数据库失败');
      throw error;
    }
  }
}

// ==================== 导出便捷实例 ====================

export const syncAzzi001Service = new SyncAzzi001Service();
