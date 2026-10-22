#!/usr/bin/env node
// Regression test for the kit: for every fixture, generate a project from scratch, install the bundled
// node_modules, run it on the SQLite sandbox and run selftest against it. Also covers patching a teacher-style app.js.
// Needs Node 22.15+ (sandbox). No internet, no MySQL.
//
//   npm test            or   node kit/test/run-all.mjs [fixture ...]
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const WORK = join(KIT, 'work', 'test')
const only = process.argv.slice(2)
const node = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts })
const strip = s => (s || '').replace(/\x1b\[[0-9;]*m/g, '')

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
const results = []

function step(name, res, pattern = null) {
    const out = strip(res.stdout) + strip(res.stderr)
    const passed = res.status === 0 && (!pattern || pattern.test(out))
    results.push({ name, passed })
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}`)
    if (!passed) console.log(out.split('\n').filter(l => /FAIL|└|Error|error|✗/.test(l)).slice(0, 15).map(l => '     ' + l).join('\n'))
    return passed
}

function prepare(name, fixture) {
    const dir = join(WORK, name)
    mkdirSync(join(dir, 'database'), { recursive: true })
    cpSync(join(KIT, 'fixtures', fixture, 'init-database.sql'), join(dir, 'database', 'init-database.sql'))
    if (existsSync(join(KIT, 'fixtures', fixture, 'exam-spec.md'))) cpSync(join(KIT, 'fixtures', fixture, 'exam-spec.md'), join(dir, 'exam-spec.md'))
    return dir
}

const configFor = dir => join(WORK, `${dir.split(/[\\/]/).pop()}.config.json`)

for (const fixture of readdirSync(join(KIT, 'fixtures'))) {
    if (only.length && !only.includes(fixture)) continue
    const dir = prepare(fixture, fixture)
    const cfg = configFor(dir)
    console.log(`\n== ${fixture}`)
    if (!step(`${fixture}: gen`, node([join(KIT, 'kit/gen.mjs'), dir, '--config', cfg]))) continue
    const extra = join(KIT, 'fixtures', fixture, 'set.txt')
    if (existsSync(extra)) {
        const sets = readFileSync(extra, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
        step(`${fixture}: set ${sets.join(' ')}`, node([join(KIT, 'kit/gen.mjs'), 'set', dir, ...sets, '--config', cfg]))
    }
    step(`${fixture}: offline-install`, node([join(KIT, 'kit/offline-install.mjs'), dir]))
    step(`${fixture}: syntax`, node(['--check', join(dir, 'src/app.js')]))
    step(`${fixture}: selftest`, node([join(KIT, 'kit/dev/sandbox.mjs'), dir, '--port', '3998', '--', process.execPath, join(KIT, 'kit/selftest.mjs'), dir, '--config', cfg]), / passed /)
    const runner = join(KIT, 'fixtures', fixture, 'test-runner.mjs')
    if (existsSync(runner)) {
        mkdirSync(join(dir, 'tests'), { recursive: true })
        cpSync(runner, join(dir, 'tests', 'test-runner.mjs'))
        const examConfig = join(KIT, 'fixtures', fixture, 'exam-config.json')
        if (existsSync(examConfig)) cpSync(examConfig, join(dir, 'tests', 'exam-config.json'))
        const id = JSON.parse(readFileSync(cfg, 'utf8')).studentId
        step(`${fixture}: fixture test-runner full score`, node([join(KIT, 'kit/dev/sandbox.mjs'), dir, '--port', '3997', '--', process.execPath, join(dir, 'tests/test-runner.mjs'), id]), /TOTAL SCORE\s*:\s*(\d+)\s*\/\s*\1\b/)
    }
    step(`${fixture}: pack`, node([join(KIT, 'kit/pack.mjs'), dir, '--id', '67130599999', '--out', join(WORK, `${fixture}.zip`)]), /verified OK/)
}

// teacher-style template: existing app.js / db-config / example files, patched with --app
if (!only.length || only.includes('teacher')) {
    console.log('\n== teacher template (patch app.js)')
    const dir = prepare('teacher', 'mobile')
    mkdirSync(join(dir, 'src/configs'), { recursive: true })
    mkdirSync(join(dir, 'src/routes'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0', type: 'module', main: 'src/app.js', scripts: { start: 'node src/app.js' }, dependencies: { express: '^5.1.0', mysql2: '^3.14.0' } }, null, 2))
    writeFileSync(join(dir, 'src/configs/db-config.js'), `import mysql from 'mysql2/promise'\nconst db = mysql.createPool({\n    host: 'localhost',\n    user: 'root',\n    password: 'mysql@sit',\n    database: 'mobile_distributor',\n})\nexport default db\n`)
    writeFileSync(join(dir, 'src/routes/example-route.js'), `import express from 'express'\nconst router = express.Router()\nrouter.get('/', (req, res) => res.json([]))\nexport default router\n`)
    const original = `import express from 'express'\nimport exRouter from './routes/example-route.js'\n\n// embedded marker 9f3a\nconst app = express()\napp.use(express.json())\n\napp.use('/api/examples', exRouter)\n\napp.listen(3000, () => {\n    console.log('Example app listening on port 3000')\n})\n\napp.use((err, req, res, next) => {\n    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } })\n})\n`
    writeFileSync(join(dir, 'src/app.js'), original)
    const cfg = configFor(dir)
    step('teacher: gen --app', node([join(KIT, 'kit/gen.mjs'), dir, '--app', '--config', cfg]))
    const patched = readFileSync(join(dir, 'src/app.js'), 'utf8')
    const kept = original.split('\n').filter(Boolean).every(line => patched.includes(line))
    results.push({ name: 'teacher: original app.js lines kept', passed: kept })
    console.log(`${kept ? 'ok  ' : 'FAIL'} teacher: original app.js lines kept`)
    step('teacher: offline-install', node([join(KIT, 'kit/offline-install.mjs'), dir]))
    step('teacher: selftest', node([join(KIT, 'kit/dev/sandbox.mjs'), dir, '--port', '3996', '--', process.execPath, join(KIT, 'kit/selftest.mjs'), dir, '--config', cfg]), / passed /)
    if (existsSync(join(KIT, 'fixtures/mobile/test-runner.mjs'))) {
        mkdirSync(join(dir, 'tests'), { recursive: true })
        cpSync(join(KIT, 'fixtures/mobile/test-runner.mjs'), join(dir, 'tests/test-runner.mjs'))
        step('teacher: practice test-runner full score', node([join(KIT, 'kit/dev/sandbox.mjs'), dir, '--port', '3995', '--', process.execPath, join(dir, 'tests/test-runner.mjs'), '67130599999']), /TOTAL SCORE\s*:\s*100\s*\/\s*100/)
    }
}

const failed = results.filter(r => !r.passed)
console.log(`\n${results.length - failed.length}/${results.length} steps passed`)
process.exit(failed.length ? 1 : 0)
