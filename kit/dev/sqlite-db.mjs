// mysql2/promise-compatible stand-in backed by node:sqlite, for verifying the template without a MySQL server
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const sqlFile = process.env.INIT_SQL
const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON')

function toSqlite(mysqlScript) {
    return mysqlScript
        .replace(/--.*$/gm, '')
        .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
        .replace(/USE\s+\w+\s*;/gi, '')
        .replace(/\)\s*ENGINE=[^;]*;/gi, ');')
        .replace(/BIGINT AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/INT AUTO_INCREMENT PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
        .replace(/ENUM\([^)]*\)/gi, 'TEXT')
        .replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '')
}
db.exec(toSqlite(readFileSync(sqlFile, 'utf8')))

function expand(sql, params = []) {
    let i = 0
    const out = []
    const sqlOut = sql.replace(/\?/g, () => {
        const p = params[i++]
        if (p && typeof p === 'object' && !Array.isArray(p)) {
            const cols = Object.keys(p)
            out.push(...cols.map(k => p[k]))
            return cols.map(k => `${k} = ?`).join(', ')
        }
        out.push(p)
        return '?'
    })
    // INSERT INTO t SET a = ?, b = ?  ->  INSERT INTO t (a, b) VALUES (?, ?)
    const m = sqlOut.match(/^\s*INSERT INTO (\w+) SET (.*)$/is)
    if (m) {
        const cols = m[2].split(',').map(s => s.split('=')[0].trim())
        return [`INSERT INTO ${m[1]} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, out]
    }
    return [sqlOut, out]
}

function norm(v) {
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v === undefined) return null
    return v
}

function mapError(e, sql) {
    const msg = String(e.message)
    const err = new Error(msg)
    if (/UNIQUE constraint failed/i.test(msg)) err.code = 'ER_DUP_ENTRY'
    else if (/FOREIGN KEY constraint failed/i.test(msg)) err.code = /^\s*DELETE/i.test(sql) ? 'ER_ROW_IS_REFERENCED_2' : 'ER_NO_REFERENCED_ROW_2'
    else if (/NOT NULL constraint failed/i.test(msg)) err.code = 'ER_BAD_NULL_ERROR'
    err.sqlMessage = msg
    return err
}

const pool = {
    async query(sql, params = []) {
        const [s, p] = expand(sql, params)
        try {
            const stmt = db.prepare(s)
            if (/^\s*(SELECT|WITH)/i.test(s)) {
                return [stmt.all(...p.map(norm)).map(r => ({ ...r }))]
            }
            const info = stmt.run(...p.map(norm))
            return [{ insertId: Number(info.lastInsertRowid), affectedRows: Number(info.changes) }]
        } catch (e) {
            throw mapError(e, s)
        }
    },
    async execute(sql, params) { return this.query(sql, params) }
}

export default pool
