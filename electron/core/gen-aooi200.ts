import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import { externalDB, appDB } from '../db/clients';
import logger from '../utils/logger';
import { dbConnectionManager } from '../config/db-connections';
import type { Oobx } from '@prisma/client';

/** 校验错误信息 */
export interface ValidateError {
    table: string;
    field: string;
    label: string;
    value: string;
    message: string;
}

/** 校验模式：collect-收集所有错误 | failFast-遇错即停 */
export type ValidateMode = 'collect' | 'failFast';



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

// 字段类型元数据 —— 从 Prisma schema 手动同步，仅覆盖 genAooi200 同步涉及的 7 张表
const modelFieldMeta: Record<string, Record<string, FieldMeta>> = {
    Gzzj: {
        gzzj001:   { name: 'gzzj001',   type: 'String',   isRequired: true },
        gzzj002:   { name: 'gzzj002',   type: 'String',   isRequired: false },
        gzzj003:   { name: 'gzzj003',   type: 'String',   isRequired: false },
        gzzjownid: { name: 'gzzjownid', type: 'String',   isRequired: false },
        gzzjowndp: { name: 'gzzjowndp', type: 'String',   isRequired: false },
        gzzjcrtid: { name: 'gzzjcrtid', type: 'String',   isRequired: false },
        gzzjcrtdp: { name: 'gzzjcrtdp', type: 'String',   isRequired: false },
        gzzjcrtdt: { name: 'gzzjcrtdt', type: 'DateTime', isRequired: false },
        gzzjmodid: { name: 'gzzjmodid', type: 'String',   isRequired: false },
        gzzjmoddt: { name: 'gzzjmoddt', type: 'DateTime', isRequired: false },
        gzzjstus:  { name: 'gzzjstus',  type: 'String',   isRequired: false },
    },
    Gzzol: {
        gzzol001: { name: 'gzzol001', type: 'String', isRequired: true },
        gzzol002: { name: 'gzzol002', type: 'String', isRequired: true },
        gzzol003: { name: 'gzzol003', type: 'String', isRequired: false },
        gzzol004: { name: 'gzzol004', type: 'String', isRequired: false },
    },
    Gzcb: {
        gzcb001:   { name: 'gzcb001',   type: 'Int',      isRequired: true },
        gzcb002:   { name: 'gzcb002',   type: 'String',   isRequired: true },
        gzcb003:   { name: 'gzcb003',   type: 'String',   isRequired: false },
        gzcb004:   { name: 'gzcb004',   type: 'String',   isRequired: false },
        gzcb005:   { name: 'gzcb005',   type: 'String',   isRequired: false },
        gzcb006:   { name: 'gzcb006',   type: 'String',   isRequired: false },
        gzcb007:   { name: 'gzcb007',   type: 'String',   isRequired: false },
        gzcb008:   { name: 'gzcb008',   type: 'String',   isRequired: false },
        gzcb009:   { name: 'gzcb009',   type: 'String',   isRequired: false },
        gzcb010:   { name: 'gzcb010',   type: 'String',   isRequired: false },
        gzcb011:   { name: 'gzcb011',   type: 'String',   isRequired: false },
        gzcb012:   { name: 'gzcb012',   type: 'String',   isRequired: false },
        gzcb013:   { name: 'gzcb013',   type: 'String',   isRequired: false },
        gzcb014:   { name: 'gzcb014',   type: 'String',   isRequired: false },
        gzcb015:   { name: 'gzcb015',   type: 'String',   isRequired: false },
        gzcbud001: { name: 'gzcbud001', type: 'String',   isRequired: false },
        gzcbud002: { name: 'gzcbud002', type: 'String',   isRequired: false },
        gzcbud003: { name: 'gzcbud003', type: 'String',   isRequired: false },
        gzcbud004: { name: 'gzcbud004', type: 'String',   isRequired: false },
        gzcbud005: { name: 'gzcbud005', type: 'String',   isRequired: false },
        gzcbud006: { name: 'gzcbud006', type: 'String',   isRequired: false },
        gzcbud007: { name: 'gzcbud007', type: 'String',   isRequired: false },
        gzcbud008: { name: 'gzcbud008', type: 'String',   isRequired: false },
        gzcbud009: { name: 'gzcbud009', type: 'String',   isRequired: false },
        gzcbud010: { name: 'gzcbud010', type: 'String',   isRequired: false },
        gzcbud011: { name: 'gzcbud011', type: 'Float',    isRequired: false },
        gzcbud012: { name: 'gzcbud012', type: 'Float',    isRequired: false },
        gzcbud013: { name: 'gzcbud013', type: 'Float',    isRequired: false },
        gzcbud014: { name: 'gzcbud014', type: 'Float',    isRequired: false },
        gzcbud015: { name: 'gzcbud015', type: 'Float',    isRequired: false },
        gzcbud016: { name: 'gzcbud016', type: 'Float',    isRequired: false },
        gzcbud017: { name: 'gzcbud017', type: 'Float',    isRequired: false },
        gzcbud018: { name: 'gzcbud018', type: 'Float',    isRequired: false },
        gzcbud019: { name: 'gzcbud019', type: 'Float',    isRequired: false },
        gzcbud020: { name: 'gzcbud020', type: 'Float',    isRequired: false },
        gzcbud021: { name: 'gzcbud021', type: 'DateTime', isRequired: false },
        gzcbud022: { name: 'gzcbud022', type: 'DateTime', isRequired: false },
        gzcbud023: { name: 'gzcbud023', type: 'DateTime', isRequired: false },
        gzcbud024: { name: 'gzcbud024', type: 'DateTime', isRequired: false },
        gzcbud025: { name: 'gzcbud025', type: 'DateTime', isRequired: false },
        gzcbud026: { name: 'gzcbud026', type: 'DateTime', isRequired: false },
        gzcbud027: { name: 'gzcbud027', type: 'DateTime', isRequired: false },
        gzcbud028: { name: 'gzcbud028', type: 'DateTime', isRequired: false },
        gzcbud029: { name: 'gzcbud029', type: 'DateTime', isRequired: false },
        gzcbud030: { name: 'gzcbud030', type: 'DateTime', isRequired: false },
    },
    Gzcbl: {
        gzcbl001: { name: 'gzcbl001', type: 'Int',    isRequired: true },
        gzcbl002: { name: 'gzcbl002', type: 'String', isRequired: true },
        gzcbl003: { name: 'gzcbl003', type: 'String', isRequired: true },
        gzcbl004: { name: 'gzcbl004', type: 'String', isRequired: false },
        gzcbl005: { name: 'gzcbl005', type: 'String', isRequired: false },
        gzcbl006: { name: 'gzcbl006', type: 'String', isRequired: false },
        gzcbl007: { name: 'gzcbl007', type: 'String', isRequired: false },
    },
    Gzzal: {
        gzzal001: { name: 'gzzal001', type: 'String', isRequired: true },
        gzzal002: { name: 'gzzal002', type: 'String', isRequired: true },
        gzzal003: { name: 'gzzal003', type: 'String', isRequired: false },
        gzzal004: { name: 'gzzal004', type: 'String', isRequired: false },
        gzzal005: { name: 'gzzal005', type: 'String', isRequired: false },
        gzzal006: { name: 'gzzal006', type: 'String', isRequired: false },
    },
    Gzzz: {
        gzzzstus:  { name: 'gzzzstus',  type: 'String',   isRequired: false },
        gzzz001:   { name: 'gzzz001',   type: 'String',   isRequired: true },
        gzzz002:   { name: 'gzzz002',   type: 'String',   isRequired: false },
        gzzz003:   { name: 'gzzz003',   type: 'Int',      isRequired: false },
        gzzz004:   { name: 'gzzz004',   type: 'String',   isRequired: false },
        gzzzownid: { name: 'gzzzownid', type: 'String',   isRequired: false },
        gzzzowndp: { name: 'gzzzowndp', type: 'String',   isRequired: false },
        gzzzcrtid: { name: 'gzzzcrtid', type: 'String',   isRequired: false },
        gzzzcrtdp: { name: 'gzzzcrtdp', type: 'String',   isRequired: false },
        gzzzcrtdt: { name: 'gzzzcrtdt', type: 'DateTime', isRequired: false },
        gzzzmodid: { name: 'gzzzmodid', type: 'String',   isRequired: false },
        gzzzmoddt: { name: 'gzzzmoddt', type: 'DateTime', isRequired: false },
        gzzz005:   { name: 'gzzz005',   type: 'String',   isRequired: false },
        gzzz006:   { name: 'gzzz006',   type: 'String',   isRequired: false },
        gzzz007:   { name: 'gzzz007',   type: 'String',   isRequired: false },
        gzzz008:   { name: 'gzzz008',   type: 'String',   isRequired: false },
        gzzz009:   { name: 'gzzz009',   type: 'String',   isRequired: false },
        gzzz010:   { name: 'gzzz010',   type: 'String',   isRequired: false },
        gzzz011:   { name: 'gzzz011',   type: 'String',   isRequired: false },
    },
    Gzza: {
        gzzastus:  { name: 'gzzastus',  type: 'String',   isRequired: false },
        gzza001:   { name: 'gzza001',   type: 'String',   isRequired: true },
        gzza002:   { name: 'gzza002',   type: 'String',   isRequired: false },
        gzza003:   { name: 'gzza003',   type: 'String',   isRequired: false },
        gzza004:   { name: 'gzza004',   type: 'String',   isRequired: false },
        gzza005:   { name: 'gzza005',   type: 'String',   isRequired: false },
        gzza006:   { name: 'gzza006',   type: 'String',   isRequired: false },
        gzza007:   { name: 'gzza007',   type: 'Int',      isRequired: false },
        gzza008:   { name: 'gzza008',   type: 'String',   isRequired: false },
        gzza009:   { name: 'gzza009',   type: 'String',   isRequired: false },
        gzza010:   { name: 'gzza010',   type: 'String',   isRequired: false },
        gzza011:   { name: 'gzza011',   type: 'String',   isRequired: false },
        gzza012:   { name: 'gzza012',   type: 'String',   isRequired: false },
        gzza013:   { name: 'gzza013',   type: 'String',   isRequired: false },
        gzza014:   { name: 'gzza014',   type: 'Int',      isRequired: false },
        gzza015:   { name: 'gzza015',   type: 'String',   isRequired: false },
        gzza016:   { name: 'gzza016',   type: 'String',   isRequired: false },
        gzzaownid: { name: 'gzzaownid', type: 'String',   isRequired: false },
        gzzaowndp: { name: 'gzzaowndp', type: 'String',   isRequired: false },
        gzzacrtid: { name: 'gzzacrtid', type: 'String',   isRequired: false },
        gzzacrtdp: { name: 'gzzacrtdp', type: 'String',   isRequired: false },
        gzzacrtdt: { name: 'gzzacrtdt', type: 'DateTime', isRequired: false },
        gzzamodid: { name: 'gzzamodid', type: 'String',   isRequired: false },
        gzzamoddt: { name: 'gzzamoddt', type: 'DateTime', isRequired: false },
        gzza017:   { name: 'gzza017',   type: 'String',   isRequired: false },
        gzza018:   { name: 'gzza018',   type: 'String',   isRequired: false },
        gzza019:   { name: 'gzza019',   type: 'String',   isRequired: false },
        gzza020:   { name: 'gzza020',   type: 'String',   isRequired: false },
        gzza021:   { name: 'gzza021',   type: 'String',   isRequired: false },
        gzza022:   { name: 'gzza022',   type: 'String',   isRequired: false },
        gzza023:   { name: 'gzza023',   type: 'String',   isRequired: false },
        gzza024:   { name: 'gzza024',   type: 'Int',      isRequired: false },
    },
};

