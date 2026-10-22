#!/usr/bin/env node
// Checks the machine and the exam project before you start coding: Node, packages, app.js layout, MySQL connection, port 3000.
//
//   node kit/doctor.mjs <project>
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findSqlFile, findSpecFile, scanSymbols, projectName } from './lib/project.mjs'
import { parseSql } from './lib/sql-parser.mjs'
import { parseIdentity } from './lib/spec-parser.mjs'

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const project = resolve(process.argv[2] || '.')
const c = {
    red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`,
    dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`
}
let problems = 0
const ok = msg => console.log(`  ${c.green('✓')} ${msg}`)
const bad = (msg, fix) => { problems++; console.log(`  ${c.red('✗')} ${msg}${fix ? '\n      ' + c.yellow('→ ' + fix) : ''}`) }
const warn = (msg, fix) => console.log(`  ${c.yellow('!')} ${msg}${fix ? '\n      ' + c.dim('→ ' + fix) : ''}`)
const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : null)

console.log(c.bold(`\nINT161 doctor — ${project}`))

// ---- Node
console.log(c.bold('\n[Node.js]'))
const [major, minor] = process.versions.node.split('.').map(Number)
if (major > 18 || (major === 18 && minor >= 18)) ok(`Node ${process.version}`)
else bad(`Node ${process.version} is too old for Express 5`, 'ติดตั้ง Node 20+ (LTS) ก่อนสอบ')

// ---- package.json / node_modules
console.log(c.bold('\n[Project files]'))
const pkgText = read(join(project, 'package.json'))
let pkg = null
if (!pkgText) bad('package.json not found', 'ตรวจว่า cd/เปิดโฟลเดอร์โปรเจกต์ถูกตัว (โฟลเดอร์ที่มี package.json)')
else {
    try { pkg = JSON.parse(pkgText) } catch (e) { bad(`package.json is not valid JSON: ${e.message}`) }
}
if (pkg) {
    pkg.type === 'module' ? ok('"type": "module"') : bad('package.json has no "type": "module"', 'เพิ่ม "type": "module" ไม่งั้น import/export ใช้ไม่ได้')
    pkg.scripts?.start ? ok(`start script: ${pkg.scripts.start}`) : warn('no "start" script', 'เพิ่ม "start": "node src/app.js" หรือรัน node src/app.js เอง')
    for (const dep of ['express', 'mysql2']) {
        const installed = read(join(project, 'node_modules', dep, 'package.json'))
        if (!installed) {
            bad(`${dep} is not installed`, `npm install  (ไม่มีเน็ต: node ${join(KIT, 'kit/offline-install.mjs')} "${project}")`)
            continue
        }
        const version = JSON.parse(installed).version
        if (dep === 'express' && Number(version.split('.')[0]) < 5) {
            bad(`express ${version} — generated code needs Express 5 (async errors)`, 'npm install express@5 หรือ offline-install --force')
        } else ok(`${dep} ${version}`)
    }
    for (const dep of Object.keys({ ...pkg.dependencies })) {
        if (!['express', 'mysql2'].includes(dep) && !existsSync(join(project, 'node_modules', dep, 'package.json'))) {
            warn(`${dep} is listed but not installed`, 'npm install (ถ้าโค้ดไม่ได้ใช้ ลบออกจาก package.json ได้)')
        }
    }
}

// ---- spec / SQL
const sqlFile = findSqlFile(project)
const specFile = findSpecFile(project)
const sqlMeta = sqlFile ? parseSql(readFileSync(sqlFile, 'utf8')) : null
const identity = specFile ? parseIdentity(readFileSync(specFile, 'utf8')) : {}
sqlFile ? ok(`SQL: ${sqlFile} (database ${sqlMeta.database}, tables ${sqlMeta.tables.map(t => t.name).join(', ')})`) : warn('no .sql file found near the project')
specFile ? ok(`Spec: ${specFile}${identity.studentId ? ` (id ${identity.studentId})` : ''}`) : warn('no exam spec .md found near the project')

