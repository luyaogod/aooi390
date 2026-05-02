import { externalDB } from '../db/clients';
import { dbConnectionManager } from '../config/db-connections';
import logger from '../utils/logger';
import { queryEnt, querySites } from '../com-query/external';
import { validateIdentifier, safeQuery } from '../utils/sql-utils';

/** 集团级参数行 */
export interface EnterpriseParamRow {
  ooaaent: string;
  ooaa001: string;
  ooaa002: string;
  gzszl004: string;
  gzszl005: string;
  gzszl006: string;
  gzszl007: string;
}

/** 据点级参数行 */
export interface SiteParamRow {
  ooabent: string;
  ooabsite: string;
  ooab001: string;
  ooab002: string;
  gzszl004: string;
  gzszl005: string;
  gzszl006: string;
  gzszl007: string;
}

/** 解析 ent→schema 映射 */
async function resolveSchemaMap(): Promise<Record<string, string>> {
  const entRows = await queryEnt();
  const schemaMap: Record<string, string> = {};
  for (const row of entRows) {
    schemaMap[String(row.gzou001)] = String(row.gzou003);
  }
  return schemaMap;
}

/**
 * 参数差异查询服务
 * 查询外部数据库中集团级参数（ooaa_t）和据点级参数（ooab_t）
 */
export class ParamDiffService {
  /**
   * 查询集团级参数
   * @param ent   集团编号
   * @param dlang 语言代码，默认 zh_CN
   */
  public async getEnterpriseParams(ent: string, dlang = 'zh_CN'): Promise<EnterpriseParamRow[]> {
    await this.ensureConnected();

    try {
      const schemaMap = await resolveSchemaMap();
      const schema = schemaMap[ent] || ent;
      const safeSchema = validateIdentifier(schema, 'schema');
      const sql = `SELECT ooaaent, ooaa001, ooaa002, gzszl004, gzszl005, gzszl006, gzszl007
FROM ${safeSchema}.ooaa_t
LEFT JOIN ${safeSchema}.gzszl_t ON ooaa001 = gzszl002 AND gzszl001 = 'ooaa_t' AND gzszl003 = ?
WHERE ooaaent = ?
ORDER BY ooaaent, ooaa001`;
      logger.debug({ sql, params: [dlang, ent] }, '[ParamDiffService] 查询集团级参数');
      const rows = await safeQuery(sql, [dlang, ent]);
      return rows as unknown as EnterpriseParamRow[];
    } catch (error) {
      logger.error(error, '[ParamDiffService] 查询集团级参数失败');
      throw error;
    }
  }

  /**
   * 查询据点级参数
   * @param ent   集团编号
   * @param site  据点编号
   * @param dlang 语言代码，默认 zh_CN
   */
  public async getSiteParams(ent: string, site: string, dlang = 'zh_CN'): Promise<SiteParamRow[]> {
    await this.ensureConnected();

    try {
      const schemaMap = await resolveSchemaMap();
      const schema = schemaMap[ent] || ent;
      const safeSchema = validateIdentifier(schema, 'schema');
      const sql = `SELECT ooabent, ooabsite, ooab001, ooab002, gzszl004, gzszl005, gzszl006, gzszl007
FROM ${safeSchema}.ooab_t
LEFT JOIN ${safeSchema}.gzszl_t ON ooab001 = gzszl002 AND gzszl001 = 'ooab_t' AND gzszl003 = ?
WHERE ooabent = ? AND ooabsite = ?
ORDER BY ooabent, ooabsite, ooab001`;
      logger.debug({ sql, params: [dlang, ent, site] }, '[ParamDiffService] 查询据点级参数');
      const rows = await safeQuery(sql, [dlang, ent, site]);
      return rows as unknown as SiteParamRow[];
    } catch (error) {
      logger.error(error, '[ParamDiffService] 查询据点级参数失败');
      throw error;
    }
  }

  /**
   * 查询指定集团的据点列表
   * @param ent 集团编号
   */
  public async getSites(ent: string): Promise<string[]> {
    await this.ensureConnected();

    try {
      const schemaMap = await resolveSchemaMap();
      const schema = schemaMap[ent] || ent;
      logger.debug({ schema, ent }, '[ParamDiffService] 查询据点列表');
      return await querySites(schema, ent);
    } catch (error) {
      logger.error(error, '[ParamDiffService] 查询据点列表失败');
      throw error;
    }
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

      logger.info('[ParamDiffService] 外部数据库已连接: %s', defaultConn.name);
    } catch (error) {
      logger.error(error, '[ParamDiffService] 连接外部数据库失败');
      throw error;
    }
  }
}

// ==================== 导出便捷实例 ====================

export const paramDiffService = new ParamDiffService();
