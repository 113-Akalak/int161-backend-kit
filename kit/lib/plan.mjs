// Builds the editable generator config from parsed SQL (+ optional parsed spec).
// The config is the single place to adjust paths, DTO fields, filters and validation before generating code.
import { camel, constant, kebab, pascal, plural, singular, snake, isPlural } from './naming.mjs'

const TIMESTAMP_COLUMNS = /^(created_at|updated_at|createdAt|updatedAt|created_date|updated_date)$/
const LABEL_COLUMNS = ['name', 'title', 'full_name', 'fullName', 'fullname', 'label']
const NON_NEGATIVE = /(price|qty|quantity|stock|cost|limit|salary|pages|amount|total|count|balance|credit|gb)/i
const POSITIVE = /^(amount|quantity_ordered|quantityOrdered)$/i

function aliasFor(name, used) {
    const words = snake(name).split('_').filter(Boolean)
    const candidates = [words.map(w => w[0]).join(''), name[0], name.slice(0, 2), name.slice(0, 3)]
    for (const c of candidates.map(x => x.toLowerCase())) {
        if (!used.has(c) && !/^(as|on|or|by|in|is|to|do|if)$/.test(c)) { used.add(c); return c }
    }
    let i = 2
    while (used.has(`${name[0]}${i}`)) i++
    used.add(`${name[0]}${i}`)
    return `${name[0]}${i}`
}

function labelColumn(table) {
    for (const want of LABEL_COLUMNS) {
        const col = table.columns.find(c => c.name === want)
        if (col) return col.name
    }
    return null
}

// spec path segment that refers to this table, if the spec mentions it
function specPathFor(table, spec) {
    if (!spec) return null
    const names = new Set([table.name, plural(table.name), kebab(table.name), plural(kebab(table.name)), kebab(singular(table.name)) + 's']
        .map(x => x.toLowerCase()))
    for (const ep of spec.endpoints) {
        for (const seg of ep.path.split('/').filter(s => s && !s.startsWith(':'))) {
            if (names.has(seg.toLowerCase())) return seg
        }
    }
    return null
}

function examplesFor(spec, path) {
    const out = { list: null, detail: null, create: null, deleteStatus: null, deleteMessage: null, listHasPagination: null, mentioned: false }
    if (!spec || !path) return out
    for (const ep of spec.endpoints) {
        const segs = ep.path.split('/').filter(Boolean)
        if (segs[0] !== path) continue
        out.mentioned = true
        const isItem = segs.length === 2 && segs[1].startsWith(':')
        const isList = segs.length === 1
        const data = ep.response?.data
        if (ep.method === 'GET' && isList && ep.response) {
            out.listHasPagination = 'pagination' in ep.response
            if (Array.isArray(data) && data[0]) out.list = data[0]
        }
        if (ep.method === 'GET' && isItem && data && !Array.isArray(data)) out.detail = data
        if (ep.method === 'POST' && isList && ep.request) out.create = ep.request
        if (ep.method === 'DELETE' && isItem) {
            if (ep.statuses.includes(200) && !ep.statuses.includes(204)) out.deleteStatus = 200
            if (ep.statuses.includes(204)) out.deleteStatus = 204
            if (ep.message) out.deleteMessage = ep.message
        }
    }
    // nested child routes like /customers/:id/payments carry the child's create example
    return out
}

function nestedCreateExample(spec, childPath) {
    if (!spec) return null
    for (const ep of spec.endpoints) {
        const segs = ep.path.split('/').filter(Boolean)
        if (ep.method === 'POST' && segs.length === 3 && segs[2] === childPath && ep.request) return ep.request
    }
    return null
}

// DTO key -> source column (or join alias)
function resolveKey(key, table, joins) {
    if (table.columns.some(c => c.name === key)) return key
    const byCamel = table.columns.find(c => camel(c.name) === key)
    if (byCamel) return byCamel.name
    for (const j of joins) {
        if (key === j.as || key === camel(j.as)) return j.as
    }
    return null
}

function dtoFromExample(example, table, joins, warnings, label) {
    const dto = {}
    for (const key of Object.keys(example)) {
        const source = resolveKey(key, table, joins)
        if (!source) warnings.push(`${table.name}: ${label} field "${key}" does not match a column; mapped to entity.${snake(key)} — check it`)
        dto[key] = source || snake(key)
    }
    return dto
}

