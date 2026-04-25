import { PrismaClient } from '@prisma/client';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import * as oracledb from 'oracledb';
import { getSqliteDBPath } from '../utils/paths';
import logger from '../utils/logger';

// ==================== 类型定义 ====================

/**
 * 外部数据库类型
 */
export type ExternalDBType = 'kingbase' | 'oracle';

/**
 * Kingbase (人大金仓) 数据库连接配置
 */
export interface KingbaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  // 连接池配置
  max?: number;        // 最大连接数，默认 20
  idleTimeoutMillis?: number;  // 连接空闲超时，默认 30000ms
  connectionTimeoutMillis?: number;  // 连接超时，默认 5000ms
}

/**
 * Oracle 数据库连接配置
 */
export interface OracleConfig {
  user: string;
  password: string;
  connectString: string;  // 格式: host:port/service_name 或 TNS 名称
  // 可选配置
  poolMin?: number;       // 最小连接数，默认 0
  poolMax?: number;       // 最大连接数，默认 10
  poolIncrement?: number; // 连接池增量，默认 1
  poolTimeout?: number;   // 连接池超时(秒)，默认 60
}

/**
 * 外部数据库配置联合类型
 */
export type ExternalDBConfig = 
  | { type: 'kingbase'; config: KingbaseConfig }
  | { type: 'oracle'; config: OracleConfig };

// ==================== AppDBManager ====================

/**
 * 应用主数据库管理类（SQLite）
 * 单例模式，用于管理固定的本地 app.db 数据库连接
 */
export class AppDBManager {
  private static instance: AppDBManager;
  private prisma: PrismaClient;
  private _isConnected: boolean = false;

  private constructor() {
    const dbPath = getSqliteDBPath().replace(/\\/g, '/')
    // Prisma SQLite Windows 路径格式：使用 file: 前缀 + 正斜杠绝对路径
    const dbUrl = `file:${dbPath}`

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AppDBManager {
    if (!AppDBManager.instance) {
      AppDBManager.instance = new AppDBManager();
    }
    return AppDBManager.instance;
  }

  /**
   * 获取 Prisma Client 实例
   */
  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * 获取连接状态
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 连接数据库
   */
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this._isConnected = true;
      logger.info('[AppDBManager] SQLite database connected successfully');
    } catch (error) {
      this._isConnected = false;
      logger.error(error, '[AppDBManager] Database connection failed');
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this._isConnected = false;
    logger.info('[AppDBManager] Database connection closed');
  }

  /**
   * 检查数据库连接状态
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error(error, '[AppDBManager] Health check failed');
      throw error;
    }
  }

  /**
   * 测试连接状态并打印详细信息到控制台
   */
  public async testConnection(): Promise<void> {
    logger.info('========================================');
    logger.info('[AppDBManager] Starting SQLite connection test...');
    logger.info('[AppDBManager] Connection status: %s', this._isConnected ? 'Connected' : 'Disconnected');

    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - startTime;

      logger.info('[AppDBManager] Connection test successful');
      logger.info('[AppDBManager] Response time: %d ms', duration);
      logger.info('[AppDBManager] Prisma Client status: Normal');
    } catch (error) {
      logger.error('[AppDBManager] Connection test failed');
      logger.error(error, '[AppDBManager] Error');
    }

    logger.info('========================================');
  }
}

// ==================== ExternalDBManager ====================

/**
 * 外部数据库管理类（Kingbase / Oracle）
 * 单例模式，同一时间只允许存在一个外部数据库连接
 * 支持运行时切换连接（Kingbase ↔ Oracle）
 */
export class ExternalDBManager {
  private static instance: ExternalDBManager;
  
  // 当前连接状态
  private _dbType: ExternalDBType | null = null;
  private _isConnected: boolean = false;
  private _currentConfig: KingbaseConfig | OracleConfig | null = null;
  
