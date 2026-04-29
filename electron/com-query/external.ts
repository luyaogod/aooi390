import { externalDB } from '../db/clients';

/**
 * 查询企业编号以及对应的数据库schema
 * @returns [{'8888': 'dsdemo'}, {'9999': 'dsdata'}]
*/
export async function queryEnt(): Promise<Record<string, string>[]>{
    const sql = 'SELECT gzou001, gzou003 FROM gzou_t'
    const result = await externalDB.query(sql);
    return result.rows as Record<string, string>[];
}

/**
 * 查询指定集团的可用据点列表
 * @param schema 数据库 schema
 * @param ent    集团编号
 * @returns ['ZB01', 'ZB02', ...]
*/
export async function querySites(schema: string, ent: string): Promise<string[]> {
    const sql = `SELECT ooef001 FROM ${schema}.ooef_t WHERE ooef201 = 'Y' AND ooefent = '${ent}'`
    const result = await externalDB.query(sql);
    return (result.rows as Record<string, unknown>[]).map(row => String(row.ooef001));
}

/**
 * 查询指定系统分类码（SCC）可选项
 * @param scc
 * @returns 以scc=14 单据期别编码 为例 [{'1', 'YYMM'}, {'2', 'YYPP'}...]
*/ 
export async function queryScc(scc: string) {
    const sql = `SELECT DISTINCT gzcb002, gzcbl004 FROM gzcb_t LEFT OUTER JOIN gzcbl_t ON gzcb001 = gzcbl001 AND gzcb002 = gzcbl002 AND gzcbl003 = 'zh_CN' WHERE gzcb001 = ${scc} ORDER BY gzcb002`
    const result = await externalDB.query(sql);
    return result.rows as Record<string, string>[];
}