export function buildConfig(sqlMeta, spec = null, options = {}) {
    const warnings = []
    const tables = sqlMeta.tables
    const byName = Object.fromEntries(tables.map(t => [t.name, t]))
    const resources = []

    for (const table of tables) {
        const pk = table.primaryKey.length ? table.primaryKey : (table.columns[0] ? [table.columns[0].name] : [])
        if (!table.primaryKey.length) warnings.push(`${table.name}: no PRIMARY KEY found, using "${pk[0]}"`)
        const pkCols = pk.map(n => table.columns.find(c => c.name === n))
        const autoIncrement = pk.length === 1 && Boolean(pkCols[0]?.autoIncrement)
        const specPath = specPathFor(table, spec)
        const path = specPath || (isPlural(table.name) ? kebab(table.name) : plural(kebab(table.name)))
        const base = singular(table.name)
        const localAliases = new Set()
        const alias = aliasFor(table.name, localAliases)
        const ex = examplesFor(spec, specPath)
        const hasParent = table.foreignKeys.some(fk => fk.table !== table.name && byName[fk.table])

        // LEFT JOIN each parent so detail/list can show e.g. brandName
        const joins = []
        for (const fk of table.foreignKeys) {
            const parent = byName[fk.table]
            if (!parent || parent === table || fk.columns.length !== 1) continue
            const labelCol = labelColumn(parent)
            if (!labelCol) continue
            const as = `${snake(singular(parent.name))}_${snake(labelCol)}`
            if (joins.some(j => j.as === as)) continue
            joins.push({ table: parent.name, alias: aliasFor(parent.name, localAliases), column: fk.columns[0], references: fk.refColumns[0], select: labelCol, as })
        }

        const columns = Object.fromEntries(table.columns.map(c => [c.name, c.category]))
        const visible = table.columns.filter(c => !TIMESTAMP_COLUMNS.test(c.name) || !hasParent)
        const camelStyle = hasParent || (ex.list && Object.keys(ex.list).some(k => k !== snake(k)))

        let summary, detail
        if (ex.list) summary = dtoFromExample(ex.list, table, joins, warnings, 'summary')
        if (ex.detail) detail = dtoFromExample(ex.detail, table, joins, warnings, 'detail')
        if (!summary) {
            let pick = camelStyle
                ? visible.filter(c => pk.includes(c.name) || table.uniques.some(u => u.includes(c.name)) || c.name === labelColumn(table)
                    || /(name|title)$/i.test(c.name) || table.foreignKeys.some(fk => fk.columns.includes(c.name))
                    || c.enumValues || c.hintValues || c.category === 'decimal' || /^(status|category|type)$/i.test(c.name))
                : table.columns
            if (pick.length < 3) pick = visible
            summary = Object.fromEntries(pick.map(c => [camelStyle ? camel(c.name) : c.name, c.name]))
        }
        if (!detail) {
            detail = {}
            for (const c of (camelStyle ? visible : table.columns)) {
                detail[camelStyle ? camel(c.name) : c.name] = c.name
                const join = joins.find(j => j.column === c.name)
                if (join && camelStyle) detail[camel(join.as)] = join.as
            }
        }
        // only keep joins that some DTO actually shows
        const usedSources = new Set([...Object.values(summary), ...Object.values(detail)])
        const activeJoins = joins.filter(j => usedSources.has(j.as))

        // booleans: follow the spec example (true/false vs 1/0), default keep DB value
        const booleans = table.columns.filter(c => c.category === 'boolean').map(c => c.name)
        let booleanAs = 'number'
        for (const sample of [ex.list, ex.detail]) {
            if (!sample) continue
            for (const [key, value] of Object.entries(sample)) {
                const src = resolveKey(key, table, joins)
                if (booleans.includes(src) && typeof value === 'boolean') booleanAs = 'boolean'
            }
        }

        const filters = []
        const addFilter = (params, sql, extra = {}) => filters.push({ params: [...new Set(params)], sql, ...extra })
        for (const c of table.columns) {
            if (pk.includes(c.name) && autoIncrement) continue
            const isFk = table.foreignKeys.some(fk => fk.columns.includes(c.name))
            const isTimestamp = TIMESTAMP_COLUMNS.test(c.name)
            if (isFk || c.enumValues || c.hintValues || c.category === 'boolean' || /^(status|category|type|genre|country)$/i.test(c.name)) {
                addFilter([camel(c.name), c.name], `${alias}.${c.name} = ?`)
            } else if ((c.category === 'decimal' || c.category === 'integer') && !pk.includes(c.name)) {
                if (c.category === 'integer') addFilter([camel(c.name), c.name], `${alias}.${c.name} = ?`)
                if (c.category === 'decimal' || /(price|amount|cost|quantity|stock|pages|year|limit|salary)/i.test(c.name)) {
                    addFilter([`min${pascal(c.name)}`, `min_${snake(c.name)}`], `${alias}.${c.name} >= ?`)
                    addFilter([`max${pascal(c.name)}`, `max_${snake(c.name)}`], `${alias}.${c.name} <= ?`)
                }
            } else if (c.category === 'date' && !isTimestamp) {
                addFilter([`${camel(c.name)}From`, `${snake(c.name)}_from`], `${alias}.${c.name} >= ?`)
                addFilter([`${camel(c.name)}To`, `${snake(c.name)}_to`], `${alias}.${c.name} <= ?`)
            }
        }
        const searchable = table.columns.filter(c => c.category === 'string' && (
            c.name === labelColumn(table) || /(name|title|sku|isbn|email)$/i.test(c.name) || table.uniques.some(u => u.includes(c.name))))
        if (searchable.length) {
            addFilter(['search', 'q', 'keyword'], `(${searchable.map(c => `${alias}.${c.name} LIKE ?`).join(' OR ')})`, { like: true })
        }

        const writable = table.columns.filter(c => !(autoIncrement && pk.includes(c.name)) && !(TIMESTAMP_COLUMNS.test(c.name) && c.hasDefault))
        const required = writable.filter(c => !c.nullable && !c.hasDefault && !c.autoIncrement).map(c => c.name)
        const numberCols = writable.filter(c => c.category === 'integer' || c.category === 'decimal').map(c => c.name)
        const enums = Object.fromEntries(writable.filter(c => c.enumValues).map(c => [c.name, c.enumValues]))
        const hints = Object.fromEntries(writable.filter(c => c.hintValues).map(c => [c.name, c.hintValues]))

        resources.push({
            table: table.name,
            path,
            entity: pascal(base),
            file: kebab(base),
            alias,
            primaryKey: pk,
            autoIncrement,
            notFoundCode: `${constant(base)}_NOT_FOUND`,
            listPagination: ex.listHasPagination === true ? 'always' : ex.listHasPagination === false ? 'optional' : (hasParent ? 'always' : 'optional'),
            booleanAs,
            columns,
            summary,
            detail,
            joins: activeJoins,
            filters,
            sortable: table.columns.map(c => c.name),
            defaultSort: pk[0],
            writable: writable.map(c => c.name),
            unique: table.uniques.filter(u => u.length === 1).map(u => u[0]),
            foreignKeys: table.foreignKeys.filter(fk => fk.columns.length === 1 && byName[fk.table])
                .map(fk => ({ column: fk.columns[0], table: fk.table, references: fk.refColumns[0], onDelete: fk.onDelete })),
            validation: {
                code: 'VALIDATION_ERROR',
                strictNumbers: false,
                required,
                numbers: numberCols,
                nonNegative: numberCols.filter(n => NON_NEGATIVE.test(n) && !POSITIVE.test(n) && !table.foreignKeys.some(fk => fk.columns.includes(n))),
                positive: numberCols.filter(n => POSITIVE.test(n)),
                dates: writable.filter(c => c.category === 'date').map(c => c.name),
                emails: writable.filter(c => /email/i.test(c.name) && c.category === 'string').map(c => c.name),
                emailCode: 'INVALID_EMAIL',
                oneOf: enums,
                maxLength: Object.fromEntries(writable.filter(c => c.length).map(c => [c.name, c.length]))
            },
            valueHints: hints,
            delete: {
                status: ex.deleteStatus || 204,
                message: ex.deleteMessage || `${pascal(base)} record successfully deleted`
            },
            createExample: ex.create || null,
            mentionedInSpec: ex.mentioned
        })
    }

    // children: who references me (skip self references)
    for (const r of resources) {
        r.children = resources
            .filter(c => c !== r)
            .flatMap(c => c.foreignKeys.filter(fk => fk.table === r.table).map(fk => ({
                table: c.table, path: c.path, file: c.file, entity: c.entity, column: fk.column, onDelete: fk.onDelete
            })))
            .filter((c, i, all) => all.findIndex(x => x.table === c.table) === i)
        for (const child of r.children) {
            const cr = resources.find(x => x.table === child.table)
            if (!cr.createExample) cr.createExample = nestedCreateExample(spec, child.path)
        }
    }

    if (spec && spec.endpoints.length) {
        for (const ep of spec.endpoints) {
            const seg = ep.path.split('/').filter(Boolean)[0]
            if (!resources.some(r => r.path === seg)) warnings.push(`spec endpoint ${ep.method} ${ep.path} does not match any table — rename "path" in the config`)
        }
    }

    return {
        $readme: 'Edit then run: node kit/gen.mjs build <project>. Keys: path = URL segment, summary/detail = DTO key -> column, filters = ?query -> SQL.',
        studentId: options.studentId || spec?.studentId || '67130599999',
        studentName: options.studentName || spec?.studentName || 'Firstname Lastname',
        secretKey: options.secretKey || spec?.secretKey || 'SECRET',
        database: sqlMeta.database || spec?.database || 'exam_db',
        db: { host: 'localhost', port: 3306, user: 'root', password: options.password ?? 'mysql@sit' },
        port: 3000,
        resources,
        warnings
    }
}
