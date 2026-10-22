#!/usr/bin/env node
// =====================================================================
// INT161 Local Offline Exam Evaluator (ฉบับฝึกซ้อม — เลียนแบบหมวดคะแนนของ test-runner ในคาบ 9 ต.ค.)
// ใช้: 1) npm start (ให้ server รันที่ port 3000)  2) node tests/test-runner.mjs <studentId>
// ตัวเลือก: BASE_URL=http://localhost:3000  RESOURCE=products  PARENT=brands
// =====================================================================
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const studentId = process.argv[2]
if (!studentId) {
    console.error('Usage: node tests/test-runner.mjs <studentId>')
    process.exit(1)
}
const ORIGIN = process.env.BASE_URL || 'http://localhost:3000'
const API = `${ORIGIN}/api/${studentId}`

// ค่าตั้งต้น = ข้อสอบซ้อม Mobile Phone Distributor (brands -> products)
// ข้อสอบโดเมนอื่น: สร้าง tests/exam-config.json ทับค่าเหล่านี้ (ดูตัวอย่างใน mock-exams/)
const here = dirname(fileURLToPath(import.meta.url))
const configPath = process.env.EXAM_CONFIG || join(here, 'exam-config.json')
const uniq = Date.now().toString(36).toUpperCase()
const CONFIG = {
    parent: 'brands',
    child: 'products',
    summaryKeys: ['id', 'sku', 'name', 'brandId', 'category', 'price', 'status'],
    detailKeys: ['id', 'sku', 'name', 'brandId', 'brandName', 'category', 'price', 'ramGb', 'storageGb', 'color', 'stockQuantity', 'status', 'releaseDate'],
    uniqueField: 'sku',
    nameField: 'name',
    fkField: 'brand_id',
    newItem: {
        sku: 'TEST-SKU-{uniq}', name: 'Test Phone 2026', brand_id: 1, category: 'FLAGSHIP', price: 29900.00,
        ram_gb: 8, storage_gb: 256, color: 'Black', stock_quantity: 10, status: 'AVAILABLE', release_date: '2026-01-01'
    },
    filter: { field: 'category', value: 'FLAGSHIP', sortField: 'price' },
    ...(existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {})
}
const CHILD = CONFIG.child
const PARENT = CONFIG.parent