  // Kingbase 连接池
  private kingbasePool: Pool | null = null;
  private kingbaseConfig: KingbaseConfig | null = null;
  
  // Oracle 连接池
  private oraclePool: oracledb.Pool | null = null;
  private oracleConfig: OracleConfig | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ExternalDBManager {
    if (!ExternalDBManager.instance) {
      ExternalDBManager.instance = new ExternalDBManager();
    }
    return ExternalDBManager.instance;
  }

  /**
   * 获取当前数据库类型
   */
  public get dbType(): ExternalDBType | null {
    return this._dbType;
  }

  /**
   * 获取连接状态
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 获取当前连接的数据库类型（带状态检查）
   */
  public getCurrentDBType(): ExternalDBType {
    if (!this._dbType || !this._isConnected) {
      throw new Error('[ExternalDBManager] 外部数据库未连接');
    }
    return this._dbType;
  }

  /**
   * 连接到指定类型的外部数据库
   * 如果已连接其他数据库，会先断开当前连接
   * @param dbConfig 数据库配置
   */
  public async connect(dbConfig: ExternalDBConfig): Promise<void> {
    // 如果已连接同类型数据库，检查配置是否相同
    if (this._isConnected && this._dbType === dbConfig.type) {
      const isSameConfig = this.isSameConfig(dbConfig.type, dbConfig.config);
      if (isSameConfig) {
        logger.info('[ExternalDBManager] %s 数据库已连接，配置相同，跳过连接', dbConfig.type);
        return;
      }
      // 配置不同，先断开再重新连接
      logger.info('[ExternalDBManager] %s 配置变更，重新连接', dbConfig.type);
      await this.disconnect();
    }

    // 如果已连接其他类型数据库，先断开
    if (this._isConnected && this._dbType !== dbConfig.type) {
      logger.info('[ExternalDBManager] 切换数据库类型: %s -> %s', this._dbType, dbConfig.type);
      await this.disconnect();
    }

    // 建立新连接
    if (dbConfig.type === 'kingbase') {
      await this.connectKingbase(dbConfig.config);
    } else {
      await this.connectOracle(dbConfig.config);
    }
  }

  /**
   * 切换到另一个外部数据库
   * 先断开当前连接，再建立新连接
   * @param dbConfig 新的数据库配置
   */
  public async switchConnection(dbConfig: ExternalDBConfig): Promise<void> {
    if (this._isConnected) {
      await this.disconnect();
    }
    await this.connect(dbConfig);
  }

  /**
   * 断开当前外部数据库连接
   */
  public async disconnect(): Promise<void> {
    if (this.kingbasePool) {
      await this.kingbasePool.end();
      this.kingbasePool = null;
      this.kingbaseConfig = null;
      logger.info('[ExternalDBManager] Kingbase 数据库连接已断开');
    }

    if (this.oraclePool) {
      await this.oraclePool.close(0);
      this.oraclePool = null;
      this.oracleConfig = null;
      logger.info('[ExternalDBManager] Oracle 数据库连接已断开');
    }

    this._dbType = null;
    this._isConnected = false;
    this._currentConfig = null;
  }

  /**
   * 检查数据库连接状态
   */
  public async healthCheck(): Promise<boolean> {
    if (!this._isConnected || !this._dbType) {
      return false;
    }

    try {
      if (this._dbType === 'kingbase') {
        await this.queryKingbase('SELECT 1');
      } else {
        await this.queryOracle('SELECT 1 FROM DUAL');
      }
      return true;
    } catch (error) {
      logger.error(error, '[ExternalDBManager] 健康检查失败');
      return false;
    }
  }

