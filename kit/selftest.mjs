#!/usr/bin/env node
// Self-test for any project generated (or hand-written) from a kit config.
// It derives every check from the config: envelope, pagination, DTO keys, 404/400/409, CRUD, filters, sort, nested routes.
//
//   node kit/selftest.mjs <project> [--config file] [--base http://localhost:3000] [--keep]
//
// Run it while the server is running (npm start). It creates test rows and deletes them again (--keep leaves them).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { camel } from './lib/naming.mjs'
import { projectName } from './lib/project.mjs'

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const argv = process.argv.slice(2)
const opt = name => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1] }
const projectArg = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
const configPath = resolve(opt('config') || join(KIT, 'work', `${projectName(resolve(projectArg || '.'))}.config.json`))
if (!existsSync(configPath)) {
    console.error(`Config not found: ${configPath}\nRun first: node kit/gen.mjs init <project>   (or pass --config)`)
    process.exit(1)
}
const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
const ORIGIN = (opt('base') || process.env.BASE_URL || `http://localhost:${cfg.port || 3000}`).replace(/\/$/, '')
const API = `${ORIGIN}/api/${cfg.studentId}`
const KEEP = argv.includes('--keep')
const uniq = Date.now().toString(36).toUpperCase().slice(-6)

const c = {
    red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`,
    cyan: s => `\x1b[36m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`
}

async function call(method, path, body, raw = null) {
    const res = await fetch(API + path, {
        method,
        headers: body !== undefined || raw ? { 'Content-Type': 'application/json' } : {},
        body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined)
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return { status: res.status, json, text }
}

class Fail extends Error {}
class Skip extends Error {}
const expect = (cond, msg) => { if (!cond) throw new Fail(msg) }
const skip = msg => { throw new Skip(msg) }
const expectStatus = (r, want, label = '') => {
    const list = [].concat(want)
    expect(list.includes(r.status), `${label}expected ${list.join('/')} got ${r.status}${r.json?.error?.message ? ` (${r.json.error.message})` : r.text && !r.json ? ` (${r.text.slice(0, 80).replace(/\s+/g, ' ')})` : ''}`)
}
const expectError = (r, status, code, label = '') => {
    expectStatus(r, status, label)
    expect(r.json && r.json.success === false, `${label}error body must be JSON with success:false`)
    if (code && r.json?.error?.code !== code) warnings.push(`${label}error.code is "${r.json?.error?.code}" (config expects "${code}")`)
}

const results = []
const warnings = []
let group = ''
async function check(name, fn) {
    try {
        await fn()
        results.push({ group, name, ok: true })
        console.log(`  ${c.green('PASS')} ${name}`)
    } catch (e) {
        if (e instanceof Skip) {
            results.push({ group, name, ok: null, reason: e.message })
            console.log(`  ${c.dim('SKIP')} ${name} ${c.dim('— ' + e.message)}`)
            return
        }
        const reason = e instanceof Fail ? e.message : `${e.name}: ${e.message}`
        results.push({ group, name, ok: false, reason })
        console.log(`  ${c.red('FAIL')} ${name}\n       ${c.red('└ ' + reason)}`)
    }
}

// ---------- helpers driven by the config
const R = Object.fromEntries(cfg.resources.map(r => [r.table, r]))
const keyOf = (dto, column) => Object.entries(dto).find(([, src]) => src === column)?.[0]
const pkPath = (r, row) => '/' + r.primaryKey.map(col => encodeURIComponent(row[col])).join('/')
// read a row's column values back from a DTO object
function columnsFromDto(r, dto) {
    const row = {}
    for (const [k, src] of Object.entries({ ...r.summary, ...r.detail })) if (dto && k in dto) row[src] = dto[k]
    return row
}
const firstRows = {}

function sampleValue(r, col, salt) {
    const category = r.columns[col]
    const length = r.validation.maxLength?.[col] || 50
    const hint = r.validation.oneOf?.[col]?.[0] || r.valueHints?.[col]?.[0]
    if (hint) return hint
    if (r.validation.emails?.includes(col)) return `t${salt}@example.com`.toLowerCase()
    switch (category) {
        case 'integer': return r.validation.positive?.includes(col) ? 5 : 5
        case 'decimal': return 123.45
        case 'boolean': return 1
        case 'date': return '2026-01-01'
        case 'datetime': return '2026-01-01 10:00:00'
        case 'time': return '10:00:00'
        case 'json': return '{}'
        default: {
            const text = `T${salt}${col}`.replace(/[^A-Za-z0-9]/g, '')
            return text.slice(0, Math.max(1, length))
        }
    }
}

function uniqueValue(r, col, salt) {
    const category = r.columns[col]
    if (category === 'integer') return 900000 + Math.floor(Math.random() * 99999)
    const length = r.validation.maxLength?.[col] || 50
    const v = `T${salt}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
    return v.slice(-Math.min(length, v.length))
}

function buildBody(r, salt) {
    const body = {}
    const example = r.createExample || {}
    for (const [k, v] of Object.entries(example)) {
        const col = r.writable.includes(k) || r.primaryKey.includes(k) ? k : Object.keys(r.columns).find(cn => camel(cn) === k)
        if (col) body[col] = v
    }
    for (const col of [...r.writable, ...(r.autoIncrement ? [] : r.primaryKey)]) {
        if (!(col in body)) body[col] = sampleValue(r, col, salt)
    }
    for (const col of r.unique) body[col] = uniqueValue(r, col, salt)
    if (!r.autoIncrement) for (const col of r.primaryKey) {
        if (!r.foreignKeys.some(fk => fk.column === col)) body[col] = uniqueValue(r, col, salt)
    }
    for (const fk of r.foreignKeys) {
        const parentRow = firstRows[fk.table]
        if (parentRow && parentRow[fk.references] !== undefined) body[fk.column] = parentRow[fk.references]
        else if (fk.table === r.table) body[fk.column] = null
    }
    return body
}

// ---------- start
console.log(c.bold(`\nINT161 kit selftest — ${API}`))
console.log(c.dim(`config: ${configPath}`))
try {
    await fetch(ORIGIN)
} catch {
    console.error(c.red(`\nCannot connect to ${ORIGIN}. Start the server first: npm start`))
    process.exit(1)
}

group = 'General'
console.log(c.bold('\n[General]'))
await check('GET /student-info returns studentId, name, secretKey', async () => {
    const r = await call('GET', '/student-info')
    expectStatus(r, 200)
    expect(r.json?.success === true && r.json.timestamp, 'needs success:true and timestamp')
    const d = r.json.data || {}
    expect(d.studentId === cfg.studentId, `data.studentId must be "${cfg.studentId}" got "${d.studentId}"`)
    expect(d.name === cfg.studentName, `data.name must be "${cfg.studentName}" got "${d.name}"`)
    expect(d.secretKey === cfg.secretKey, `data.secretKey must be "${cfg.secretKey}" got "${d.secretKey}"`)
})
await check('Unknown route -> 404 JSON with success:false', async () => {
    expectError(await call('GET', `/no-such-route-${uniq}`), 404)
})
await check('Broken JSON body -> 400 JSON (not an HTML page)', async () => {
    const target = cfg.resources.find(r => r.mentionedInSpec) || cfg.resources[0]
    expectError(await call('POST', `/${target.path}`, undefined, '{"bad json'), 400)
})

// parents first so children can reference them
const ordered = [...cfg.resources].sort((a, b) => a.foreignKeys.filter(f => f.table !== a.table).length - b.foreignKeys.filter(f => f.table !== b.table).length)
const created = []

for (const r of ordered) {
    group = r.path
    console.log(c.bold(`\n[/${r.path}]`) + c.dim(` table ${r.table}`))
    let list = null

    await check(`GET /${r.path} -> 200 with data array`, async () => {
        const res = await call('GET', `/${r.path}`)
        expectStatus(res, 200)
        expect(res.json?.success === true && typeof res.json.timestamp === 'string', 'needs success:true and timestamp')
        expect(Array.isArray(res.json.data), 'data must be an array')
        if (r.listPagination === 'always') {
            expect(res.json.pagination?.page === 1, 'without ?page the list must still be paginated with page = 1')
        }
        list = res.json.data
        if (list[0]) firstRows[r.table] = columnsFromDto(r, list[0])
    })

    await check(`GET /${r.path}?page=1&limit=2 pagination envelope`, async () => {
        if (r.listPagination === 'never') skip('listPagination is "never"')
        const p1 = await call('GET', `/${r.path}?page=1&limit=2`)
        expectStatus(p1, 200)
        const p = p1.json?.pagination
        expect(p, 'missing pagination object')
        for (const k of ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPrevPage']) expect(k in p, `pagination.${k} missing`)
        expect(p.page === 1 && p.limit === 2, `page/limit must be numbers 1 and 2, got ${JSON.stringify(p.page)} / ${JSON.stringify(p.limit)}`)
        expect(p1.json.data.length <= 2, 'data length must be <= limit')
        expect(p.totalPages === Math.ceil(p.total / p.limit), 'totalPages must be ceil(total / limit)')
        expect(p.hasPrevPage === false && p.hasNextPage === (p.page < p.totalPages), 'hasPrevPage/hasNextPage wrong on page 1')
        if (p.totalPages > 1) {
            const p2 = await call('GET', `/${r.path}?page=2&limit=2`)
            expect(p2.json?.pagination?.hasPrevPage === true, 'page 2 must have hasPrevPage: true')
            const pkKey = keyOf(r.summary, r.primaryKey[0])
            if (pkKey) expect(!p2.json.data.some(x => p1.json.data.some(y => y[pkKey] === x[pkKey])), 'page 2 repeats page 1 rows (OFFSET wrong)')
        }
        const big = await call('GET', `/${r.path}?page=999999&limit=5`)
        expectStatus(big, 200, 'page past the end ')
        expect(Array.isArray(big.json?.data) && big.json.data.length === 0, 'page past the end must return an empty array')
    })

    await check(`Summary DTO keys = [${Object.keys(r.summary).join(', ')}]`, async () => {
        if (!list?.length) skip('table is empty')
        const got = Object.keys(list[0]).sort()
        const want = Object.keys(r.summary).sort()
        expect(JSON.stringify(got) === JSON.stringify(want), `got [${got.join(', ')}]`)
    })

    await check(`GET /${r.path}/:key -> 200 detail DTO`, async () => {
        const row = firstRows[r.table]
        if (!row || r.primaryKey.some(k => row[k] === undefined)) skip('no row or PK not in summary DTO')
        const res = await call('GET', `/${r.path}${pkPath(r, row)}`)
        expectStatus(res, 200)
        expect(res.json?.data && !Array.isArray(res.json.data), 'data must be one object')
        const missing = Object.keys(r.detail).filter(k => !(k in res.json.data))
        expect(!missing.length, `detail DTO missing: ${missing.join(', ')}`)
        const extra = Object.keys(res.json.data).filter(k => !(k in r.detail))
        if (extra.length) warnings.push(`/${r.path}/:key detail has extra keys: ${extra.join(', ')}`)
        Object.assign(firstRows[r.table], columnsFromDto(r, res.json.data))
    })

    await check(`GET /${r.path}/<missing> -> 404 ${r.notFoundCode}`, async () => {
        const missingKey = '/' + r.primaryKey.map(k => r.columns[k] === 'integer' ? '999999' : 'ZZ_MISSING').join('/')
        expectError(await call('GET', `/${r.path}${missingKey}`), 404, r.notFoundCode)
    })

    await check(`Plural path: /${r.path.replace(/s$/, '')} is not a route`, async () => {
        if (!r.path.endsWith('s')) skip('path is not plural')
        const res = await call('GET', `/${r.path.replace(/s$/, '')}`)
        expect(res.status === 404, `singular path answered ${res.status}`)
    })

    // filters: try exact filters using values from the first row
    const row0 = () => firstRows[r.table] || {}
    for (const f of r.filters) {
        const m = f.sql.match(/^\w+\.(\w+) = \?$/)
        if (!m || f.like) continue
        const col = m[1]
        const dtoKey = keyOf(r.summary, col)
        await check(`Filter ?${f.params[0]}=<value> returns only matching rows`, async () => {
            const value = row0()[col]
            if (value === undefined || value === null || !dtoKey) skip('column not in summary DTO / no data')
            const res = await call('GET', `/${r.path}?${f.params[0]}=${encodeURIComponent(value)}&limit=100&page=1`)
            expectStatus(res, 200)
            expect(res.json.data.length > 0, 'filter returned nothing for an existing value')
            expect(res.json.data.every(x => String(x[dtoKey]) === String(value)), `some rows have ${dtoKey} != ${value}`)
            if (res.json.pagination) expect(res.json.pagination.total >= res.json.data.length, 'pagination.total must count filtered rows only')
        })
    }
    const search = r.filters.find(f => f.like)
    if (search) {
        await check(`Search ?${search.params[0]}=<text> works`, async () => {
            const col = search.sql.match(/\w+\.(\w+) LIKE/)?.[1]
            const value = row0()[col]
            if (!value) skip('no text to search for')
            const part = String(value).slice(0, Math.min(4, String(value).length))
            const res = await call('GET', `/${r.path}?${search.params[0]}=${encodeURIComponent(part)}&limit=100`)
            expectStatus(res, 200)
            expect(res.json.data.length > 0, `no result for "${part}"`)
        })
    }
    const sortCol = Object.entries(r.summary).find(([, src]) => ['decimal', 'integer'].includes(r.columns[src]) && !r.primaryKey.includes(src))
    await check(`Sort ?sort=${sortCol ? sortCol[1] : '<number column>'}&order=desc`, async () => {
        if (!sortCol) skip('no numeric column in summary DTO')
        const res = await call('GET', `/${r.path}?sort=${sortCol[1]}&order=desc&limit=100`)
        expectStatus(res, 200)
        const vals = res.json.data.map(x => Number(x[sortCol[0]]))
        expect(vals.every((v, i) => i === 0 || vals[i - 1] >= v), 'not sorted descending')
    })

    // ---- create / validation
    let body = null
    let createdRow = null
    await check(`POST /${r.path} -> 201 and returns the new row`, async () => {
        body = buildBody(r, uniq)
        const res = await call('POST', `/${r.path}`, body)
        expectStatus(res, 201)
        expect(res.json?.success === true && res.json.data, 'needs success:true and data')
        createdRow = { ...body, ...columnsFromDto(r, res.json.data) }
        if (r.autoIncrement && createdRow[r.primaryKey[0]] === undefined) {
            createdRow[r.primaryKey[0]] = res.json.data.id ?? res.json.data.insertId
        }
        expect(r.primaryKey.every(k => createdRow[k] !== undefined), 'response must include the new primary key')
        created.push({ r, row: createdRow })
        const get = await call('GET', `/${r.path}${pkPath(r, createdRow)}`)
        expectStatus(get, 200, 'GET created row ')
    })

    await check(`POST duplicate -> 409`, async () => {
        if (!createdRow) skip('create failed')
        if (!r.unique.length && r.autoIncrement) skip('no UNIQUE column')
        const res = await call('POST', `/${r.path}`, body)
        expectError(res, 409, 'DUPLICATE_KEY')
    })

    await check(`POST {} -> 400 (required: ${r.validation.required.join(', ') || 'none'})`, async () => {
        if (!r.validation.required.length) skip('no required column')
        expectError(await call('POST', `/${r.path}`, {}), 400, r.validation.code)
    })

    const numberCol = r.validation.numbers.find(n => !r.foreignKeys.some(fk => fk.column === n) && !r.primaryKey.includes(n))
    await check(`POST with ${numberCol || '<number>'} = "abc" -> 400`, async () => {
        if (!numberCol) skip('no number column')
        const bad = { ...buildBody(r, uniq + 'N'), [numberCol]: 'abc' }
        expectError(await call('POST', `/${r.path}`, bad), 400)
    })

    const fk = r.foreignKeys.find(f => f.table !== r.table)
    await check(`POST with unknown ${fk ? fk.column : '<fk>'} -> 400 FOREIGN_KEY_NOT_FOUND`, async () => {
        if (!fk) skip('no foreign key')
        const parent = R[fk.table]
        const ghost = parent.columns[fk.references] === 'integer' ? 999999 : 'ZZ_MISSING'
        const bad = { ...buildBody(r, uniq + 'F'), [fk.column]: ghost }
        expectError(await call('POST', `/${r.path}`, bad), [400, 404], 'FOREIGN_KEY_NOT_FOUND')
    })

    if (r.validation.emails?.length) {
        await check(`POST with bad ${r.validation.emails[0]} -> 400 ${r.validation.emailCode}`, async () => {
            const bad = { ...buildBody(r, uniq + 'E'), [r.validation.emails[0]]: 'not-an-email' }
            expectError(await call('POST', `/${r.path}`, bad), 400, r.validation.emailCode)
        })
    }
    if (r.validation.dates?.length) {
        await check(`POST with bad ${r.validation.dates[0]} -> 400`, async () => {
            const bad = { ...buildBody(r, uniq + 'D'), [r.validation.dates[0]]: '31/12/2026' }
            expectError(await call('POST', `/${r.path}`, bad), 400)
        })
    }

    // ---- update
    const textCol = r.writable.find(n => r.columns[n] === 'string' && !r.unique.includes(n) && !r.primaryKey.includes(n)
        && !r.foreignKeys.some(f => f.column === n) && !r.validation.oneOf?.[n] && !r.valueHints?.[n] && !r.validation.emails?.includes(n) && keyOf(r.detail, n))
    await check(`PUT /${r.path}/:key changes ${textCol || '<text column>'}`, async () => {
        if (!createdRow) skip('create failed')
        if (!textCol) skip('no plain text column in detail DTO')
        const value = `Upd${uniq}`.slice(0, r.validation.maxLength?.[textCol] || 50)
        const res = await call('PUT', `/${r.path}${pkPath(r, createdRow)}`, { ...body, [textCol]: value })
        expectStatus(res, 200)
        const get = await call('GET', `/${r.path}${pkPath(r, createdRow)}`)
        expect(get.json?.data?.[keyOf(r.detail, textCol)] === value, 'value not saved')
    })
    await check(`PUT /${r.path}/<missing> -> 404`, async () => {
        const missingKey = '/' + r.primaryKey.map(k => r.columns[k] === 'integer' ? '999999' : 'ZZ_MISSING').join('/')
        expectError(await call('PUT', `/${r.path}${missingKey}`, textCol ? { [textCol]: 'x' } : body || {}), 404, r.notFoundCode)
    })
    const patchCol = r.writable.find(n => ['integer', 'decimal'].includes(r.columns[n]) && !r.foreignKeys.some(f => f.column === n) && !r.primaryKey.includes(n) && keyOf(r.detail, n))
    await check(`PATCH /${r.path}/:key updates only ${patchCol || '<number column>'}`, async () => {
        if (!createdRow) skip('create failed')
        if (!patchCol) skip('no number column in detail DTO')
        const res = await call('PATCH', `/${r.path}${pkPath(r, createdRow)}`, { [patchCol]: 7 })
        expectStatus(res, 200)
        expect(Number(res.json?.data?.[keyOf(r.detail, patchCol)]) === 7, 'value not updated')
        if (textCol) expect(res.json.data[keyOf(r.detail, textCol)] !== undefined, 'other fields disappeared')
    })
}

// ---- nested routes and RESTRICT
for (const r of ordered) {
    if (r.primaryKey.length !== 1) continue
    for (const child of r.children) {
        group = `${r.path}/:id/${child.path}`
        const cr = R[child.table]
        console.log(c.bold(`\n[/${r.path}/:id/${child.path}]`))
        const parentRow = firstRows[r.table]
        await check(`GET /${r.path}/:id/${child.path} -> 200 only that parent's rows`, async () => {
            if (!parentRow) skip('no parent row')
            const res = await call('GET', `/${r.path}/${encodeURIComponent(parentRow[r.primaryKey[0]])}/${child.path}?limit=100`)
            expectStatus(res, 200)
            expect(Array.isArray(res.json?.data), 'data must be an array')
            const fkKey = keyOf(cr.summary, child.column)
            if (fkKey) expect(res.json.data.every(x => String(x[fkKey]) === String(parentRow[r.primaryKey[0]])), `rows with another ${fkKey}`)
        })
        await check(`GET /${r.path}/<missing>/${child.path} -> 404`, async () => {
            const missing = r.columns[r.primaryKey[0]] === 'integer' ? '999999' : 'ZZ_MISSING'
            expectError(await call('GET', `/${r.path}/${missing}/${child.path}`), 404, r.notFoundCode)
        })
        await check(`DELETE /${r.path}/:id that still has ${child.path} -> 409 RESOURCE_IN_USE`, async () => {
            if (/CASCADE|SET NULL/.test(child.onDelete)) skip(`ON DELETE ${child.onDelete}`)
            const used = created.find(x => x.r === cr)?.row
            if (!used || used[child.column] == null) skip('no child row created')
            const res = await call('DELETE', `/${r.path}/${encodeURIComponent(used[child.column])}`)
            expectError(res, 409, 'RESOURCE_IN_USE')
        })
    }
}

// ---- delete (children first)
group = 'DELETE'
console.log(c.bold('\n[DELETE]'))
for (const { r, row } of [...created].reverse()) {
    if (KEEP) break
    const status = Number(r.delete?.status || 204)
    await check(`DELETE /${r.path}/:key -> ${status}${status === 204 ? ' (no body)' : ' + message'} then 404`, async () => {
        const res = await call('DELETE', `/${r.path}${pkPath(r, row)}`)
        expectStatus(res, status)
        if (status === 204) expect(res.text === '', '204 must not have a body')
        else expect(res.json?.success === true && res.json.data?.message, 'needs data.message')
        expectError(await call('GET', `/${r.path}${pkPath(r, row)}`), 404, null, 'GET after delete ')
        expectError(await call('DELETE', `/${r.path}${pkPath(r, row)}`), 404, null, 'DELETE again ')
    })
}

// ---- summary
const passed = results.filter(x => x.ok === true).length
const failed = results.filter(x => x.ok === false)
const skipped = results.filter(x => x.ok === null).length
console.log('\n' + '='.repeat(64))
for (const w of [...new Set(warnings)]) console.log(c.yellow(`  ! ${w}`))
console.log(c.bold(`  ${failed.length ? c.red(`${passed}/${passed + failed.length} passed`) : c.green(`${passed}/${passed} passed`)}`) + c.dim(`  (${skipped} skipped)`))
for (const f of failed) console.log(c.red(`  ✗ [${f.group}] ${f.name}: ${f.reason}`))
console.log('='.repeat(64))
const reportDir = join(KIT, 'work')
mkdirSync(reportDir, { recursive: true })
writeFileSync(join(reportDir, `selftest-${cfg.studentId}.json`), JSON.stringify({ api: API, passed, failed, skipped, results, warnings }, null, 2))
process.exit(failed.length ? 1 : 0)
