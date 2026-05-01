import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import { externalDB, appDB } from '../db/clients';
import logger from '../utils/logger';
import { dbConnectionManager } from '../config/db-connections';
import { Oobx } from '@prisma/client';

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
    private async query(sql: string): Promise<Record<string, unknown>[]> {
        if (this.mode === 'external') {
            const result = await externalDB.query(sql);
            return result.rows as Record<string, unknown>[];
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (appDB.getPrisma() as any).$queryRawUnsafe(sql) as Promise<Record<string, unknown>[]>;
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
              AND gzzz001 = '${gzzz001}'
            ORDER BY gzzz001, gzzal003
        `;
        logger.debug({ sql }, '[Aooi200Query] gzzz006Get: 查询 SQL');
        const rows = await this.query(sql);
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
            WHERE gzzz001 = '${gzzz001}'
        `;
        logger.debug({ sql }, '[Aooi200Query] gzzzInfoGet: 查询 SQL');
        const rows = await this.query(sql);
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
              AND gzzz001 = '${gzzz001}'
        `;
        logger.debug({ sql }, '[Aooi200Query] gzzz001Chk: 查询 SQL');
        const rows = await this.query(sql);
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
    const prisma = appDB.getPrisma();
    const results: { table: string; count: number }[] = [];
    const tablesData: Record<string, Record<string, unknown>[]> = {};

    for (const table of allTables) {
        const modelName = tableModelMap[table];
        const clientName = toClientName(modelName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await (prisma as any)[clientName].findMany();
        tablesData[table] = rows as Record<string, unknown>[];
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

    const prisma = appDB.getPrisma();
    const results: { table: string; count: number }[] = [];

    for (const table of allTables) {
        const modelName = tableModelMap[table];
        const clientName = toClientName(modelName);
        const rows = data.tables[table];

        if (!rows || !Array.isArray(rows)) {
            logger.warn('[genAooi200] 配置文件中未找到表 %s 的数据，跳过', table);
            results.push({ table, count: 0 });
            continue;
        }

        // 获取字段映射以进行类型转换
        const fieldMap = getModelFieldMap(modelName);

        const convertedRows = rows.map(row => convertRow(row, fieldMap));

        await prisma.$transaction(async (tx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txn = tx as any;
            await txn[clientName].deleteMany();
            await txn[clientName].createMany({ data: convertedRows });
        });

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
 *   DELETE FROM ${schema}.oobl_t WHERE oobxent = ${ent} AND oobl001 IN (${oobx001_list})
 *   INSERT INTO ${schema}.oobl_t (oobxl001, oobxl002, oobxl003)
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

    // 在事务中执行 DELETE + INSERT，报错时自动回滚
    return externalTransaction(async (exec) => {
        const deleteSql = `DELETE FROM ${schema}.oobl_t WHERE oobxent = ${ent} AND oobl001 IN (${inClause})`;
        logger.debug({ deleteSql, schema, ent, oobx001Count: oobx001List.length }, '[genAooi200] replaceOoblWfData: 删除旧数据');
        await exec(deleteSql);

        let insertedCount = 0;
        for (const row of rows) {
            const oobx004 = row.oobx004 ?? '';
            const oobx004Clean = oobx004.replace(/_wf$/, '');

            for (const val of [oobx004, oobx004Clean]) {
                const insertSql = `INSERT INTO ${schema}.oobl_t (oobxl001, oobxl002, oobxl003) VALUES ('${esc(String(ent))}', '${esc(row.oobx001)}', '${esc(val)}')`;
                await exec(insertSql);
                insertedCount++;
            }
        }

        logger.info({ schema, ent, deleted: oobx001List.length, inserted: insertedCount },
            '[genAooi200] replaceOoblWfData: 处理完成');
        return insertedCount;
    });
}