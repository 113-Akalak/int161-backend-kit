#!/usr/bin/env node
// Practice sandbox: runs a project's src/app.js against an in-memory SQLite copy of init-database.sql,
// so the API can be tried without MySQL. Needs Node 22.15+ (node:sqlite + module.registerHooks).
// Real exam machines use MySQL; this is only for practising and for testing the kit itself.
//
//   node kit/dev/sandbox.mjs <project> [--sql file] [--port 3999] [-- <command> ...]
//
// With "-- <command>", the command runs with BASE_URL set and the sandbox exits when it finishes.
// Without it, the server keeps running until Ctrl+C.
import { registerHooks } from 'node:module'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findSqlFile, scanSymbols } from '../lib/project.mjs'

const argv = process.argv.slice(2)
const dash = argv.indexOf('--')
const own = dash === -1 ? argv : argv.slice(0, dash)
const command = dash === -1 ? null : argv.slice(dash + 1)
const opt = name => { const i = own.indexOf(`--${name}`); return i === -1 ? null : own[i + 1] }
const project = resolve(own.find((a, i) => !a.startsWith('--') && !own[i - 1]?.startsWith('--')) || '.')
const sql = resolve(opt('sql') || findSqlFile(project) || '')
const port = opt('port') || '3999'

process.env.INIT_SQL = sql
process.env.PORT = port
const poolFile = scanSymbols(project).pool?.file || join(project, 'src/configs/db-config.js')
const poolUrl = pathToFileURL(poolFile).href
const shimUrl = new URL('./sqlite-db.mjs', import.meta.url).href

registerHooks({
    resolve(specifier, context, next) {
        const result = next(specifier, context)
        return result.url === poolUrl ? { url: shimUrl, shortCircuit: true } : result
    }
})

// app.js may hardcode app.listen(3000): force the sandbox port instead
const listen = net.Server.prototype.listen
net.Server.prototype.listen = function (...a) {
    if (typeof a[0] === 'number' || /^\d+$/.test(String(a[0]))) a[0] = Number(port)
    return listen.apply(this, a)
}

await import(pathToFileURL(join(project, 'src/app.js')).href)
await new Promise(r => setTimeout(r, 300))
console.log(`[sandbox] SQLite from ${sql} on http://localhost:${port}`)

if (command) {
    const child = spawn(command[0], command.slice(1), {
        stdio: 'inherit',
        env: { ...process.env, BASE_URL: `http://localhost:${port}` }
    })
    child.on('close', code => process.exit(code ?? 1))
    setTimeout(() => { console.error('[sandbox] timeout'); process.exit(1) }, 120000)
}
