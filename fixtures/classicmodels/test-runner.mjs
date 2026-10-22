#!/usr/bin/env node
// INT161 Mock Exam #3 Evaluator (classicmodels: offices / productlines / employees / customers / payments)
// ใช้: npm start แล้ว  node tests/test-runner.mjs <studentId>   (ตัวเลือก BASE_URL=http://localhost:3000)
const studentId = process.argv[2]
if (!studentId) {
    console.error('Usage: node tests/test-runner.mjs <studentId>')
    process.exit(1)
}
const ORIGIN = process.env.BASE_URL || 'http://localhost:3000'
const API = `${ORIGIN}/api/${studentId}`
const red = s => `\x1b[31m${s}\x1b[0m`, green = s => `\x1b[32m${s}\x1b[0m`, dim = s => `\x1b[2m${s}\x1b[0m`

async function call(method, path, body) {
    const res = await fetch(API + path, {
        method,
        headers: body ? {'Content-Type': 'application/json'} : {},
        body: body ? JSON.stringify(body) : undefined
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    return {status: res.status, json, text}
}

class Fail extends Error {}
const expect = (cond, reason) => { if (!cond) throw new Fail(reason) }
const isStatus = (r, s, label = '') => expect(r.status === s, `${label}expected HTTP ${s}, got ${r.status}`)
const isError = (r, status, code) => {
    isStatus(r, status)
    expect(r.json && r.json.success === false, 'error response must be JSON with success: false')
    expect(r.json.error?.code === code, `error.code must be "${code}" but got "${r.json.error?.code}"`)
}

const results = []
async function check(group, name, points, fn) {
    try {
        await fn()
        results.push({group, points, earned: points})
        console.log(`  • [${group}] ${name} ... ${green('PASSED')} (${points}/${points} pts)`)
    } catch (e) {
        results.push({group, points, earned: 0})
        console.log(`  • [${group}] ${name} ... ${red('FAILED')} (0/${points} pts)`)
        console.log(red(`    └ Reason: ${e instanceof Fail ? e.message : e.name + ': ' + e.message}`))
    }
}

try { await fetch(ORIGIN) } catch {
    console.log(red(`Cannot connect to ${ORIGIN}. Run npm start first.`))
    process.exit(1)
}
console.log(`Testing ${dim(API)}\n`)
const uniq = Date.now().toString(36).toUpperCase()

await check('0 Identity', 'GET /student-info', 5, async () => {
    const r = await call('GET', '/student-info')
    isStatus(r, 200)
    expect(r.json?.success === true && r.json.data?.studentId === studentId, 'success:true and data.studentId required')
})

// ข้อ 1
await check('1 Offices', 'GET /offices/1 -> 200 with data', 10, async () => {
    const r = await call('GET', '/offices/1')
    isStatus(r, 200)
    expect(r.json?.success === true && r.json.data?.officeCode === '1', 'data.officeCode must be "1"')
})
await check('1 Offices', 'GET /offices/NA-99 -> 404 OFFICE_NOT_FOUND (not empty object / null)', 10, async () => {
    isError(await call('GET', '/offices/NA-99'), 404, 'OFFICE_NOT_FOUND')
})

// ข้อ 2
const line = `Electric Vehicles ${uniq}`
await check('2 Productlines', 'POST /productlines -> 201', 10, async () => {
    const r = await call('POST', '/productlines', {productLine: line, textDescription: 'Line of modern high-performance electric cars'})
    isStatus(r, 201)
    expect(r.json?.data?.productLine === line, 'data.productLine must echo the created key')
})
await check('2 Productlines', 'POST missing/empty productLine -> 400 VALIDATION_ERROR', 5, async () => {
    isError(await call('POST', '/productlines', {productLine: '   ', textDescription: 'x'}), 400, 'VALIDATION_ERROR')
    isError(await call('POST', '/productlines', {textDescription: 'x'}), 400, 'VALIDATION_ERROR')
})
await check('2 Productlines', 'POST duplicate productLine -> 409 DUPLICATE_KEY', 5, async () => {
    isError(await call('POST', '/productlines', {productLine: 'Motorcycles'}), 409, 'DUPLICATE_KEY')
})

// ข้อ 3
await check('3 Employees', 'PUT /employees/1165 -> 200 updated', 10, async () => {
    const r = await call('PUT', '/employees/1165', {jobTitle: `Sales Rep ${uniq}`, email: 'ljennings@classicmodelcars.com'})
    isStatus(r, 200)
    expect(r.json?.data?.jobTitle === `Sales Rep ${uniq}`, 'jobTitle was not updated')
})
await check('3 Employees', 'PUT /employees/9999 -> 404 EMPLOYEE_NOT_FOUND', 5, async () => {
    isError(await call('PUT', '/employees/9999', {jobTitle: 'x'}), 404, 'EMPLOYEE_NOT_FOUND')
})
await check('3 Employees', 'PUT bad email -> 400 INVALID_EMAIL', 5, async () => {
    isError(await call('PUT', '/employees/1165', {email: 'not-an-email'}), 400, 'INVALID_EMAIL')
})
await check('3 Employees', 'PUT officeCode/reportsTo not exist -> 400 FOREIGN_KEY_NOT_FOUND', 5, async () => {
    isError(await call('PUT', '/employees/1165', {officeCode: 'ZZ'}), 400, 'FOREIGN_KEY_NOT_FOUND')
    isError(await call('PUT', '/employees/1165', {reportsTo: 424242}), 400, 'FOREIGN_KEY_NOT_FOUND')
})

// ข้อ 4
await check('4 Customers', 'DELETE /customers/169 (no orders/payments) -> 200 + message', 10, async () => {
    const r = await call('DELETE', '/customers/169')
    expect(r.status === 200 || r.status === 404, `expected HTTP 200, got ${r.status}`)
    if (r.status === 404) throw new Fail('customer 169 already deleted - re-run init-database.sql then test again')
    expect(r.json?.success === true && r.json.data?.message, 'data.message required')
})
await check('4 Customers', 'DELETE /customers/99999 -> 404 CUSTOMER_NOT_FOUND', 5, async () => {
    isError(await call('DELETE', '/customers/99999'), 404, 'CUSTOMER_NOT_FOUND')
})
await check('4 Customers', 'DELETE customer with orders/payments -> 409 RESOURCE_IN_USE', 5, async () => {
    isError(await call('DELETE', '/customers/103'), 409, 'RESOURCE_IN_USE')
    isError(await call('DELETE', '/customers/125'), 409, 'RESOURCE_IN_USE')
})

// ข้อ 5
const check1 = `HQ${uniq}`
await check('5 Payments', 'POST /customers/103/payments -> 201', 10, async () => {
    const r = await call('POST', '/customers/103/payments', {checkNumber: check1, paymentDate: '2026-09-18', amount: 2500.50})
    isStatus(r, 201)
    expect(r.json?.data?.checkNumber === check1 && Number(r.json.data.amount) === 2500.5, 'created payment must be returned')
})
await check('5 Payments', 'POST payment for unknown customer -> 404 CUSTOMER_NOT_FOUND', 5, async () => {
    isError(await call('POST', '/customers/99999/payments', {checkNumber: 'X1', paymentDate: '2026-09-18', amount: 10}), 404, 'CUSTOMER_NOT_FOUND')
})
await check('5 Payments', 'POST amount <= 0 / bad date -> 400 INVALID_PAYMENT_DATA', 5, async () => {
    isError(await call('POST', '/customers/103/payments', {checkNumber: 'X2', paymentDate: '2026-09-18', amount: -5}), 400, 'INVALID_PAYMENT_DATA')
    isError(await call('POST', '/customers/103/payments', {checkNumber: 'X3', paymentDate: '18/09/2026', amount: 5}), 400, 'INVALID_PAYMENT_DATA')
    isError(await call('POST', '/customers/103/payments', {checkNumber: 'X4', paymentDate: '2026-09-18', amount: '5'}), 400, 'INVALID_PAYMENT_DATA')
})
await check('5 Payments', 'POST same checkNumber twice -> 409 DUPLICATE_KEY', 5, async () => {
    isError(await call('POST', '/customers/103/payments', {checkNumber: check1, paymentDate: '2026-09-18', amount: 1}), 409, 'DUPLICATE_KEY')
})

await check('6 Standards', 'Unknown route -> JSON 404 (no Express HTML page)', 5, async () => {
    const r = await call('GET', '/no-such-resource')
    isStatus(r, 404)
    expect(r.json?.success === false, 'must be JSON with success:false, not the default HTML page')
})

const total = results.reduce((s, r) => s + r.earned, 0)
const max = results.reduce((s, r) => s + r.points, 0)
console.log('\n' + '='.repeat(56))
for (const g of [...new Set(results.map(r => r.group))]) {
    const items = results.filter(r => r.group === g)
    const got = items.reduce((s, r) => s + r.earned, 0), all = items.reduce((s, r) => s + r.points, 0)
    console.log(`  ${g.padEnd(18)}: ${got === all ? green(`${got}/${all}`) : red(`${got}/${all}`)}`)
}
console.log('-'.repeat(56))
console.log(`TOTAL SCORE        : ${total} / ${max} points`)
console.log('='.repeat(56))