const c = {
    red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`, cyan: s => `\x1b[36m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`
}

async function call(method, path, body) {
    const started = Date.now()
    const res = await fetch(API + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    })
    const text = await res.text()
    let json = null
    let parseError = null
    if (text) {
        try { json = JSON.parse(text) } catch (e) { parseError = e.message }
    }
    return { status: res.status, json, text, parseError, ms: Date.now() - started }
}

class Fail extends Error {}
function expect(cond, reason) { if (!cond) throw new Fail(reason) }
function expectStatus(r, expected, label = '') {
    const list = [].concat(expected)
    expect(list.includes(r.status), `${label}expected HTTP ${list.join(' or ')}, got ${r.status}`)
}
function expectJson(r) {
    expect(r.json !== null, r.parseError ? `${r.parseError.slice(0, 60)} (response is not valid JSON)` : 'Empty response body')
}

const results = []
const ctx = {}

async function check(category, name, points, fn, { bonus = false } = {}) {
    const started = Date.now()
    try {
        await fn()
        results.push({ category, name, points, earned: points, bonus, passed: true })
        console.log(`  • [${category}] ${name} ... ${c.green('PASSED')} (${points}/${points} pts) ${c.dim(`[${Date.now() - started}ms]`)}`)
    } catch (e) {
        const reason = e instanceof Fail ? e.message : `${e.name}: ${e.message}`
        results.push({ category, name, points, earned: 0, bonus, passed: false, reason })
        console.log(`  • [${category}] ${name} ... ${c.red('FAILED')} (0/${points} pts)`)
        console.log(c.red(`    └ Reason: ${reason}`))
    }
}

console.log('='.repeat(64))
console.log(` INT161 Practice Evaluator — ${PARENT} / ${CHILD}`)
console.log('='.repeat(64))
console.log(`Checking connection to: ${c.cyan(ORIGIN)} ...`)
try {
    await fetch(ORIGIN)
    console.log(c.green('Server is responding! Starting evaluation suite...\n'))
} catch {
    console.log(c.red('Cannot connect. Run `npm start` first (port 3000).'))
    process.exit(1)
}

// ---------------- 1. Identity (10) ----------------
await check('1. Identity', 'Student Identity Endpoint', 10, async () => {
    const r = await call('GET', '/student-info')
    expectStatus(r, 200)
    expectJson(r)
    expect(r.json.success === true, "Response must have success: true")
    expect(r.json.data && r.json.data.studentId === studentId, `data.studentId must be "${studentId}"`)
    expect(r.json.data.name, 'data.name is missing')
    expect(r.json.data.secretKey, 'data.secretKey is missing')
    expect(r.json.timestamp, 'timestamp is missing')
})

// ---------------- 2. Parent API (10) ----------------
await check(`2. ${PARENT} API`, `GET All ${PARENT} (List)`, 5, async () => {
    const r = await call('GET', `/${PARENT}`)
    expectStatus(r, 200)
    expectJson(r)
    expect(Array.isArray(r.json.data) && r.json.data.length > 0, "'data' must be a non-empty array")
    ctx.parentId = r.json.data[0].id
})
await check(`2. ${PARENT} API`, `GET ${PARENT} by ID & 404 Check`, 5, async () => {
    const id = ctx.parentId ?? 1
    const r = await call('GET', `/${PARENT}/${id}`)
    expectStatus(r, 200, `GET /${PARENT}/${id} `)
    expectJson(r)
    expect(r.json.data && !Array.isArray(r.json.data) && r.json.data.id == id, 'data must be a single object with the same id')
    const nf = await call('GET', `/${PARENT}/999999`)
    expectStatus(nf, 404, `GET /${PARENT}/999999 `)
})

// ---------------- 3. Child Query (35) ----------------
const SUMMARY_KEYS = CONFIG.summaryKeys
const DETAIL_KEYS = CONFIG.detailKeys

await check(`3. ${CHILD} Query`, `GET ${CHILD} Pagination Envelope`, 15, async () => {
    const r = await call('GET', `/${CHILD}?page=1&limit=5`)
    expectStatus(r, 200)
    expectJson(r)
    const p = r.json.pagination
    expect(p, "Missing 'pagination' object")
    for (const k of ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPrevPage']) {
        expect(k in p, `pagination.${k} is missing`)
    }
    expect(p.page === 1 && p.limit === 5, 'pagination.page/limit must be numbers 1 and 5')
    expect(Array.isArray(r.json.data) && r.json.data.length <= 5, 'data length must be <= limit')
    expect(p.totalPages === Math.ceil(p.total / p.limit), 'totalPages must be ceil(total / limit)')
    expect(p.hasPrevPage === false, 'hasPrevPage must be false on page 1')
    expect(p.hasNextPage === (p.page < p.totalPages), 'hasNextPage is wrong')
    const r2 = await call('GET', `/${CHILD}?page=2&limit=5`)
    expect(r2.json?.pagination?.hasPrevPage === true, 'page 2 must have hasPrevPage: true')
    const ids1 = r.json.data.map(x => x.id)
    expect(!r2.json.data.some(x => ids1.includes(x.id)), 'page 2 must not repeat items of page 1 (check OFFSET)')
})
await check(`3. ${CHILD} Query`, `Summary DTO Filtering (GET /${CHILD})`, 10, async () => {
    const r = await call('GET', `/${CHILD}?page=1&limit=10`)
    expectJson(r)
    expect(Array.isArray(r.json.data) && r.json.data.length > 0, `${CHILD} 'data' must be non-empty array`)
    const keys = Object.keys(r.json.data[0]).sort()
    expect(JSON.stringify(keys) === JSON.stringify([...SUMMARY_KEYS].sort()),
        `Summary keys must be exactly [${SUMMARY_KEYS}] but got [${keys}]`)
    ctx.childId = r.json.data[0].id
})
await check(`3. ${CHILD} Query`, `GET ${CHILD} by ID & Detail DTO`, 10, async () => {
    const id = ctx.childId ?? 1
    const r = await call('GET', `/${CHILD}/${id}`)
    expectStatus(r, 200, `GET /${CHILD}/${id} `)
    expectJson(r)
    for (const k of DETAIL_KEYS) expect(k in r.json.data, `Detail DTO missing '${k}'`)
    const nf = await call('GET', `/${CHILD}/999999`)
    expectStatus(nf, 404, `GET /${CHILD}/999999 `)
})

// ---------------- 4. Child Modify (30) ----------------
const NEW_ITEM = JSON.parse(JSON.stringify(CONFIG.newItem).replaceAll('{uniq}', uniq))
const UNIQUE_FIELD = CONFIG.uniqueField
const FK_FIELD = CONFIG.fkField
const NAME_FIELD = CONFIG.nameField


await check(`4. ${CHILD} Modify`, `POST Create ${CHILD} (201 Created)`, 10, async () => {
    const r = await call('POST', `/${CHILD}`, NEW_ITEM)
    expectStatus(r, 201)
    expectJson(r)
    const id = r.json.data?.id ?? r.json.data?.insertId ?? r.json.id
    expect(id, 'Response must contain the created id (data.id)')
    ctx.createdId = id
    const g = await call('GET', `/${CHILD}/${id}`)
    expectStatus(g, 200, 'GET created item ')
})
await check(`4. ${CHILD} Modify`, `PUT Update ${CHILD} (200 OK)`, 10, async () => {
    expect(ctx.createdId, 'Skipped: Created ID not found')
    const r = await call('PUT', `/${CHILD}/${ctx.createdId}`, { ...NEW_ITEM, [NAME_FIELD]: 'Updated Name 2026' })
    expectStatus(r, 200)
    const g = await call('GET', `/${CHILD}/${ctx.createdId}`)
    expect(g.json?.data?.[NAME_FIELD] === 'Updated Name 2026', 'Value was not updated in database')
    const nf = await call('PUT', `/${CHILD}/999999`, { [NAME_FIELD]: 'x' })
    expectStatus(nf, 404, 'PUT unknown id ')
})
await check(`4. ${CHILD} Modify`, `DELETE ${CHILD} (204 No Content)`, 10, async () => {
    expect(ctx.createdId, 'Skipped: Created ID not found')
    const r = await call('DELETE', `/${CHILD}/${ctx.createdId}`)
    expectStatus(r, 204)
    expect(r.text === '', '204 must not have a response body')
    const g = await call('GET', `/${CHILD}/${ctx.createdId}`)
    expectStatus(g, 404, 'GET after delete ')
    const again = await call('DELETE', `/${CHILD}/${ctx.createdId}`)
    expectStatus(again, 404, 'DELETE twice ')
})

// ---------------- 5. Standards & Error (15) ----------------
await check('5. Standards & Error', `Duplicate ${UNIQUE_FIELD} Conflict Handling (409 Conflict)`, 5, async () => {
    const item = { ...NEW_ITEM, [UNIQUE_FIELD]: `${NEW_ITEM[UNIQUE_FIELD]}-DUP` }
    const first = await call('POST', `/${CHILD}`, item)
    expectStatus(first, 201, 'first POST ')
    const dup = await call('POST', `/${CHILD}`, item)
    const createdId = first.json?.data?.id
    if (createdId) await call('DELETE', `/${CHILD}/${createdId}`)
    expectStatus(dup, [409, 400], `duplicate ${UNIQUE_FIELD} `)
    expectJson(dup)
    expect(dup.json.success === false, 'Error response should have success: false')
})
await check('5. Standards & Error', 'Standard JSON Envelope Format', 5, async () => {
    const list = await call('GET', `/${CHILD}`)
    const one = await call('GET', `/${PARENT}/1`)
    const nf = await call('GET', `/${CHILD}/999999`)
    for (const r of [list, one, nf]) {
        expectJson(r)
        expect(typeof r.json.success === 'boolean', "Response missing 'success' boolean attribute")
        expect('timestamp' in r.json, "Response missing 'timestamp'")
    }
    expect(nf.json.success === false, '404 response must have success: false')
})
await check('5. Standards & Error', 'RESTful Clean Route Hierarchy', 5, async () => {
    const plural = await call('GET', `/${CHILD}`)
    expectStatus(plural, 200, `GET /${CHILD} `)
    const singular = await call('GET', `/${CHILD.replace(/s$/, '')}`)
    expect(singular.status === 404, `Standard plural resource /${CHILD} must be used (singular should be 404)`)
})

// ---------------- Bonus (ไม่นับใน 100) : scenario เพิ่มเติมที่อาจออก ----------------
console.log(c.yellow('\n  --- Bonus scenarios (not counted in 100) ---'))
await check('B', 'Unknown route returns JSON 404 with success:false', 0, async () => {
    const r = await call('GET', '/this-route-does-not-exist')
    expectStatus(r, 404)
    expectJson(r)
    expect(r.json.success === false, 'success must be false')
}, { bonus: true })
await check('B', `GET /${CHILD} without ?page -> default page 1`, 0, async () => {
    const r = await call('GET', `/${CHILD}`)
    expect(r.json?.pagination?.page === 1, 'default page must be 1 (spec: "ค่า default คือ 1")')
}, { bonus: true })
await check('B', 'POST missing required fields -> 400', 0, async () => {
    const r = await call('POST', `/${CHILD}`, { [NAME_FIELD]: 'no unique field' })
    expectStatus(r, 400)
}, { bonus: true })
await check('B', `Nested route GET /${PARENT}/:id/${CHILD}`, 0, async () => {
    const r = await call('GET', `/${PARENT}/1/${CHILD}?page=1&limit=3`)
    expectStatus(r, 200)
    expect(Array.isArray(r.json?.data), 'data must be array')
    const nf = await call('GET', `/${PARENT}/999999/${CHILD}`)
    expectStatus(nf, 404, 'unknown parent ')
}, { bonus: true })
const F = CONFIG.filter
await check('B', `Filter ?${F.field}=${F.value}&sort=${F.sortField}&order=desc`, 0, async () => {
    const r = await call('GET', `/${CHILD}?${F.field}=${encodeURIComponent(F.value)}&sort=${F.sortField}&order=desc&limit=50`)
    expectStatus(r, 200)
    const data = r.json.data
    expect(data.length > 0 && data.every(x => x[F.field] === F.value), `all items must have ${F.field} = ${F.value}`)
    expect(data.every((x, i) => i === 0 || data[i - 1][F.sortField] >= x[F.sortField]), `must be sorted by ${F.sortField} desc`)
    expect(r.json.pagination.total === data.length, 'pagination.total must count only filtered rows')
}, { bonus: true })
await check('B', `PATCH partial update`, 0, async () => {
    const created = await call('POST', `/${CHILD}`, { ...NEW_ITEM, [UNIQUE_FIELD]: `${NEW_ITEM[UNIQUE_FIELD]}-P` })
    const id = created.json?.data?.id
    expect(id, 'create failed')
    const r = await call('PATCH', `/${CHILD}/${id}`, { [F.sortField]: 1234 })
    await call('DELETE', `/${CHILD}/${id}`)
    expectStatus(r, 200)
    expect(r.json.data[F.sortField] === 1234 && r.json.data[NAME_FIELD] === NEW_ITEM[NAME_FIELD], `only ${F.sortField} should change`)
}, { bonus: true })
await check('B', `POST with non-existing ${PARENT} id -> 400/404/409`, 0, async () => {
    const r = await call('POST', `/${CHILD}`, { ...NEW_ITEM, [UNIQUE_FIELD]: `${NEW_ITEM[UNIQUE_FIELD]}-FK`, [FK_FIELD]: 999999 })
    expectStatus(r, [400, 404, 409])
}, { bonus: true })
await check('B', `DELETE ${PARENT} that still has ${CHILD} -> 409`, 0, async () => {
    const r = await call('DELETE', `/${PARENT}/1`)
    expectStatus(r, 409)
}, { bonus: true })

// ---------------- Summary ----------------
const scored = results.filter(r => !r.bonus)
const categories = [...new Set(scored.map(r => r.category))]
const total = scored.reduce((s, r) => s + r.earned, 0)
const max = scored.reduce((s, r) => s + r.points, 0)
console.log('\n' + '='.repeat(64))
console.log('                  EXAM TEST RESULTS SUMMARY')
console.log('='.repeat(64))
console.log(`Student ID : ${c.cyan(studentId)}`)
console.log(`Tested URL : ${c.dim(API)}`)
console.log('-'.repeat(64))
for (const cat of categories) {
    const items = scored.filter(r => r.category === cat)
    const got = items.reduce((s, r) => s + r.earned, 0)
    const all = items.reduce((s, r) => s + r.points, 0)
    const label = `  ${cat}`.padEnd(30)
    console.log(`${label}: ${got === all ? c.green(`${got}/${all} pts`) : c.red(`${got}/${all} pts`)}`)
}
const bonus = results.filter(r => r.bonus)
console.log(`  Bonus scenarios`.padEnd(30) + `: ${bonus.filter(r => r.passed).length}/${bonus.length} passed`)
console.log('-'.repeat(64))
console.log(`TOTAL SCORE                   : ${total} / ${max} points`)
console.log('='.repeat(64))

const reportPath = join(here, `test-report-${studentId}.json`)
writeFileSync(reportPath, JSON.stringify({ studentId, total, max, results }, null, 2))
console.log(c.dim(`Detailed report saved to: ${reportPath}`))
