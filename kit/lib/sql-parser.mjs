// Parses a MySQL init script (CREATE DATABASE / CREATE TABLE / ALTER TABLE ... FOREIGN KEY) into plain table metadata.
// It only needs to understand DDL that appears in course exam scripts, not the full MySQL grammar.

const unquote = s => s.trim().replace(/^[`"']|[`"']$/g, '')
const listOf = s => s.split(',').map(unquote).filter(Boolean)

// Split on commas that are not inside parentheses or quotes
function splitTopLevel(text) {
    const parts = []
    let depth = 0
    let quote = null
    let current = ''
    for (const ch of text) {
        if (quote) {
            if (ch === quote) quote = null
        } else if (ch === "'" || ch === '"' || ch === '`') {
            quote = ch
        } else if (ch === '(') {
            depth++
        } else if (ch === ')') {
            depth--
        } else if (ch === ',' && depth === 0) {
            parts.push(current)
            current = ''
            continue
        }
        current += ch
    }
    if (current.trim()) parts.push(current)
    return parts.map(p => p.trim()).filter(Boolean)
}

// Remove "-- comment" and "# comment" tails, keeping what they said per column name
function stripComments(body) {
    const comments = {}
    const lines = body.split(/\r?\n/).map(line => {
        const m = line.match(/^(.*?)(?:--\s|#)(.*)$/)
        if (!m || (m[1].split("'").length - 1) % 2 === 1) return line
        const col = m[1].match(/^\s*[`"]?(\w+)[`"]?\s+[a-zA-Z]/)
        if (col) comments[col[1]] = m[2].trim()
        return m[1]
    })
    return { code: lines.join('\n').replace(/\/\*[\s\S]*?\*\//g, ''), comments }
}

function typeCategory(base, args) {
    const t = base.toLowerCase()
    if (t === 'boolean' || t === 'bool' || (t === 'tinyint' && args === '1') || t === 'bit') return 'boolean'
    if (/^(tinyint|smallint|mediumint|int|integer|bigint|year)$/.test(t)) return 'integer'
    if (/^(decimal|numeric|float|double|real)$/.test(t)) return 'decimal'
    if (t === 'date') return 'date'
    if (/^(datetime|timestamp)$/.test(t)) return 'datetime'
    if (t === 'time') return 'time'
    if (t === 'enum' || t === 'set') return 'enum'
    if (t === 'json') return 'json'
    return 'string'
}

function parseColumn(def, comment) {
    const m = def.match(/^[`"]?(\w+)[`"]?\s+(\w+)(?:\s*\(([^)]*)\))?(.*)$/s)
    if (!m) return null
    const [, name, base, args = '', rest] = m
    const tail = rest.replace(/\s+/g, ' ')
    const upper = tail.toUpperCase()
    const category = typeCategory(base, args.trim())
    const col = {
        name,
        type: base.toUpperCase() + (args ? `(${args.replace(/\s+/g, '')})` : ''),
        category,
        length: /char/i.test(base) && args ? Number(args) : null,
        nullable: !/\bNOT NULL\b/.test(upper) && !/\bPRIMARY KEY\b/.test(upper),
        hasDefault: /\bDEFAULT\b/.test(upper),
        autoIncrement: /\bAUTO_INCREMENT\b/.test(upper),
        primary: /\bPRIMARY KEY\b/.test(upper),
        unique: /\bUNIQUE\b/.test(upper),
        enumValues: null,
        comment: comment || null
    }
    if (category === 'enum') {
        col.enumValues = [...args.matchAll(/'((?:[^']|'')*)'/g)].map(x => x[1])
    } else if (comment && /^[A-Z0-9_]+(\s*,\s*[A-Z0-9_]+)+\s*$/.test(comment)) {
        col.hintValues = listOf(comment)
    }
    const ref = tail.match(/\bREFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)(.*)$/i)
    if (ref) col.inlineRef = { table: ref[1], columns: listOf(ref[2]), onDelete: onDelete(ref[3]) }
    const check = tail.match(/\bCHECK\s*\((.*)\)/i)
    if (check) col.check = check[1]
    return col
}

function onDelete(text = '') {
    const m = text.match(/ON DELETE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT)/i)
    return m ? m[1].toUpperCase() : 'RESTRICT'
}

function parseCreateTable(name, body) {
    const { code, comments } = stripComments(body)
    const table = { name, columns: [], primaryKey: [], uniques: [], foreignKeys: [], checks: [] }
    for (const part of splitTopLevel(code)) {
        const upper = part.toUpperCase()
        let m
        if ((m = part.match(/^(?:CONSTRAINT\s+[`"]?\w+[`"]?\s+)?PRIMARY KEY\s*\(([^)]+)\)/i))) {
            table.primaryKey = listOf(m[1])
        } else if ((m = part.match(/^(?:CONSTRAINT\s+[`"]?\w+[`"]?\s+)?UNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+[`"]?\w+[`"]?)?\s*\(([^)]+)\)/i))) {
            table.uniques.push(listOf(m[1]))
        } else if ((m = part.match(/^(?:CONSTRAINT\s+[`"]?(\w+)[`"]?\s+)?FOREIGN KEY\s*(?:[`"]?\w+[`"]?\s*)?\(([^)]+)\)\s*REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)(.*)$/is))) {
            table.foreignKeys.push({ name: m[1] || null, columns: listOf(m[2]), table: m[3], refColumns: listOf(m[4]), onDelete: onDelete(m[5]) })
        } else if (/^(?:CONSTRAINT\s+[`"]?\w+[`"]?\s+)?CHECK\b/i.test(part)) {
            table.checks.push(part)
        } else if (/^(KEY|INDEX|FULLTEXT|SPATIAL)\b/.test(upper)) {
            // plain index: nothing to generate
        } else {
            const col = parseColumn(part, comments[unquote(part.split(/\s+/)[0])])
            if (col) table.columns.push(col)
        }
    }
    for (const col of table.columns) {
        if (col.primary && !table.primaryKey.includes(col.name)) table.primaryKey.push(col.name)
        if (col.unique) table.uniques.push([col.name])
        if (col.inlineRef) {
            table.foreignKeys.push({ name: null, columns: [col.name], table: col.inlineRef.table, refColumns: col.inlineRef.columns, onDelete: col.inlineRef.onDelete })
        }
    }
    return table
}

// Blank out comments (same length) so regexes never match inside them, while offsets still point into the raw script
function maskComments(sql) {
    let out = ''
    let quote = null
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i]
        if (quote) {
            if (ch === quote) quote = null
            out += ch
        } else if (ch === "'" || ch === '"' || ch === '`') {
            quote = ch
            out += ch
        } else if ((ch === '-' && sql[i + 1] === '-') || ch === '#') {
            while (i < sql.length && sql[i] !== '\n') { out += ' '; i++ }
            if (i < sql.length) out += '\n'
        } else if (ch === '/' && sql[i + 1] === '*') {
            const end = sql.indexOf('*/', i + 2)
            const stop = end === -1 ? sql.length : end + 2
            out += sql.slice(i, stop).replace(/[^\n]/g, ' ')
            i = stop - 1
        } else {
            out += ch
        }
    }
    return out
}

// Find "CREATE TABLE name (" ... matching ")" while respecting quotes
function extractCreateTables(sql) {
    const masked = maskComments(sql)
    const found = []
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"]?\w+[`"]?\.)?[`"]?(\w+)[`"]?\s*\(/gi
    let m
    while ((m = re.exec(masked))) {
        let depth = 1
        let quote = null
        let i = re.lastIndex
        for (; i < masked.length && depth > 0; i++) {
            const ch = masked[i]
            if (quote) { if (ch === quote) quote = null; continue }
            if (ch === "'" || ch === '"' || ch === '`') quote = ch
            else if (ch === '(') depth++
            else if (ch === ')') depth--
        }
        found.push({ name: m[1], body: sql.slice(re.lastIndex, i - 1) })
        re.lastIndex = i
    }
    return found
}

export function parseSql(raw) {
    const sql = maskComments(raw)
    const db = sql.match(/CREATE\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i)
        || sql.match(/^\s*USE\s+[`"]?(\w+)[`"]?\s*;/im)
    const tables = extractCreateTables(raw).map(t => parseCreateTable(t.name, t.body))
    const byName = Object.fromEntries(tables.map(t => [t.name.toLowerCase(), t]))

    // ALTER TABLE x ADD [CONSTRAINT n] FOREIGN KEY (a) REFERENCES p (b)
    const alterRe = /ALTER\s+TABLE\s+[`"]?(\w+)[`"]?([\s\S]*?);/gi
    let m
    while ((m = alterRe.exec(sql))) {
        const table = byName[m[1].toLowerCase()]
        if (!table) continue
        for (const fk of m[2].matchAll(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)([^,]*)/gi)) {
            table.foreignKeys.push({ name: null, columns: listOf(fk[1]), table: fk[2], refColumns: listOf(fk[3]), onDelete: onDelete(fk[4]) })
        }
        const pk = m[2].match(/ADD\s+PRIMARY KEY\s*\(([^)]+)\)/i)
        if (pk) table.primaryKey = listOf(pk[1])
        for (const uq of m[2].matchAll(/ADD\s+(?:CONSTRAINT\s+\w+\s+)?UNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+\w+)?\s*\(([^)]+)\)/gi)) {
            table.uniques.push(listOf(uq[1]))
        }
    }
    for (const table of tables) {
        for (const fk of table.foreignKeys) {
            const parent = byName[fk.table.toLowerCase()]
            if (parent) fk.table = parent.name
        }
        const seen = new Set()
        table.uniques = table.uniques.filter(u => {
            const key = u.join(',')
            if (seen.has(key) || key === table.primaryKey.join(',')) return false
            seen.add(key)
            return true
        })
    }
    return { database: db ? db[1] : null, tables }
}