  /**
   * 测试连接状态并打印详细信息到控制台
   */
  public async testConnection(): Promise<void> {
    logger.info('========================================');
    logger.info('[ExternalDBManager] 开始测试外部数据库连接...');
    logger.info('[ExternalDBManager] 连接状态: %s', this._isConnected ? '已连接' : '未连接');
    logger.info('[ExternalDBManager] 当前数据库类型: %s', this._dbType || '无');

    if (!this._isConnected || !this._dbType) {
      logger.info('[ExternalDBManager] 数据库未连接，跳过测试');
      logger.info('========================================');
      return;
    }

    try {
      const startTime = Date.now();

      if (this._dbType === 'kingbase') {
        const result = await this.queryKingbase('SELECT version()');
        const duration = Date.now() - startTime;

        logger.info('[ExternalDBManager] Kingbase 连接测试成功');
        logger.info('[ExternalDBManager] 响应时间: %d ms', duration);
        logger.info('[ExternalDBManager] 数据库版本: %s', result.rows[0]?.version || '未知');
        logger.info('[ExternalDBManager] 连接配置:');
        logger.info('  - 主机: %s', this.kingbaseConfig?.host);
        logger.info('  - 端口: %s', this.kingbaseConfig?.port);
        logger.info('  - 数据库: %s', this.kingbaseConfig?.database);
        logger.info('  - 用户: %s', this.kingbaseConfig?.user);
      } else {
        const result = await this.queryOracle('SELECT * FROM v$version');
        const duration = Date.now() - startTime;

        logger.info('[ExternalDBManager] Oracle 连接测试成功');
        logger.info('[ExternalDBManager] 响应时间: %d ms', duration);
        logger.info('[ExternalDBManager] 数据库版本: %o', result.rows?.[0] || '未知');
        logger.info('[ExternalDBManager] 连接配置:');
        logger.info('  - 连接字符串: %s', this.oracleConfig?.connectString);
        logger.info('  - 用户: %s', this.oracleConfig?.user);
      }
    } catch (error) {
      logger.error('[ExternalDBManager] 连接测试失败');
      logger.error(error, '[ExternalDBManager] 错误信息');
    }

    logger.info('========================================');
  }

  // ==================== Kingbase 相关方法 ====================

