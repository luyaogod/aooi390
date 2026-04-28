import { externalDB } from '../db/clients';

/**
 * 查询企业编号以及对应的数据库schema
 * @returns [{'8888': 'dsdemo'}, {'9999': 'dsdata'}]
*/
export async function queryEnt(): Promise<Record<string, string>[]>{
    const result = await externalDB.query('SELECT gzou001, gzou003 FROM gzou_t');
    return result.rows as Record<string, string>[];
}

/**
 * 查询指定集团的可用据点列表
 * @param schema 数据库 schema
 * @param ent    集团编号
 * @returns ['ZB01', 'ZB02', ...]
*/
export async function querySites(schema: string, ent: string): Promise<string[]> {
    const result = await externalDB.query(`SELECT ooef001 FROM ${schema}.ooef_t WHERE ooef201 = 'Y' AND ooefent = '${ent}'`);
    return (result.rows as Record<string, unknown>[]).map(row => String(row.ooef001));
}
