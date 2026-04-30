import { externalDB, appDB } from '../db/clients';
import logger from '../utils/logger';
import { dbConnectionManager } from '../config/db-connections';

/** 表名 → Prisma 模型名映射（注意：Prisma 模型名首字母大写） */
const tableModelMap: Record<string, string> = {
    gzzj_t: 'Gzzj',
    gzzol_t: 'Gzzol',
    gzcb_t: 'Gzcb',
    gzcbl_t: 'Gzcbl',
    gzzal_t: 'Gzzal',
    gzzz_t: 'Gzzz',
    gzza_t: 'Gzza',
};

const allTables = Object.keys(tableModelMap);

/** 各表的拉取 SQL */
const extractQueries: { table: string; sql: string }[] = [
    { table: 'gzzj_t', sql: 'SELECT * FROM gzzj_t' },
    { table: 'gzzol_t', sql: 'SELECT * FROM gzzol_t' },
    { table: 'gzcb_t', sql: "SELECT * FROM gzcb_t WHERE gzcb001 = '24'" },
    { table: 'gzcbl_t', sql: "SELECT * FROM gzcbl_t WHERE gzcbl001 IN (SELECT gzcb001 FROM gzcb_t WHERE gzcb001 = '24') ORDER BY gzcbl001" },
    { table: 'gzzal_t', sql: "SELECT * FROM gzzal_t WHERE gzzal001 IN (SELECT gzza_t.gzza001 FROM gzzz_t INNER JOIN gzza_t ON gzzz002 = gzza001 WHERE gzza002 IN ('T','Q')) ORDER BY gzzal001" },
    { table: 'gzzz_t', sql: "SELECT * FROM gzzz_t WHERE gzzz002 IN (SELECT gzza001 FROM gzza_t WHERE gzza002 IN ('T','Q') ) ORDER BY gzzz001" },
    { table: 'gzza_t', sql: "SELECT gzza_t.* FROM gzza_t WHERE gzza002 IN ('T','Q') ORDER BY gzza001" },
];

/** Prisma 标量字段类型 */
type ScalarType = 'Int' | 'Float' | 'String' | 'Boolean' | 'DateTime' | 'BigInt' | 'Decimal' | 'Json' | 'Bytes';

interface FieldMeta {
    name: string;
    type: ScalarType;
    isRequired: boolean;
}

/** 从 Prisma runtime 获取模型的字段类型映射 */
function getModelFieldMap(modelName: string): Record<string, FieldMeta> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = appDB.getPrisma() as any;

    // Prisma v6: _runtimeDataModel.models[modelName].fields
    let modelFields: any[] | undefined;
    const runtime = prisma._runtimeDataModel;
    if (runtime?.models?.[modelName]?.fields) {
        modelFields = runtime.models[modelName].fields;
    }
    // 兜底：尝试 _dmmf
    if (!modelFields && prisma._dmmf?.datamodel?.models) {
        const dmmfModel = prisma._dmmf.datamodel.models.find((m: any) => m.name === modelName);
        if (dmmfModel) modelFields = dmmfModel.fields;
    }

    if (!modelFields) {
        logger.error({ runtimeKeys: runtime ? Object.keys(runtime.models || {}) : 'undefined' },
            '[genAooi200] 无法获取模型字段: %s', modelName);
        return {};
    }

    const map: Record<string, FieldMeta> = {};
    for (const field of modelFields) {
        if (field.kind === 'scalar') {
            map[field.name] = {
                name: field.name,
                type: field.type as ScalarType,
                isRequired: field.isRequired,
            };
        }
    }
    logger.debug({ modelName, fieldNames: Object.keys(map) },
        '[genAooi200] %s 字段映射: %d 个字段', modelName, Object.keys(map).length);
    return map;
}

/** 将外部 DB 的行数据转换为 Prisma 期望的类型 */
function convertRow(row: Record<string, unknown>, fieldMap: Record<string, FieldMeta>): Record<string, unknown> {
    const converted: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(row)) {
        // Oracle 返回大写列名，Kingbase 返回小写，统一转小写后匹配 Prisma 字段名
        const meta = fieldMap[key.toLowerCase()];
        if (!meta) {
            // 字段不在模型中（可能是 JOIN 带来的额外列），跳过
            continue;
        }
        // 处理 null / undefined / 空字符串——可选字段统一转为 null
        if (raw === null || raw === undefined || raw === '') {
            converted[key] = meta.isRequired ? raw : null;
            continue;
        }
        switch (meta.type) {
            case 'Int':
                converted[key] = Number.isNaN(Number(raw)) ? null : Number(raw);
                break;
            case 'Float':
                converted[key] = Number.isNaN(Number(raw)) ? null : Number(raw);
                break;
            case 'DateTime':
                converted[key] = new Date(raw as string);
                if ((converted[key] as Date).toString() === 'Invalid Date') {
                    converted[key] = null;
                }
                break;
            case 'Boolean':
                converted[key] = raw === 'true' || raw === '1' || raw === true;
                break;
            case 'BigInt':
                converted[key] = BigInt(raw as string);
                break;
            case 'Decimal':
                converted[key] = String(raw);
                break;
            case 'Json':
                converted[key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
                break;
            default:
                // String, Bytes
                converted[key] = String(raw);
        }
    }
    return converted;
}