// ---- app.js
console.log(c.bold('\n[src/app.js]'))
const app = read(join(project, 'src/app.js'))
if (!app) bad('src/app.js not found', `node ${join(KIT, 'kit/gen.mjs')} "${project}"`)
else {
    const id = app.match(/\b(?:STUDENT_ID|ID)\s*=\s*['"`](\d+)['"`]/)?.[1]
    if (!id) bad('no STUDENT_ID constant', `const STUDENT_ID = '${identity.studentId || '<รหัส>'}';`)
    else if (identity.studentId && id !== identity.studentId) bad(`STUDENT_ID is ${id} but the spec says ${identity.studentId}`)
    else ok(`STUDENT_ID = ${id}`)
    if (identity.secretKey && !app.includes(identity.secretKey)) warn(`secret key "${identity.secretKey}" from the spec is not in app.js`)
    if (/\/api\/\$\{|\/api\/\d+/.test(app)) ok('routes are under /api/<id>')
    else bad('no /api/<id> base path in app.js', 'const BASE_PATH = `/api/${STUDENT_ID}` แล้ว app.use(BASE_PATH, apiRouter)')
    if (/\/api\/:studentId/.test(app)) bad('uses /api/:studentId — the id must be hardcoded')
    const pos = re => { const m = app.match(re); return m ? m.index : -1 }
    const json = pos(/express\.json\(/)
    const firstRouter = pos(/app\.use\([^)]*(Router|router|Route)\b/)
    const handler = pos(/app\.use\(\s*errorHandler/)
    json === -1 ? bad('app.use(express.json()) missing', 'ไม่มีบรรทัดนี้ req.body จะเป็น undefined') : json < firstRouter || firstRouter === -1 ? ok('express.json() before routers') : bad('express.json() is after a router', 'ย้าย app.use(express.json()) ขึ้นไปก่อน router')
    if (handler !== -1 && firstRouter !== -1 && handler < firstRouter) bad('errorHandler is registered before a router', 'app.use(errorHandler) ต้องอยู่ท้ายสุด')
    if (/app\.get\(`\/api\/\$\{[^`]*\)`/.test(app)) bad('a ")" ended up inside a route path template string', 'ตรวจ app.get(`${BASE_PATH}/student-info`, ...) ว่าวงเล็บไม่อยู่ใน backtick')
}

// ---- database
console.log(c.bold('\n[MySQL]'))
const symbols = scanSymbols(project)
const poolFile = symbols.pool?.file
if (!poolFile) bad('no createPool(...) found in src/', 'สร้าง src/configs/db-config.js (gen.mjs สร้างให้)')
else {
    const text = readFileSync(poolFile, 'utf8')
    const dbName = text.match(/database\s*:\s*['"`]([^'"`]+)['"`]/)?.[1]
    if (sqlMeta?.database && dbName && dbName !== sqlMeta.database) bad(`db-config database is "${dbName}" but the SQL creates "${sqlMeta.database}"`, `แก้ database: '${sqlMeta.database}'`)
    if (!/decimalNumbers/.test(text)) warn('db-config has no decimalNumbers: true', 'DECIMAL จะเป็น string — mapper ที่ gen สร้างแปลงให้แล้ว แต่ถ้าเขียนเองต้อง Number()')
    if (!/export\s+default/.test(text)) bad(`${poolFile} has no "export default"`, 'repo ใช้ import db from "../configs/db-config.js" ต้อง export default pool')
    if (!existsSync(join(project, 'node_modules', 'mysql2'))) warn('skip connection test: mysql2 not installed')
    else {
        try {
            const mod = await Promise.race([
                import(pathToFileURL(poolFile).href),
                new Promise((_, rej) => setTimeout(() => rej(new Error('import timeout')), 5000))
            ])
            const pool = mod.default
            const timeout = new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('connection timeout (5s)'), { code: 'TIMEOUT' })), 5000))
            const [[info]] = await Promise.race([pool.query('SELECT DATABASE() AS db, VERSION() AS version'), timeout])
            ok(`connected to MySQL ${info.version}, database ${info.db}`)
            const [tables] = await pool.query('SHOW TABLES')
            const names = tables.map(t => Object.values(t)[0])
            for (const t of sqlMeta?.tables || []) {
                if (!names.includes(t.name)) { bad(`table ${t.name} does not exist`, `รัน ${sqlFile} ใหม่ (mysql -u root -p < ไฟล์ หรือ WebStorm: Run SQL Script)`); continue }
                const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${t.name}\``)
                ok(`${t.name}: ${n} rows`)
            }
            await pool.end?.()
        } catch (e) {
            const tips = {
                ECONNREFUSED: 'MySQL ไม่ได้เปิด: Windows → services.msc เปิด MySQL80 (หรือ net start MySQL80 ใน cmd แบบ admin) / macOS → brew services start mysql',
                ER_ACCESS_DENIED_ERROR: 'user/password ใน db-config ไม่ตรงกับ MySQL ของเครื่องนี้',
                ER_BAD_DB_ERROR: `ยังไม่ได้สร้าง database — รัน ${sqlFile || 'init-database.sql'} ก่อน`,
                ER_NOT_SUPPORTED_AUTH_MODE: 'MySQL ใช้ auth แบบเก่า — อัปเดต mysql2 หรือเปลี่ยน user เป็น mysql_native_password',
                TIMEOUT: 'ต่อ MySQL ไม่ได้ภายใน 5 วินาที — ตรวจ host/port (3306) และว่า MySQL เปิดอยู่',
                ENOTFOUND: 'host ใน db-config ผิด ใช้ localhost หรือ 127.0.0.1'
            }
            bad(`cannot use MySQL: ${e.code || ''} ${e.message}`, tips[e.code] || 'ดู error ด้านบน')
        }
    }
}

// ---- port 3000
console.log(c.bold('\n[Port 3000]'))
const listening = await new Promise(res => {
    const s = createConnection({ port: 3000, host: '127.0.0.1' })
    s.once('connect', () => { s.destroy(); res(true) })
    s.once('error', () => res(false))
    setTimeout(() => { s.destroy(); res(false) }, 1500)
})
if (!listening) warn('nothing is running on port 3000', 'npm start (ตอนรัน test ต้องเปิด server ค้างไว้อีกหน้าต่าง)')
else {
    const id = (app || '').match(/\b(?:STUDENT_ID|ID)\s*=\s*['"`](\d+)['"`]/)?.[1] || identity.studentId
    try {
        const r = await fetch(`http://localhost:3000/api/${id}/student-info`)
        const body = await r.json().catch(() => null)
        r.status === 200 && body?.success ? ok(`server answers /api/${id}/student-info`) : warn(`port 3000 answers ${r.status} on /api/${id}/student-info`, 'อาจเป็นโปรแกรมอื่น หรือ server เก่าที่ยังไม่ได้ restart (WebStorm: Stop and Rerun)')
    } catch {
        warn('port 3000 is used by something that is not this API', 'ปิดโปรแกรมที่ใช้ port 3000 หรือ server ตัวเก่า')
    }
}

const configPath = join(KIT, 'work', `${projectName(project)}.config.json`)
console.log('\n' + (problems ? c.red(`${problems} problem(s) to fix`) : c.green('All required checks passed')))
if (!existsSync(configPath)) console.log(c.dim(`Next: node ${join(KIT, 'kit/gen.mjs')} "${project}"`))
process.exit(problems ? 1 : 0)