  /**
   * 连接到 Kingbase 数据库
   */
  private async connectKingbase(config: KingbaseConfig): Promise<void> {
    try {
      const poolConfig = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.max ?? 20,
        idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
      };

      this.kingbasePool = new Pool(poolConfig);

      this.kingbasePool.on('error', (err: Error) => {
        logger.error(err, '[ExternalDBManager] Kingbase 连接池错误');
      });

      // 测试连接
      const client = await this.kingbasePool.connect();
      const result = await client.query('SELECT version()');
      client.release();

      this.kingbaseConfig = config;
      this._dbType = 'kingbase';
      this._isConnected = true;
      this._currentConfig = config;

      logger.info('[ExternalDBManager] Kingbase 数据库连接成功');
      logger.info('[ExternalDBManager] 数据库版本: %s', result.rows[0].version);
    } catch (error) {
      this.kingbasePool = null;
      throw error;
    }
  }

  /**
   * 执行 Kingbase SQL 查询
   */
  public async queryKingbase<T extends QueryResultRow>(
    sql: string, 
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    if (!this.kingbasePool) {
      throw new Error('[ExternalDBManager] Kingbase 数据库未连接');
    }
    return this.kingbasePool.query<T>(sql, params);
  }

  /**
   * 获取 Kingbase 连接（用于事务）
   */
  public async getKingbaseClient(): Promise<PoolClient> {
    if (!this.kingbasePool) {
      throw new Error('[ExternalDBManager] Kingbase 数据库未连接');
    }
    return this.kingbasePool.connect();
  }

  /**
   * 执行 Kingbase 事务
   */
  public async transactionKingbase<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getKingbaseClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== Oracle 相关方法 ====================

  /**
   * 连接到 Oracle 数据库
   */
  private async connectOracle(config: OracleConfig): Promise<void> {
    try {
      this.oraclePool = await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: config.connectString,
        poolMin: config.poolMin ?? 0,
        poolMax: config.poolMax ?? 10,
        poolIncrement: config.poolIncrement ?? 1,
        poolTimeout: config.poolTimeout ?? 60,
      });

      // 测试连接
      const connection = await this.oraclePool.getConnection();
      const result = await connection.execute('SELECT * FROM v$version');
      await connection.close();

      this.oracleConfig = config;
      this._dbType = 'oracle';
      this._isConnected = true;
      this._currentConfig = config;

      logger.info('[ExternalDBManager] Oracle 数据库连接成功');
      logger.info('[ExternalDBManager] 数据库版本: %s', result.rows?.[0]);
    } catch (error) {
      this.oraclePool = null;
      throw error;
    }
  }

  /**
   * 执行 Oracle SQL 查询
   */
  public async queryOracle<T>(
    sql: string,
    params: oracledb.BindParameters = {},
    options?: oracledb.ExecuteOptions
  ): Promise<oracledb.Result<T>> {
    if (!this.oraclePool) {
      throw new Error('[ExternalDBManager] Oracle 数据库未连接');
    }
    const connection = await this.oraclePool.getConnection();
    try {
      const result = await connection.execute<T>(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        ...options,
      });
      return result;
    } finally {
      await connection.close();
    }
  }

  /**
   * 获取 Oracle 连接（用于事务）
   */
  public async getOracleConnection(): Promise<oracledb.Connection> {
    if (!this.oraclePool) {
      throw new Error('[ExternalDBManager] Oracle 数据库未连接');
    }
    return this.oraclePool.getConnection();
  }

  /**
   * 执行 Oracle 事务
   */
  public async transactionOracle<T>(
    callback: (connection: oracledb.Connection) => Promise<T>
  ): Promise<T> {
    const connection = await this.getOracleConnection();
    try {
      await connection.execute('BEGIN');
      const result = await callback(connection);
      await connection.execute('COMMIT');
      return result;
    } catch (error) {
      await connection.execute('ROLLBACK');
      throw error;
    } finally {
      await connection.close();
    }
  }

  // ==================== 通用查询方法 ====================

  /**
   * 根据当前连接类型执行查询
   * 自动判断当前连接的是 Kingbase 还是 Oracle
   * @param sql SQL 语句
   * @param params 参数
   */
  public async query<T extends QueryResultRow>(
    sql: string, 
    params?: unknown[] | oracledb.BindParameters
  ): Promise<QueryResult<T> | oracledb.Result<T>> {
    if (!this._isConnected || !this._dbType) {
      throw new Error('[ExternalDBManager] 外部数据库未连接');
    }

    if (this._dbType === 'kingbase') {
      return this.queryKingbase<T>(sql, params as unknown[]);
    } else {
      return this.queryOracle<T>(sql, params as oracledb.BindParameters);
    }
  }

  // ==================== 私有工具方法 ====================

  /**
   * 检查配置是否相同
   */
  private isSameConfig(type: ExternalDBType, newConfig: KingbaseConfig | OracleConfig): boolean {
    if (!this._currentConfig || this._dbType !== type) {
      return false;
    }

    const current = this._currentConfig;
    
    if (type === 'kingbase') {
      const curr = current as KingbaseConfig;
      const next = newConfig as KingbaseConfig;
      return (
        curr.host === next.host &&
        curr.port === next.port &&
        curr.database === next.database &&
        curr.user === next.user &&
        curr.password === next.password
      );
    } else {
      const curr = current as OracleConfig;
      const next = newConfig as OracleConfig;
      return (
        curr.user === next.user &&
        curr.password === next.password &&
        curr.connectString === next.connectString
      );
    }
  }
}



// ==================== 导出便捷实例 ====================

// 应用主数据库管理器单例
export const appDB = AppDBManager.getInstance();

// 外部数据库管理器单例
export const externalDB = ExternalDBManager.getInstance();

// 导出类型
export type { PrismaClient, Pool, PoolClient, QueryResult, QueryResultRow, oracledb };