/** 从静态元数据获取模型的字段类型映射 */
function getModelFieldMap(modelName: string): Record<string, FieldMeta> {
    const meta = modelFieldMeta[modelName];
    if (!meta) {
        logger.error('[genAooi200] 无法获取模型字段元数据: %s', modelName);
        return {};
    }
    logger.debug({ modelName, fieldCount: Object.keys(meta).length },
        '[genAooi200] %s 字段映射: %d 个字段', modelName, Object.keys(meta).length);
    return meta;
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

/** 同步单张表 */
async function syncTable(table: string, sql: string): Promise<number> {
    const modelName = tableModelMap[table];        // schema 名，如 Gzzj

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

    // 写入 SQLite：清旧数据 + 插入新数据（事务）
    const db = appDB.getDb();
    const writeAll = db.transaction((dataRows: Record<string, unknown>[]) => {
        db.prepare(`DELETE FROM ${table}`).run();
        if (dataRows.length > 0) {
            const cols = Object.keys(dataRows[0]);
            const insert = db.prepare(
                `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            );
            for (const row of dataRows) {
                insert.run(...cols.map(c => row[c]));
            }
        }
    });
    writeAll(rows);

    logger.info({ table, rowCount: rows.length }, '[genAooi200] %s 同步完成', table);
    return rows.length;
}

/**
 * 清空 SQLite 中所有 gen-aooi200 相关表数据
 */
export async function cleanSqliteTables(): Promise<void> {
    const db = appDB.getDb();
    logger.info('[genAooi200] 开始清空 SQLite 相关表');

    for (const table of allTables) {
        const result = db.prepare(`DELETE FROM ${table}`).run();
        logger.info({ table, count: result.changes }, '[genAooi200] 清空 %s', table);
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

/**
 * 导出 AOOI200 导入模板 Excel 文件
 * 第一行 A-C 列：单据别、名称、作业编号，黄色底纹加粗
 */
export async function exportAooi200Template(filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    const headers = ['单据别', '名称', '作业编号'];
    const headerRow = sheet.getRow(1);

    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' },
        };
    });

    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 15;

    await workbook.xlsx.writeFile(filePath);
    logger.info('[genAooi200] 模板导出成功: %s', filePath);
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


// ==================== Aooi200QueryService ====================

/** 查询模式：external-外部数据库 | internal-内部 SQLite */
export type QueryMode = 'external' | 'internal';

/**
 * AOOI200 数据查询服务
 * 支持双模式：从外部数据库（Oracle/Kingbase）查询，或从内部 SQLite 查询
 */
export class Aooi200QueryService {
    private mode: QueryMode;

    constructor(mode: QueryMode = 'internal') {
        this.mode = mode;
    }

    /** 切换查询模式 */
    setMode(mode: QueryMode): void {
        this.mode = mode;
    }

    /** 获取当前查询模式 */
    getMode(): QueryMode {
        return this.mode;
    }

    /** 执行 SQL 查询：根据模式路由到外部 DB 或内部 SQLite */
    private async query(sql: string, ...params: unknown[]): Promise<Record<string, unknown>[]> {
        if (this.mode === 'external') {
            const result = await externalDB.query(sql);
            return result.rows as Record<string, unknown>[];
        } else {
            return appDB.getDb().prepare(sql).all(...params) as Record<string, unknown>[];
        }
    }

    /**
     * 根据作业编号查询单据性质
     * @param gzzz001 作业编号
     * @returns 单据性质 (gzzz006)
     */
    async gzzz006Get(gzzz001: string): Promise<string> {
        logger.debug({ mode: this.mode, gzzz001 }, '[Aooi200Query] gzzz006Get: 查询作业编号对应的单据性质');
        const sql = `
            SELECT DISTINCT gzzz006
            FROM gzzz_t
            LEFT OUTER JOIN gzzal_t ON gzzz001 = gzzal001 AND gzzal002 = 'zh_CN'
            , gzza_t
            WHERE 1=1
              AND gzzz002 = gzza001
              AND gzza002 IN ('T','Q')
              AND gzzzstus = 'Y'
              AND gzzz001 = ?
            ORDER BY gzzz001, gzzal003
        `;
        logger.debug({ sql, params: [gzzz001] }, '[Aooi200Query] gzzz006Get: 查询 SQL');
        const rows = await this.query(sql, gzzz001);
        return rows.length > 0 ? String(rows[0]['gzzz006'] ?? '') : '';
    }

    /**
     * 根据作业编号查询归属模块(gzzz005→oobx002)和单据性质(gzzz006→oobx003)
     * @param gzzz001 作业编号
     * @returns { gzzz005, gzzz006 } 或 null
     */
    async gzzzInfoGet(gzzz001: string): Promise<{ gzzz005: string; gzzz006: string } | null> {
        logger.debug({ mode: this.mode, gzzz001 }, '[Aooi200Query] gzzzInfoGet: 查询作业编号的归属模块和单据性质');
        const sql = `
            SELECT gzzz005, gzzz006
            FROM gzzz_t
            WHERE gzzz001 = ?
        `;
        logger.debug({ sql, params: [gzzz001] }, '[Aooi200Query] gzzzInfoGet: 查询 SQL');
        const rows = await this.query(sql, gzzz001);
        if (rows.length === 0) return null;
        return {
            gzzz005: String(rows[0]['gzzz005'] ?? ''),
            gzzz006: String(rows[0]['gzzz006'] ?? ''),
        };
    }

    /**
     * 校验作业编号是否存在且有效
     * @param gzzz001 作业编号
     * @returns 存在且有效则返回 true
     */
    async gzzz001Chk(gzzz001: string): Promise<boolean> {
        logger.debug({ mode: this.mode, gzzz001 }, '[Aooi200Query] gzzz001Chk: 校验作业编号是否存在');
        const sql = `
            SELECT COUNT(*) AS cnt
            FROM gzzz_t
            LEFT OUTER JOIN gzzal_t ON gzzz001 = gzzal001 AND gzzal002 = 'zh_CN'
            , gzza_t
            WHERE 1=1
              AND gzzz002 = gzza001
              AND gzza002 IN ('T','Q')
              AND gzzz001 = ?
        `;
        logger.debug({ sql, params: [gzzz001] }, '[Aooi200Query] gzzz001Chk: 查询 SQL');
        const rows = await this.query(sql, gzzz001);
        const count = Number(rows[0]?.cnt ?? 0);
        logger.debug({ count }, '[Aooi200Query] gzzz001Chk: 查询结果');
        return count > 0;
    }
}

// ==================== Excel 导入 ====================

/** Excel 导入行：Oobx 字段 + oobxl003（名称，对应 Oobxl 表） */
export type OobxImportRow = Oobx & { oobxl003: string };

/**
 * 从 Excel 模板读取用户导入的数据，转换为 Oobx 行
 * A列→oobx001, B列→oobxl003, C列→oobx004
 * oobx002、oobx003 通过 gzzzInfoGet(oobx004) 一次查询获取
 * @param filePath Excel 文件路径
 * @param mode     查询模式（默认 internal，从内部 SQLite 查）
 * @returns Oobx 导入行数组
 */
export async function importAooi200Template(filePath: string, mode: QueryMode = 'internal'): Promise<OobxImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
        throw new Error('Excel 文件中未找到工作表');
    }

    // 先收集原始数据（eachRow 同步，但后续查库是异步的）
    const rawRows: { oobx001: string; oobxl003: string; oobx004: string }[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头
        const oobx001 = String(row.getCell(1).value ?? '').trim();
        if (!oobx001) return; // 跳过空行
        rawRows.push({
            oobx001,
            oobxl003: String(row.getCell(2).value ?? '').trim(),
            oobx004: String(row.getCell(3).value ?? '').trim(),
        });
    });

    logger.info({ count: rawRows.length }, '[genAooi200] 从 Excel 读取到 %d 行数据', rawRows.length);

    // 异步查库填充 oobx003、oobx002
    const svc = new Aooi200QueryService(mode);
    const rows: OobxImportRow[] = [];

    for (const raw of rawRows) {
        const info = raw.oobx004 ? await svc.gzzzInfoGet(raw.oobx004) : null;

        rows.push({
            oobxent: 0,
            oobx001: raw.oobx001,
            oobx002: info?.gzzz005 || null,
            oobx003: info?.gzzz006 || null,
            oobx004: raw.oobx004 || null,
            oobx005: 'Y',
            oobx006: '6',
            oobxstus: 'Y',
            oobxl003: raw.oobxl003,
        } as OobxImportRow);
    }

    logger.info({ count: rows.length }, '[genAooi200] Excel 导入解析完成，共 %d 行', rows.length);
    return rows;
}

// ==================== Sheet 固定模板工具 ====================

const border = { style: 'thin' as const, color: { argb: 'FF000000' } };
const allBorders = { top: border, bottom: border, left: border, right: border };

/** 写入固定 8 行说明行 + 第 9 行标记行，返回列数 */
function writeFixedRows(sheet: ExcelJS.Worksheet, rows: string[][]): number {
    const colCount = rows[0].length;
    rows.forEach((data, rowIdx) => {
        const row = sheet.getRow(rowIdx + 1);
        data.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx + 1);
            cell.value = val;
            cell.border = allBorders;
        });
    });
    // 第 9 行标记
    const marker = sheet.getRow(9);
    marker.getCell(1).value = '由此行开始输入→';
    return colCount;
}


/**
 * 将解析后的 Oobx 导入数据导出为 Excel（A-M 列）
 * 前 8 行为固定说明行（全框线），正式数据从第 9 行开始
 * @param rows     Oobx 导入行数组
 * @param filePath 输出文件路径
 */
export async function exportAooi200Result(rows: OobxImportRow[], filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('sheet1');

    // 固定 8 行说明行 (行1–8)
    const fixedRows = [
        ['字段编号', 'old_docno', 'oobxstus', 'oobx001', 'oobxl003', 'oobx002', 'oobx003', 'oobx004', 'oobx005', 'oobx006', 'oobx007', 'oobx008', 'oobx009'],
        ['字段说明', '汇入顺序', '状态码', '单据别', '说明', '模组别', '单据性质', '对应作业编号', '自动编码否', '期别码', '所剩流水号长度', '编码结果', '于aoor700揭露'],
        ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'NUMBER', 'VARCHAR2', 'VARCHAR2'],
        ['格式/精度/长度', '', '10', '5', '500', '4', '10', '40', '1', '1', 'NUMBER(10,0)', '20', '1'],
        ['(黄底栏位)必填', '*', '*', 'KEY', '', '*', '*', '*', '*', '*', '', '*', '*'],
        ['SCC', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['(请勿删除)范例1', '1', 'Y', 'A530', '采购收货入库单', 'APM', 'apmt530', 'MULTI', 'Y', '1', '6', 'SS-A530-YYMM999999', 'Y'],
        ['(请勿删除)范例2', '2', 'Y', 'A501', '原辅料采购单', 'APM', 'apmt500', 'MULTI', 'Y', '1', '6', 'SS-A501-YYMM999999', 'Y'],
    ];
    writeFixedRows(sheet, fixedRows);

    // 正式数据从第9行开始
    rows.forEach((row, idx) => {
        const r = sheet.getRow(idx + 9);
        r.getCell(1).value = '由此行开始输入→';       // A: 固定提示
        r.getCell(2).value = idx + 1;               // B: 流水号
        r.getCell(3).value = row.oobxstus;          // C
        r.getCell(4).value = row.oobx001;           // D
        r.getCell(5).value = row.oobxl003;          // E
        r.getCell(6).value = row.oobx002;           // F
        r.getCell(7).value = row.oobx003;           // G
        r.getCell(8).value = row.oobx004;           // H
        r.getCell(9).value = row.oobx005;           // I
        r.getCell(10).value = row.oobx006;          // J
        r.getCell(11).value = row.oobx007;          // K
        r.getCell(12).value = row.oobx008;          // L
        r.getCell(13).value = row.oobx009;          // M
    });

    // 列宽
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 20;
    for (let i = 6; i <= 13; i++) {
        sheet.getColumn(i).width = 20;
    }

    await workbook.xlsx.writeFile(filePath);
    logger.info('[genAooi200] 处理结果导出成功: %s，共 %d 行', filePath, rows.length);
}



// ==================== Excel 导出（多 Sheet） ====================

/**
 * 导出多 Sheet 模板，Sheet1(参照表定义) 有数据填充，其余 Sheet 仅固定模板
 * @param rows     Oobx 导入行数组
 * @param filePath 输出文件路径
 * @param ooba001 参照表编号，默认 'S01'
 */
export async function exportAooi200Result2(
    rows: OobxImportRow[],
    filePath: string,
    ooba001: string = 'S01',
): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    const s1 = workbook.addWorksheet('sheet1');
    const s1Headers = [
        ['字段编号', 'old_docno', 'ooba001', 'ooba002', 'ooba008', 'ooba009', 'ooba010', 'ooba011', 'ooba012', 'ooba013', 'ooba014', 'ooba015', 'ooba016'],
        ['字段说明', '汇入顺序', '参照表编号', '单据别编号', '可用From', '可用To', 'MRP可用From', 'MRP可用To', '成本仓From', '成本仓To', '产品分类-正/负向表列', '理由码-正/负向表列', '备注'],
        ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
        ['格式/精度/长度', '', '5', '5', '1', '1', '1', '1', '1', '1', '1', '1', '255'],
        ['(黄底栏位)必填', '*', 'KEY', 'KEY', '', '', '', '', '', '', '', '', ''],
        ['SCC', '', '', '', 'Y/N', 'Y/N', 'Y/N', 'Y/N', 'Y/N', 'Y/N', '', '', ''],
        ['(请勿删除)范例1', '1', 'S01', 'TE21', '', '', '', '', '', '', '', '1', '1'],
        ['(请勿删除)范例2', '2', 'S01', 'TE21', '', '', '', '', '', '', '', '1', '1'],
    ];
    writeFixedRows(s1, s1Headers);
    // 填充数据（从第9行开始）
    rows.forEach((row, idx) => {
        const r = s1.getRow(idx + 9);
        r.getCell(1).value = '由此行开始输入→';   // A: 固定提示
        r.getCell(2).value = idx + 1;           // B: 流水号
        r.getCell(3).value = ooba001;           // C: 参照表编号
        r.getCell(4).value = row.oobx001;       // D: 单据别编号
    });
    s1.getColumn(1).width = 20;
    s1.getColumn(2).width = 20;
    s1.getColumn(3).width = 20;
    s1.getColumn(4).width = 20;
    for (let i = 5; i <= s1Headers[0].length; i++) {
        s1.getColumn(i).width = 20;
    }

    // --- 其余 Sheet：仅固定模板 ---
    const templateSheets: { name: string; headers: string[][]; widths: number[] }[] = [
        {
            name: 'sheet2',
            headers: [
                ['字段编号', 'old_docno', 'oobb001', 'oobb002', 'oobb003', 'oobb004', 'oobb005', 'oobb006', 'oobb007', 'oobb008'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '序号', '字段编号', '默认值', '默认值说明', '可更改', '备注'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'NUMBER', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', 'NUMBER(10,0)', '20', '100', '255', '1', '255'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY', '*', '', '', '*', ''],
                ['SCC', '', '', '', '', '', '', '', 'Y/N', ''],
                ['(请勿删除)范例1', '1', 'S01', 'T001', '1', 'sfajwf013', '1', '手动挑片', 'N', ''],
                ['(请勿删除)范例2', '2', 'S01', 'T001', '1', 'sfajwf013', '1', '手动挑片', 'N', ''],
            ],
            widths: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
        },
        {
            name: 'sheet3',
            headers: [
                ['字段编号', 'old_docno', 'oobc001', 'oobc002', 'oobc003', 'oobc004'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '控制组编号', '控制组类型'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '20', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY', '*'],
                ['SCC', '', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20, 20],
        },
        {
            name: 'sheet4',
            headers: [
                ['字段编号', 'old_docno', 'oobd001', 'oobd002', 'oobd003', 'oobd004'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '生命周期类型', '生命周期编号'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY', 'KEY'],
                ['SCC', '', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20, 20],
        },
        {
            name: 'sheet5',
            headers: [
                ['字段编号', 'old_docno', 'oobh001', 'oobh002', 'oobh003'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '产品分类'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY'],
                ['SCC', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20],
        },
        {
            name: 'sheet6',
            headers: [
                ['字段编号', 'old_docno', 'oobj001', 'oobj002', 'oobj003'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '库存标签编号'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY'],
                ['SCC', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20],
        },
        {
            name: 'sheet7',
            headers: [
                ['字段编号', 'old_docno', 'oobk001', 'oobk002', 'oobk003'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '库存标签编号'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY'],
                ['SCC', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20],
        },
        {
            name: 'sheet8',
            headers: [
                ['字段编号', 'old_docno', 'oobi001', 'oobi002', 'oobi003'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '单身理由码'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY'],
                ['SCC', '', '', '', ''],
                ['(请勿删除)范例1', '1', '', '', ''],
                ['(请勿删除)范例2', '2', '', '', ''],
            ],
            widths: [20, 20, 20, 20, 20],
        },
        {
            name: 'sheet9',
            headers: [
                ['字段编号', 'old_docno', 'ooac001', 'ooac002', 'ooac003', 'ooac004'],
                ['字段说明', '汇入顺序', '参照表号', '单据别', '参数编号', '参数值'],
                ['字段类型', '', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2', 'VARCHAR2'],
                ['格式/精度/长度', '', '5', '5', '10', '80'],
                ['(黄底栏位)必填', '*', 'KEY', 'KEY', 'KEY', ''],
                ['SCC', '', '', '', '', ''],
                ['(请勿删除)范例1', '1', 'S01', '1200', 'D-BAS-0102', 'Y'],
                ['(请勿删除)范例2', '2', 'S01', '1200', 'D-BAS-0102', 'Y'],
            ],
            widths: [20, 20, 20, 20, 20, 20],
        },
    ];

    for (const s of templateSheets) {
        const sheet = workbook.addWorksheet(s.name);
        writeFixedRows(sheet, s.headers);
        s.widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
    }

    await workbook.xlsx.writeFile(filePath);
    logger.info('[genAooi200] 多Sheet处理结果导出成功: %s，%d Sheet，%d 行', filePath, templateSheets.length + 1, rows.length);
}

// ==================== 配置导入/导出（JSON） ====================

interface ConfigExportData {
    version: number;
    exportedAt: string;
    tables: Record<string, Record<string, unknown>[]>;
}

/**
 * 将所有相关表数据导出为 JSON 配置文件
 * @param filePath 输出 JSON 文件路径
 */
export async function exportConfig(filePath: string): Promise<{ table: string; count: number }[]> {
    const db = appDB.getDb();
    const results: { table: string; count: number }[] = [];
    const tablesData: Record<string, Record<string, unknown>[]> = {};

    for (const table of allTables) {
        const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
        tablesData[table] = rows;
        results.push({ table, count: rows.length });
        logger.info('[genAooi200] 导出 %s: %d 条', table, rows.length);
    }

    const data: ConfigExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tables: tablesData,
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const total = results.reduce((sum, r) => sum + r.count, 0);
    logger.info({ total, results }, '[genAooi200] 配置导出完成: %s', filePath);
    return results;
}

/**
 * 从 JSON 配置文件导入数据到所有相关表
 * 先清空所有表，再插入数据
 * @param filePath JSON 配置文件路径
 */
export async function importConfig(filePath: string): Promise<{ table: string; count: number }[]> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ConfigExportData = JSON.parse(raw);

    if (!data.version || !data.tables) {
        throw new Error('无效的配置文件格式：缺少 version 或 tables 字段');
    }

    const db = appDB.getDb();
    const results: { table: string; count: number }[] = [];

    for (const table of allTables) {
        const modelName = tableModelMap[table];
        const rows = data.tables[table];

        if (!rows || !Array.isArray(rows)) {
            logger.warn('[genAooi200] 配置文件中未找到表 %s 的数据，跳过', table);
            results.push({ table, count: 0 });
            continue;
        }

        // 获取字段映射以进行类型转换
        const fieldMap = getModelFieldMap(modelName);

        const convertedRows = rows.map(row => convertRow(row, fieldMap));

        // 事务：清旧数据 + 插入新数据
        const writeAll = db.transaction((dataRows: Record<string, unknown>[]) => {
            db.prepare(`DELETE FROM ${table}`).run();
            if (dataRows.length > 0) {
                const cols = Object.keys(dataRows[0]);
                const insert = db.prepare(
                    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                );
                for (const row of dataRows) {
                    insert.run(...cols.map(c => row[c]));
                }
            }
        });
        writeAll(convertedRows);

        logger.info('[genAooi200] 导入 %s: %d 条', table, convertedRows.length);
        results.push({ table, count: convertedRows.length });
    }

    const total = results.reduce((sum, r) => sum + r.count, 0);
    logger.info({ total, results }, '[genAooi200] 配置导入完成: %s', filePath);
    return results;
}

// ==================== wf Oobx 数据处理 ====================

/** 外部数据库 oobx_t + oobxl_t 联查结果行 */
export interface WfOobxRow {
    oobx001: string;
    oobxl003: string | null;
    oobx004: string | null;
    oobx003: string | null;
    oobx002: string | null;
}

/** 单引号转义（Oracle / Kingbase 通用） */
function esc(v: string): string {
    return v.replace(/'/g, "''");
}

/** 在外部数据库事务中执行操作（兼容 Kingbase / Oracle） */
async function externalTransaction<T>(fn: (exec: (sql: string) => Promise<void>) => Promise<T>): Promise<T> {
    const dbType = externalDB.dbType;
    if (dbType === 'kingbase') {
        return externalDB.transactionKingbase(async (client) => {
            return fn(async (sql) => { await client.query(sql); });
        });
    }
    if (dbType === 'oracle') {
        return externalDB.transactionOracle(async (connection) => {
            return fn(async (sql) => { await connection.execute(sql); });
        });
    }
    throw new Error(`[genAooi200] 不支持的外部数据库类型: ${dbType}`);
}

/**
 * 从外部数据库查询符合条件的 Oobx 数据（oobx004 以 _wf 结尾）
 * 对应 SQL：
 *   SELECT oobx001,oobxl003,oobx004,oobx003,oobx002
 *   FROM ${schema}.oobx_t
 *   LEFT JOIN ${schema}.oobxl_t ON oobxlent = oobxent AND oobxl001 = oobx001 AND oobxl002 = 'zh_CN'
 *   WHERE oobx004 <> 'MULTI'
 *     AND oobx004 LIKE '%_wf'
 *     AND EXISTS (SELECT * FROM ${schema}.gzzz_t WHERE gzzz010 = 'wf' AND gzzz006 = oobx003)
 *     AND EXISTS (SELECT * FROM ${schema}.gzzz_t WHERE gzzz001 = REPLACE(oobx004, '_wf', ''))
 *     AND oobxent = ${ent}
 * @param schema 数据库 schema
 * @param ent    企业编号
 */
export async function queryWfOobxData(schema: string, ent: number): Promise<WfOobxRow[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法查询 wf Oobx 数据');
    }

    const sql = `
        SELECT oobx001, oobxl003, oobx002, oobx003, oobx004
        FROM ${schema}.oobx_t
        LEFT JOIN ${schema}.oobxl_t ON oobxlent = oobxent AND oobxl001 = oobx001 AND oobxl002 = 'zh_CN'
        WHERE 1=1
          AND oobx004 <> 'MULTI'
          AND oobx004 LIKE '%_wf'
          AND EXISTS (SELECT * FROM ${schema}.gzzz_t WHERE gzzz010 = 'wf' AND gzzz006 = oobx003)
          AND EXISTS (SELECT * FROM ${schema}.gzzz_t WHERE gzzz001 = REPLACE(oobx004, '_wf', ''))
          AND oobxent = ${ent}
    `;

    logger.debug({ sql, schema, ent }, '[genAooi200] queryWfOobxData: 查询外部数据库');
    const result = await externalDB.query(sql);
    const rows = result.rows as Record<string, unknown>[];
    logger.info({ schema, ent, count: rows.length }, '[genAooi200] queryWfOobxData: 查询完成');

    return rows.map(row => ({
        oobx001: String(row['oobx001'] ?? ''),
        oobxl003: row['oobxl003'] != null ? String(row['oobxl003']) : null,
        oobx004: row['oobx004'] != null ? String(row['oobx004']) : null,
        oobx003: row['oobx003'] != null ? String(row['oobx003']) : null,
        oobx002: row['oobx002'] != null ? String(row['oobx002']) : null,
    }));
}

/**
 * 对符合条件的 Oobx 数据，先删除 oobl_t 中原有记录，再插入两条新数据
 * （oobx004 原值 + 替换掉 "_wf" 后的值各一条）
 * 对应 SQL：
 *   UPDATE ${schema}.oobx_t SET oobx004 = 'MULTI' WHERE oobxent = ${ent} AND oobx001 IN (${oobx001_list})
 * 
 *   DELETE FROM ${schema}.oobl_t WHERE ooblent = ${ent} AND oobl001 IN (${oobx001_list})
 *   INSERT INTO ${schema}.oobl_t (ooblent, oobl001, oobl002)
 *   VALUES ('${ent}', '${oobx001}', '${oobx004}'), ('${ent}', '${oobx001}', '${oobx004_无_wf}')
 * @param schema 数据库 schema
 * @param ent    企业编号
 * @param rows   从 queryWfOobxData 返回的行
 * @returns 插入的总行数
 */
export async function replaceOoblWfData(schema: string, ent: number, rows: WfOobxRow[]): Promise<number> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法处理 oobl wf 数据');
    }

    if (rows.length === 0) {
        logger.info('[genAooi200] replaceOoblWfData: 无数据，跳过');
        return 0;
    }

    const oobx001List = Array.from(new Set(rows.map(r => r.oobx001).filter(Boolean)));
    const inClause = oobx001List.map(v => `'${esc(v)}'`).join(', ');

    // 在事务中执行 UPDATE + DELETE + INSERT，报错时自动回滚
    return externalTransaction(async (exec) => {
        const updateSql = `UPDATE ${schema}.oobx_t SET oobx004 = 'MULTI' WHERE oobxent = ${ent} AND oobx001 IN (${inClause})`;
        logger.debug({ updateSql, schema, ent, oobx001Count: oobx001List.length }, '[genAooi200] replaceOoblWfData: 更新 oobx004 为 MULTI');
        await exec(updateSql);

        const deleteSql = `DELETE FROM ${schema}.oobl_t WHERE ooblent = ${ent} AND oobl001 IN (${inClause})`;
        logger.debug({ deleteSql, schema, ent, oobx001Count: oobx001List.length }, '[genAooi200] replaceOoblWfData: 删除旧数据');
        await exec(deleteSql);

        let insertedCount = 0;
        for (const row of rows) {
            const oobx004 = row.oobx004 ?? '';
            const oobx004Clean = oobx004.replace(/_wf$/, '');

            for (const val of [oobx004, oobx004Clean]) {
                const insertSql = `INSERT INTO ${schema}.oobl_t (ooblent, oobl001, oobl002) VALUES ('${esc(String(ent))}', '${esc(row.oobx001)}', '${esc(val)}')`;
                await exec(insertSql);
                insertedCount++;
            }
        }

        logger.info({ schema, ent, deleted: oobx001List.length, inserted: insertedCount },
            '[genAooi200] replaceOoblWfData: 处理完成');
        return insertedCount;
    });
}
// ==================== 单据别参照表比对 & 配置复制 ====================

/** 单据别配置涉及的 8 张表 */
interface DocConfigTable {
    table: string;   // 表名，如 'ooba_t'
    entCol: string;  // 企业编号列，如 'oobaent'
    refCol: string;  // 参照表编号列，如 'ooba001'
    docCol: string;  // 单据别列，如 'ooba002'
}

const docConfigTables: DocConfigTable[] = [
    { table: 'ooba_t', entCol: 'oobaent', refCol: 'ooba001', docCol: 'ooba002' },
    { table: 'oobb_t', entCol: 'oobbent', refCol: 'oobb001', docCol: 'oobb002' },
    { table: 'oobc_t', entCol: 'oobcent', refCol: 'oobc001', docCol: 'oobc002' },
    { table: 'oobd_t', entCol: 'oobdent', refCol: 'oobd001', docCol: 'oobd002' },
    { table: 'oobh_t', entCol: 'oobhent', refCol: 'oobh001', docCol: 'oobh002' },
    { table: 'oobi_t', entCol: 'oobient', refCol: 'oobi001', docCol: 'oobi002' },
    { table: 'oobj_t', entCol: 'oobjent', refCol: 'oobj001', docCol: 'oobj002' },
    { table: 'oobk_t', entCol: 'oobkent', refCol: 'oobk001', docCol: 'oobk002' },
    { table: 'ooac_t', entCol: 'ooacent', refCol: 'ooac001', docCol: 'ooac002' },
];

/** 单条单据别参照表查询结果 */
export interface OobaRefRow {
    ooba002: string;
    oobxl003: string | null;
    oobx002: string | null;
    oobx003: string | null;
    oobx004: string | null;
}

/** 两个 ENT 匹配的单据别行 */
export interface MatchedOobaRow {
    ooba002: string;
    oobxl003Ent1: string | null;
    oobxl003Ent2: string | null;
    oobx002: string | null;
    oobx003: string | null;
    oobx004: string | null;
}

/**
 * 查询单个 ENT 在指定参照表下的单据别列表
 * SELECT ooba002,oobxl003,oobx002,oobx003,oobx004
 * FROM ooba_t
 * LEFT JOIN oobx_t ON oobaent = oobxent AND ooba002 = oobx001
 * LEFT JOIN oobxl_t ON oobx001 = oobxl001 AND oobxent = oobxlent AND oobxl002 = 'zh_CN'
 * WHERE oobaent = ${ent} AND ooba001 = ${ooba001}
 */
export async function queryOobaByRef(
    schema: string, ent: number, ooba001: string,
): Promise<OobaRefRow[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法查询单据别参照表');
    }

    const sql = `
        SELECT ooba002, oobxl003, oobx002, oobx003, oobx004
        FROM ${schema}.ooba_t
        LEFT JOIN ${schema}.oobx_t ON oobaent = oobxent AND ooba002 = oobx001
        LEFT JOIN ${schema}.oobxl_t ON oobx001 = oobxl001 AND oobxent = oobxlent AND oobxl002 = 'zh_CN'
        WHERE oobaent = ${ent}
          AND ooba001 = '${esc(ooba001)}'
        ORDER BY ooba002
    `;

    logger.debug({ sql, schema, ent, ooba001 }, '[genAooi200] queryOobaByRef: 查询单据别参照表');
    const result = await externalDB.query(sql);
    const rows = result.rows as Record<string, unknown>[];
    logger.info({ schema, ent, ooba001, count: rows.length }, '[genAooi200] queryOobaByRef: 查询完成');

    return rows.map(row => ({
        ooba002: String(row['ooba002'] ?? ''),
        oobxl003: row['oobxl003'] != null ? String(row['oobxl003']) : null,
        oobx002: row['oobx002'] != null ? String(row['oobx002']) : null,
        oobx003: row['oobx003'] != null ? String(row['oobx003']) : null,
        oobx004: row['oobx004'] != null ? String(row['oobx004']) : null,
    }));
}

/**
 * 比对两个 ENT 在不同参照表下的单据别数据
 * 按 ooba002,oobx002,oobx003,oobx004 完全匹配进行关联
 * @param schemaFrom  源 schema（ent1 所在的）
 * @param schemaTo    目标 schema（ent2 所在的）
 * @param ooba001From 源参照表编号（ent1 中的）
 * @param ooba001To   目标参照表编号（ent2 中的）
 * @returns 匹配行（含双方 oobxl003）、仅 ent1 的行、仅 ent2 的行
 */
export async function compareOobaRef(
    schemaFrom: string, schemaTo: string, ent1: number, ent2: number, ooba001From: string, ooba001To: string,
): Promise<{ matched: MatchedOobaRow[]; onlyEnt1: OobaRefRow[]; onlyEnt2: OobaRefRow[] }> {
    const [rows1, rows2] = await Promise.all([
        queryOobaByRef(schemaFrom, ent1, ooba001From),
        queryOobaByRef(schemaTo, ent2, ooba001To),
    ]);

    const map2 = new Map<string, OobaRefRow>();
    for (const r of rows2) {
        map2.set(r.ooba002, r);
    }

    const matched: MatchedOobaRow[] = [];
    const onlyEnt1: OobaRefRow[] = [];
    const matchedKeys = new Set<string>();

    for (const r1 of rows1) {
        const r2 = map2.get(r1.ooba002);
        if (
            r2 &&
            r1.oobx002 === r2.oobx002 &&
            r1.oobx003 === r2.oobx003 &&
            r1.oobx004 === r2.oobx004
        ) {
            matched.push({
                ooba002: r1.ooba002,
                oobxl003Ent1: r1.oobxl003,
                oobxl003Ent2: r2.oobxl003,
                oobx002: r1.oobx002,
                oobx003: r1.oobx003,
                oobx004: r1.oobx004,
            });
            matchedKeys.add(r1.ooba002);
        } else {
            onlyEnt1.push(r1);
        }
    }

    const onlyEnt2 = rows2.filter(r => !matchedKeys.has(r.ooba002));

    logger.info({
        schemaFrom, schemaTo, ent1, ent2, ooba001From, ooba001To,
        matched: matched.length, onlyEnt1: onlyEnt1.length, onlyEnt2: onlyEnt2.length,
    }, '[genAooi200] compareOobaRef: 比对完成');

    return { matched, onlyEnt1, onlyEnt2 };
}

/** 在外部数据库整表备份（DDL，Oracle 下会隐式提交） */
async function createBackupTable(
    schema: string, table: string, ts: number,
): Promise<string> {
    const backupTable = `${table}_bck_${ts}`;
    const sql = `CREATE TABLE ${schema}.${backupTable} AS SELECT * FROM ${schema}.${table}`;
    logger.debug({ sql }, '[genAooi200] createBackupTable: %s', backupTable);
    await externalDB.query(sql);
    return backupTable;
}

/** 添加校验错误，failFast 模式下返回 true 表示应立即终止 */
function pushError(errors: ValidateError[], err: ValidateError | null, mode: ValidateMode): boolean {
    if (err) {
        errors.push(err);
        return mode === 'failFast';
    }
    return false;
}

/**
 * 校验 ent1 的单据别配置能否迁移到 ent2（仅校验，不修改数据）
 * 从 schemaFrom 查询 ent1(ooba001From) 源数据，在 schemaTo 的 ent2(ooba001To) 环境中逐表逐行校验
 * @param schemaFrom   源数据库 schema
 * @param schemaTo     目标数据库 schema
 * @param ent1         源企业编号
 * @param ent2         目标企业编号
 * @param ooba001From  源参照表编号
 * @param ooba001To    目标参照表编号
 * @param ooba002List  要校验的单据别列表
 * @param mode         校验模式：collect-收集所有错误 | failFast-遇错即停（默认 collect）
 * @returns 校验错误列表（空数组表示全部通过）
 */
export async function validateDocConfig(
    schemaFrom: string, schemaTo: string, ent1: number, ent2: number,
    ooba001From: string, ooba001To: string, ooba002List: string[],
    mode: ValidateMode = 'collect',
): Promise<ValidateError[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法校验单据别配置');
    }

    if (ooba002List.length === 0) {
        return [];
    }

    const inClause = ooba002List.map(v => `'${esc(v)}'`).join(', ');
    const ent2Str = String(ent2);
    const errors: ValidateError[] = [];

    for (const { table, entCol, refCol, docCol } of docConfigTables) {
        const selectSql = `SELECT * FROM ${schemaFrom}.${table} WHERE ${entCol} = ${ent1} AND ${refCol} = '${esc(ooba001From)}' AND ${docCol} IN (${inClause})`;
        const srcResult = await externalDB.query(selectSql);
        const srcRows = srcResult.rows as Record<string, unknown>[];

        if (srcRows.length === 0) continue;

        for (const row of srcRows) {
            switch (table) {
                case 'ooba_t':
                    if (pushError(errors, await ooba001Chk(ooba001To, ent2Str, schemaTo), mode)) return errors;
                    if (pushError(errors, await ooba002Chk(String(row['ooba002'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobb_t':
                    if (pushError(errors, await oobb004Chk(String(row['oobb004'] ?? ''), String(row['oobb002'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobc_t':
                    if (pushError(errors, await oobc003Chk(String(row['oobc003'] ?? ''), String(row['oobc004'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobd_t':
                    if (pushError(errors, await oobd004Chk(String(row['oobd003'] ?? ''), String(row['oobd004'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobh_t':
                    if (pushError(errors, await oobh003Chk(String(row['oobh003'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobi_t':
                    if (pushError(errors, await oobi003Chk(String(row['oobi002'] ?? ''), String(row['oobi003'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobj_t':
                    if (pushError(errors, await oobj003Chk(String(row['oobj003'] ?? ''), ent2Str, schemaTo), mode)) return errors;
                    break;
                case 'oobk_t':
                    if (pushError(errors, await oobj003Chk(String(row['oobk003'] ?? ''), ent2Str, schemaTo, 'oobk_t', 'oobk003', '库存标签编号T'), mode)) return errors;
                    break;
            }
        }

        if (mode === 'failFast' && errors.length > 0) return errors;
    }

    logger.info({ schemaFrom, schemaTo, ent1, ent2, ooba001From, ooba001To, errorCount: errors.length }, '[genAooi200] validateDocConfig: 校验完成');
    return errors;
}

/**
 * 将 ent1 指定参照表的单据别配置迁移到 ent2 指定参照表（含备份→校验→删除→插入）
 *
 * 迁移本质：从 schemaFrom.ent1.ooba001From 查数据，替换 ent→ent2 + 参照表→ooba001To 后插入 schemaTo.ent2
 * 1. 先为 schemaTo.ent2 在 ooba001To 下的现有数据创建备份表（DDL，Oracle 下隐式提交）
 * 2. 查询 schemaFrom.ent1(ooba001From) 全部源数据，在 schemaTo.ent2(ooba001To) 环境中校验
 * 3. 校验通过后在事务中：删除 schemaTo.ent2(ooba001To) 旧数据 → 插入替换后的数据
 * @param schemaFrom   源数据库 schema
 * @param schemaTo     目标数据库 schema
 * @param ent1         源企业编号
 * @param ent2         目标企业编号
 * @param ooba001From  源参照表编号（ent1 中的）
 * @param ooba001To    目标参照表编号（ent2 中的）
 * @param ooba002List  要复制的单据别列表（ent1/ent2 共用同一套单据别编号）
 * @param mode         校验模式：collect-收集所有错误 | failFast-遇错即停（默认 collect）
 * @returns 备份时间戳、各表复制行数、校验错误列表
 */
export async function copyDocConfig(
    schemaFrom: string, schemaTo: string, ent1: number, ent2: number,
    ooba001From: string, ooba001To: string, ooba002List: string[],
    mode: ValidateMode = 'collect',
): Promise<{ timestamp: number; results: { table: string; deleted: number; inserted: number }[]; errors: ValidateError[] }> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法复制单据别配置');
    }

    if (ooba002List.length === 0) {
        logger.info('[genAooi200] copyDocConfig: ooba002List 为空，跳过');
        return { timestamp: 0, results: [], errors: [] };
    }

    const ts = Math.floor(Date.now() / 1000);
    const inClause = ooba002List.map(v => `'${esc(v)}'`).join(', ');

    // Step 1: 整表备份（备份 schemaTo 下全部配置表数据，DDL 自动提交）
    const backedUpTables: string[] = [];
    for (const { table } of docConfigTables) {
        const bt = await createBackupTable(schemaTo, table, ts);
        backedUpTables.push(bt);
    }
    logger.info({ schemaTo, ts, tables: backedUpTables }, '[genAooi200] copyDocConfig: 备份表创建完成');

    // Step 2: 校验 schemaFrom.ent1 源数据在 schemaTo.ent2 环境中的合法性
    const errors = await validateDocConfig(schemaFrom, schemaTo, ent1, ent2, ooba001From, ooba001To, ooba002List, mode);
    if (errors.length > 0) {
        logger.warn({ errorCount: errors.length }, '[genAooi200] copyDocConfig: 校验不通过，跳过复制（备份表已保留）');
        return { timestamp: ts, results: [], errors };
    }

    // Step 3: 校验全部通过，在事务中执行 DELETE(schemaTo, ent2, ooba001To) + INSERT(替换 ent 和 refCol)
    const results = await externalTransaction(async (exec) => {
        const stepResults: { table: string; deleted: number; inserted: number }[] = [];

        for (const { table, entCol, refCol, docCol } of docConfigTables) {
            const selectSql = `SELECT * FROM ${schemaFrom}.${table} WHERE ${entCol} = ${ent1} AND ${refCol} = '${esc(ooba001From)}' AND ${docCol} IN (${inClause})`;
            const srcResult = await externalDB.query(selectSql);
            const srcRows = srcResult.rows as Record<string, unknown>[];
            if (srcRows.length === 0) {
                stepResults.push({ table, deleted: 0, inserted: 0 });
                continue;
            }

            const cols = Object.keys(srcRows[0]);

            const deleteSql = `DELETE FROM ${schemaTo}.${table} WHERE ${entCol} = ${ent2} AND ${refCol} = '${esc(ooba001To)}' AND ${docCol} IN (${inClause})`;
            await exec(deleteSql);

            let inserted = 0;
            for (const srcRow of srcRows) {
                const row = {
                    ...srcRow,
                    [entCol.toLowerCase()]: ent2, [entCol.toUpperCase()]: ent2,
                    [refCol.toLowerCase()]: ooba001To, [refCol.toUpperCase()]: ooba001To,
                };
                const colList = cols.map(c => `"${c}"`).join(', ');
                const valList = cols.map(c => {
                    const v = row[c.toLowerCase()] ?? row[c.toUpperCase()] ?? row[c];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number') return String(v);
                    if (v instanceof Date) return `'${v.toISOString().replace('T', ' ').replace('Z', '')}'`;
                    return `'${esc(String(v))}'`;
                }).join(', ');
                const insertSql = `INSERT INTO ${schemaTo}.${table} (${colList}) VALUES (${valList})`;
                await exec(insertSql);
                inserted++;
            }

            stepResults.push({ table, deleted: srcRows.length, inserted });
            logger.debug({ table, deleted: srcRows.length, inserted }, '[genAooi200] copyDocConfig: %s 处理完成', table);
        }

        return stepResults;
    });

    const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
    logger.info({ schemaFrom, schemaTo, ent1, ent2, ooba001From, ooba001To, ts, totalInserted }, '[genAooi200] copyDocConfig: 全部复制完成');
    return { timestamp: ts, results, errors };
}

/**
 * 从备份表整表恢复数据
 * 先清空原表 → 从备份表回插全部数据 → 删除备份表
 * @param schema      数据库 schema
 * @param timestamp   备份时间戳
 */
export async function restoreFromBackup(
    schema: string, timestamp: number,
): Promise<string[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法从备份恢复');
    }

    const restored: string[] = [];

    for (const { table } of docConfigTables) {
        const backupTable = `${table}_bck_${timestamp}`;

        // 检查备份表是否存在
        try {
            await externalDB.query(`SELECT 1 FROM ${schema}.${backupTable} WHERE 1=0`);
        } catch {
            logger.warn('[genAooi200] restoreFromBackup: 备份表不存在，跳过 %s', backupTable);
            continue;
        }

        await externalTransaction(async (exec) => {
            await exec(`DELETE FROM ${schema}.${table}`);
            await exec(`INSERT INTO ${schema}.${table} SELECT * FROM ${schema}.${backupTable}`);
            await exec(`DROP TABLE ${schema}.${backupTable}`);
        });

        restored.push(backupTable);
        logger.info('[genAooi200] restoreFromBackup: %s 已恢复并删除', backupTable);
    }

    logger.info({ schema, timestamp, restored }, '[genAooi200] restoreFromBackup: 恢复完成');
    return restored;
}

/**
 * 清理备份表
 * @param schema    数据库 schema
 * @param timestamp 指定时间戳则只清理该批，不传则清理所有符合 ooba_bck_xxx 命名规则的表
 * @returns 清理的表名列表
 */
export async function cleanBackups(schema: string, timestamp?: number): Promise<string[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法清理备份表');
    }

    const cleaned: string[] = [];

    if (timestamp !== undefined) {
        // 按时间戳精确清理
        for (const { table } of docConfigTables) {
            const backupTable = `${table}_bck_${timestamp}`;
            try {
                await externalDB.query(`DROP TABLE ${schema}.${backupTable}`);
                cleaned.push(backupTable);
                logger.info('[genAooi200] cleanBackups: 已删除 %s', backupTable);
            } catch {
                logger.debug('[genAooi200] cleanBackups: 表不存在，跳过 %s', backupTable);
            }
        }
    } else {
        // 清理全部备份表：查询用户表名中包含 _bck_ 的表
        const dbType = externalDB.dbType;
        let findSql: string;
        if (dbType === 'oracle') {
            findSql = `SELECT table_name FROM all_tables WHERE owner = UPPER('${esc(schema)}') AND table_name LIKE '%_BCK\\_%' ESCAPE '\\'`;
        } else {
            findSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${esc(schema)}' AND table_name LIKE '%_bck_%'`;
        }

        try {
            const result = await externalDB.query(findSql);
            const rows = result.rows as Record<string, unknown>[];
            for (const row of rows) {
                const tname = String(row['table_name'] ?? row['TABLE_NAME'] ?? '');
                if (!tname) continue;
                try {
                    await externalDB.query(`DROP TABLE ${schema}.${tname}`);
                    cleaned.push(tname);
                    logger.info('[genAooi200] cleanBackups: 已删除 %s', tname);
                } catch (err) {
                    logger.warn({ err }, '[genAooi200] cleanBackups: 删除 %s 失败', tname);
                }
            }
        } catch (err) {
            logger.warn({ err }, '[genAooi200] cleanBackups: 查询备份表列表失败');
        }
    }

    logger.info({ schema, timestamp, cleaned }, '[genAooi200] cleanBackups: 清理完成');
    return cleaned;
}

/** 备份版本信息 */
export interface BackupVersion {
    timestamp: number;
    tables: string[];
}

/**
 * 列出所有备份版本
 * 查询数据库中所有 _bck_ 表，按时间戳分组
 * @param schema 数据库 schema
 */
export async function listBackupTimestamps(schema: string): Promise<BackupVersion[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法查看备份列表');
    }

    const dbType = externalDB.dbType;
    let findSql: string;
    if (dbType === 'oracle') {
        findSql = `SELECT table_name FROM all_tables WHERE owner = UPPER('${esc(schema)}') AND table_name LIKE '%_BCK\\_%' ESCAPE '\\'`;
    } else {
        findSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${esc(schema)}' AND table_name LIKE '%_bck_%'`;
    }

    const result = await externalDB.query(findSql);
    const rows = result.rows as Record<string, unknown>[];

    // 按时间戳分组
    const groupMap = new Map<number, string[]>();
    for (const row of rows) {
        const tname = String(row['table_name'] ?? row['TABLE_NAME'] ?? '');
        // 解析表名中的时间戳：xxx_bck_1234567890
        const match = tname.match(/_bck_(\d+)$/);
        if (match) {
            const ts = Number(match[1]);
            if (!groupMap.has(ts)) groupMap.set(ts, []);
            groupMap.get(ts)!.push(tname);
        }
    }

    const versions: BackupVersion[] = [];
    for (const [ts, tables] of groupMap) {
        versions.push({ timestamp: ts, tables: tables.sort() });
    }
    versions.sort((a, b) => b.timestamp - a.timestamp);

    logger.info({ schema, count: versions.length }, '[genAooi200] listBackupTimestamps: 查询完成');
    return versions;
}

/**
 * 检查参照表是否存在
 * @param ooba001  参照表编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function ooba001Chk(ooba001: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba001, entTo, schemaTo }, 'ooba001Chk: 校验参照表编号');
    const sql_ooal_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.ooal_t
        WHERE ooal001 ='3'
        AND ooal002 = '${ooba001}'
        AND ooalent = '${entTo}'
        `;
    logger.debug({ sql: sql_ooal_count }, 'ooba001Chk: 查询参照表编号');
    const countResult = await externalDB.query(sql_ooal_count);

    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ ooba001 }, 'ooba001Chk: 参照表编号不存在');
        return { table: 'ooba_t', field: 'ooba001', label: '参照表编号', value: ooba001, message: `[ooba_t] 参照表编号 [${ooba001}] 在参照表定义表(ooal_t, 类别=3)中不存在` };
    }
    logger.debug({ ooba001 }, 'ooba001Chk: 校验通过');
    return null;
}

/**
 * 检查单据别是否存在 
 * @param ooba002  单据别编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function ooba002Chk(ooba002: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba002, entTo, schemaTo }, 'ooba002Chk: 校验单据别编号');
    const sql_oobx_count_ooba = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oobx_t
        WHERE oobxent = '${entTo}'
        AND oobx001 = '${ooba002}'
        `;
    logger.debug({ sql: sql_oobx_count_ooba }, 'ooba002Chk: 查询单据别编号');
    const countResult = await externalDB.query(sql_oobx_count_ooba);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ ooba002 }, 'ooba002Chk: 单据别编号不存在');
        return { table: 'ooba_t', field: 'ooba002', label: '单据别编号', value: ooba002, message: `[ooba_t] 单据别编号 [${ooba002}] 在单据别定义表(oobx_t)中不存在` };
    }
    logger.debug({ ooba002 }, 'ooba002Chk: 校验通过');
    return null;
}

/** 
 * 校验字段编号是否存在于对应的单据别中
 * @param oobb004  字段编号
 * @param ooba002  单据别编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobb004Chk(oobb004: string, ooba002: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobb004, ooba002, entTo, schemaTo }, 'oobb004Chk: 校验字段编号');
    // v_dzeb001_2
    const sql_dzeb_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.dzeb_t,${schemaTo}.dzac_t LEFT JOIN ${schemaTo}.gzzz_t ON dzac001 = gzzz002 
        WHERE dzeb002 = dzac002 AND dzeb001 = dzac005 AND dzeb002 = '${oobb004}' AND gzzz001 IN (SELECT oobl002 FROM ${schemaTo}.oobl_t WHERE oobl001= '${ooba002}' AND ooblent = '${entTo}')
        `;
    logger.debug({ sql: sql_dzeb_count }, 'oobb004Chk: 查询字段编号');
    const countResult = await externalDB.query(sql_dzeb_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobb004, ooba002 }, 'oobb004Chk: 字段编号校验不通过');
        return { table: 'oobb_t', field: 'oobb004', label: '字段编号', value: oobb004, message: `[oobb_t] 字段编号 [${oobb004}] 不存在于单据别 [${ooba002}]` };
    }
    logger.debug({ oobb004 }, 'oobb004Chk: 校验通过');
    return null;
}

/** 
 * @param oobc003  控制组编号
 * @param oobc004  控制组类型
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobc003Chk(oobc003: string, oobc004: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobc003, oobc004, entTo, schemaTo }, 'oobc003Chk: 校验控制组编号');

    if (oobc004 === '8') {
        // 员工类型控制组 v_ooag001
        const sql_ooag_count = `
            SELECT COUNT(*) AS cnt
            FROM ${schemaTo}.ooag_t
            WHERE ooagent = '${entTo}'
              AND ooag001 = '${oobc003}'
            `;
        logger.debug({ sql: sql_ooag_count }, 'oobc003Chk: 查询员工类型控制组');
        const countResult = await externalDB.query(sql_ooag_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004: '8' }, 'oobc003Chk: 员工类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(员工类型) [${oobc003}] 在员工数据表(ooag_t)中不存在` };
        }
    } else if (oobc004 === '7'){
        // 部门类型控制组 v_ooeg001
        const sql_ooeg_count = `
            SELECT COUNT(*) AS cnt
            FROM ${schemaTo}.ooeg_t
            WHERE ooeg001 = '${oobc003}'
              AND ooegent = '${entTo}'
            `;
        logger.debug({ sql: sql_ooeg_count }, 'oobc003Chk: 查询部门类型控制组');
        const countResult = await externalDB.query(sql_ooeg_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004: '7' }, 'oobc003Chk: 部门类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(部门类型) [${oobc003}] 在部门数据表(ooeg_t)中不存在` };
        }
    } else{
        //  一般控制组 v_ooha001_5
        const sql_ooha_count = `
            SELECT COUNT(*) AS cnt
            FROM ${schemaTo}.ooha_t
            WHERE oohaent = '${entTo}'
              AND ooha001 = '${oobc003}'
              AND ooha002 = '${oobc004}'
            `;
        logger.debug({ sql: sql_ooha_count }, 'oobc003Chk: 查询一般类型控制组');
        const countResult = await externalDB.query(sql_ooha_count);
        const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
        if (count === 0) {
            logger.warn({ oobc003, oobc004 }, 'oobc003Chk: 一般类型控制组编号不存在');
            return { table: 'oobc_t', field: 'oobc003', label: '控制组编号', value: oobc003, message: `[oobc_t] 控制组编号(一般类型) [${oobc003}]（控制组类型 [${oobc004}]）在一般控制组表(ooha_t)中不存在` };
        }
    }
    logger.debug({ oobc003, oobc004 }, 'oobc003Chk: 校验通过');
    return null;
}

/** 
 * @param oobd003  生命周期类型
 * @param oobd004  生命周期编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobd004Chk(oobd003: string, oobd004: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobd003, oobd004, entTo, schemaTo }, 'oobd004Chk: 校验生命周期编号');
    // ACC 应用分类码
    const sql_oocq_oobd = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${oobd003}'
        AND oocq002 = '${oobd004}'
        `;
    logger.debug({ sql: sql_oocq_oobd }, 'oobd004Chk: 查询生命周期编号');
    const countResult = await externalDB.query(sql_oocq_oobd)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobd003, oobd004 }, 'oobd004Chk: 生命周期编号不存在');
        return { table: 'oobd_t', field: 'oobd004', label: '生命周期编号', value: oobd004, message: `[oobd_t] 生命周期编号 [${oobd004}]（生命周期类型 [${oobd003}]）在应用分类码表(oocq_t)中不存在` };
    }
    logger.debug({ oobd003, oobd004 }, 'oobd004Chk: 校验通过');
    return null;
}

/** 
 * @param oobh003  产品分类
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobh003Chk(oobh003: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ oobh003, entTo, schemaTo }, 'oobh003Chk: 校验产品分类');
    const sql_rtax_count = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.rtax_t
        WHERE rtaxent = '${entTo}'
        AND (rtax001 = '${oobh003}' OR '${oobh003}' =' ')
        `;
    logger.debug({ sql: sql_rtax_count }, 'oobh003Chk: 查询产品分类');
    const countResult = await externalDB.query(sql_rtax_count);
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobh003 }, 'oobh003Chk: 产品分类不存在');
        return { table: 'oobh_t', field: 'oobh003', label: '产品分类', value: oobh003, message: `[oobh_t] 产品分类 [${oobh003}] 在产品分类表(rtax_t)中不存在` };
    }
    logger.debug({ oobh003 }, 'oobh003Chk: 校验通过');
    return null;
}

/** 
 * @param ooba002  单据别编号
 * @param oobi003  单身理由码
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @returns     校验结果
*/
async function oobi003Chk(ooba002: string, oobi003: string, entTo: string, schemaTo: string): Promise<ValidateError | null> {
    logger.debug({ ooba002, oobi003, entTo, schemaTo }, 'oobi003Chk: 校验单身理由码');

    const sql_gzcb_acc = `
        SELECT gzcb004
        FROM ${schemaTo}.gzcb_t,${schemaTo}.oobx_t
        WHERE gzcb001 = 24
        AND gzcb002 = oobx003
        AND oobx001 = '${ooba002}'
        AND oobxent = '${entTo}'
        `;
    logger.debug({ sql: sql_gzcb_acc }, 'oobi003Chk: 查询单身理由码 ACC 类别');
    const accResult = await externalDB.query(sql_gzcb_acc);

    const rows = accResult.rows as Record<string, unknown>[];

    if (rows.length === 0) {
        logger.warn({ oobi003, ooba002 }, 'oobi003Chk: 单身理由码对应的应用分类码查询无结果');
        return { table: 'oobi_t', field: 'oobi003', label: '单身理由码', value: oobi003, message: `[oobi_t] 单身理由码 [${oobi003}] 对应的应用分类码(gzcb_t)查询无结果，无法确定 ACC 类别` };
    }

    const acc = rows[0]['gzcb004'];

    const sql_oocq_oobi = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '${acc}'
        AND oocq002 = '${oobi003}'
        `;
    logger.debug({ sql: sql_oocq_oobi }, 'oobi003Chk: 查询单身理由码是否存在');
    const countResult = await externalDB.query(sql_oocq_oobi)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ oobi003, acc }, 'oobi003Chk: 单身理由码在应用分类码表中不存在');
        return { table: 'oobi_t', field: 'oobi003', label: '单身理由码', value: oobi003, message: `[oobi_t] 单身理由码 [${oobi003}]（ACC [${acc}]）在应用分类码表(oocq_t)中不存在` };
    }
    logger.debug({ oobi003, acc }, 'oobi003Chk: 校验通过');
    return null;
}

/** 
 * @param oobj003  库存标签编号
 * @param entTo    集团代码
 * @param schemaTo 目标集团 schema
 * @param table    表名（默认 oobj_t）
 * @param field    字段名（默认 oobj003）
 * @param label    字段中文名（默认 库存标签编号F）
 * @returns     校验结果
*/
async function oobj003Chk(oobj003: string, entTo: string, schemaTo: string, table = 'oobj_t', field = 'oobj003', label = '库存标签编号F'): Promise<ValidateError | null> {
    logger.debug({ oobj003, entTo, schemaTo, table, field, label }, 'oobj003Chk: 校验库存标签编号');
    // ACC 应用分类码
    const sql_oocq_oobj = `
        SELECT COUNT(*) AS cnt FROM ${schemaTo}.oocq_t
        WHERE oocqent = '${entTo}'
        AND oocq001 = '220'
        AND oocq002 = '${oobj003}'
        `;
    logger.debug({ sql: sql_oocq_oobj }, 'oobj003Chk: 查询库存标签编号');
    const countResult = await externalDB.query(sql_oocq_oobj)
    const count = Number((countResult.rows as Record<string, unknown>[])[0]?.cnt ?? 0);
    if (count === 0) {
        logger.warn({ [field]: oobj003, table }, 'oobj003Chk: 库存标签编号不存在');
        return { table, field, label, value: oobj003, message: `[${table}] ${label} [${oobj003}] 在应用分类码表(oocq_t, ACC=220)中不存在` };
    }
    logger.debug({ [field]: oobj003 }, 'oobj003Chk: 校验通过');
    return null;
}


/**
 * 查询指定 ENT 可用的参照表编号列表（ooal_t, ooal001=3）
 * SELECT ooal002 FROM ${schema}.ooal_t WHERE ooal001 = 3 AND ooalent = ${ent} ORDER BY ooal002
 */
export async function queryOoba001List(schema: string, ent: number): Promise<string[]> {
    if (!externalDB.isConnected) {
        throw new Error('[genAooi200] 外部数据库未连接，无法查询参照表列表');
    }

    const sql = `SELECT ooal002 FROM ${schema}.ooal_t WHERE ooal001 = 3 AND ooalent = ${ent} ORDER BY ooal002`;
    logger.debug({ sql, schema, ent }, '[genAooi200] queryOoba001List: 查询可用参照表');
    const result = await externalDB.query(sql);
    const rows = result.rows as Record<string, unknown>[];
    const list = rows.map(row => String(row['ooal002'] ?? row['OOAL002'] ?? '')).filter(Boolean);
    logger.info({ schema, ent, count: list.length }, '[genAooi200] queryOoba001List: 查询完成');
    return list;
}