/** modelName → Prisma client 属性名（首字母小写） */
function toClientName(modelName: string): string {
    return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/** 同步单张表 */
async function syncTable(table: string, sql: string): Promise<number> {
    const prisma = appDB.getPrisma();
    const modelName = tableModelMap[table];        // schema 名，如 Gzzj
    const clientName = toClientName(modelName);     // client 名，如 gzzj

    // 构建字段类型映射
    const fieldMap = getModelFieldMap(modelName);
    logger.debug({ fieldCount: Object.keys(fieldMap).length }, '[genAooi200] %s 模型字段映射', modelName);

    logger.debug({ sql }, '[genAooi200] 查询外部数据库: %s', table);
    const result = await externalDB.query(sql);
    const rawRows = result.rows as Record<string, unknown>[];
    logger.info({ table, rowCount: rawRows.length }, '[genAooi200] %s 查询完成', table);

    if (rawRows.length === 0) {
        logger.warn('[genAooi200] %s 无数据，跳过', table);
        return 0;
    }

    // 诊断：打印第一行的 key，用于排查列名大小写问题
    logger.debug({ sampleKeys: Object.keys(rawRows[0]), fieldMapKeys: Object.keys(fieldMap) },
        '[genAooi200] %s 外部列名 vs 模型字段名', table);

    // 类型转换
    const rows = rawRows.map(row => convertRow(row, fieldMap));

    // 写入 SQLite：清旧数据 + 插入新数据
    await prisma.$transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const txn = tx as any;
        await txn[clientName].deleteMany();
        await txn[clientName].createMany({ data: rows });
    });

    logger.info({ table, rowCount: rows.length }, '[genAooi200] %s 同步完成', table);
    return rows.length;
}

/**
 * 清空 SQLite 中所有 gen-aooi200 相关表数据
 */
export async function cleanSqliteTables(): Promise<void> {
    const prisma = appDB.getPrisma();
    logger.info('[genAooi200] 开始清空 SQLite 相关表');

    for (const table of allTables) {
        const modelName = tableModelMap[table];
        const clientName = toClientName(modelName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (prisma as any)[clientName].deleteMany();
        logger.info({ table, count: result.count }, '[genAooi200] 清空 %s', table);
    }

    logger.info('[genAooi200] SQLite 相关表清空完成');
}

/**
 * 从外部数据库同步 gen-aooi200 相关表到内部 SQLite
 * 每次执行前先清空本地数据，再拉取新数据
 * @param connectionName 要切换的外部数据库连接名称（可选，不传则使用当前连接或默认连接）
 * @returns 各表同步行数汇总
 */
export async function genAooi200(connectionName?: string): Promise<{ table: string; count: number }[]> {
    await ensureConnected(connectionName);
    logger.info('[genAooi200] 开始同步数据');

    // 先清空本地表，再拉取新数据
    await cleanSqliteTables();

    const results: { table: string; count: number }[] = [];

    for (const { table, sql } of extractQueries) {
        const count = await syncTable(table, sql);
        results.push({ table, count });
    }

    const total = results.reduce((sum, r) => sum + r.count, 0);
    logger.info({ total, results }, '[genAooi200] 全部同步完成');
    return results;
}

/**
 * 切换到指定的外部数据库连接
 * @param connectionName 连接名称
 */
export async function switchExternalConnection(connectionName: string): Promise<void> {
    await dbConnectionManager.initialize();
    const conn = dbConnectionManager.getConnectionByName(connectionName);

    if (!conn) {
        throw new Error(`未找到外部数据库连接: ${connectionName}`);
    }

    await externalDB.connect(
        conn.type === 'kingbase'
            ? { type: 'kingbase', config: conn.config as import('../db/clients').KingbaseConfig }
            : { type: 'oracle', config: conn.config as import('../db/clients').OracleConfig },
    );

    logger.info('[genAooi200] 已切换到外部数据库连接: %s', connectionName);
}

/** 确保外部数据库已连接 */
async function ensureConnected(connectionName?: string): Promise<void> {
    if (connectionName) {
        await switchExternalConnection(connectionName);
        return;
    }

    if (externalDB.isConnected) {
        return;
    }

    await dbConnectionManager.initialize();
    const defaultConn = dbConnectionManager.getDefaultConnection();

    if (!defaultConn) {
        throw new Error('未找到默认外部数据库连接配置');
    }

    await externalDB.connect(
        defaultConn.type === 'kingbase'
            ? { type: 'kingbase', config: defaultConn.config as import('../db/clients').KingbaseConfig }
            : { type: 'oracle', config: defaultConn.config as import('../db/clients').OracleConfig },
    );

    logger.info('[genAooi200] 外部数据库已连接: %s', defaultConn.name);
}
