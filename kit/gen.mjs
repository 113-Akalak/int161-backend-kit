#!/usr/bin/env node
// INT161 backend kit generator
//
//   node kit/gen.mjs <project>            first run: read SQL + spec -> write config, then generate code
//   node kit/gen.mjs init <project>       only (re)create the config from SQL + spec
//   node kit/gen.mjs build <project>      generate code from the (edited) config
//   node kit/gen.mjs set <project> payments.validation.code=INVALID_PAYMENT_DATA customers.delete.status=200
//                                         change config values (resource by path or table name), then rebuilds
//
// options: --sql <file> --spec <file> --config <file> --id <studentId> --name "<full name>" --secret <key>
//          --password <mysql root password> --force (overwrite generated files; old copies go to kit/work/backup)
//          --app (also add the needed lines to an existing src/app.js) --dry (show what would happen)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSql } from './lib/sql-parser.mjs'
import { parseSpec } from './lib/spec-parser.mjs'
import { buildConfig } from './lib/plan.mjs'
import { mapperFile, repoFile, serviceFile, routeFile, apiRouterFile, appFile, dbConfigFile } from './lib/templates.mjs'
import { findSqlFile, findSpecFile, scanSymbols, importPath, Writer, projectName } from './lib/project.mjs'
import { patchApp } from './lib/app-patch.mjs'

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const CORE = join(KIT, 'core')
const c = {
    red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`,
    cyan: s => `\x1b[36m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`
}

function parseArgs(argv) {
    const args = { _: [] }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a.startsWith('--')) {
            const name = a.slice(2)
            if (['force', 'app', 'dry', 'help'].includes(name)) args[name] = true
            else args[name] = argv[++i]
        } else args._.push(a)
    }
    return args
}

const args = parseArgs(process.argv.slice(2))
let [command, projectArg] = args._
if (!['init', 'build', 'set'].includes(command)) { projectArg = command; command = 'auto' }
if (args.help || !projectArg) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
    process.exit(args.help ? 0 : 1)
}
const project = resolve(projectArg)
if (!existsSync(project)) {
    console.error(c.red(`Project folder not found: ${project}`))
    process.exit(1)
}
const configPath = resolve(args.config || join(KIT, 'work', `${projectName(project)}.config.json`))

function init() {
    const sqlFile = args.sql ? resolve(args.sql) : findSqlFile(project)
    if (!sqlFile || !existsSync(sqlFile)) {
        console.error(c.red('No .sql file found. Pass it with --sql <path-to-init-database.sql>'))
        process.exit(1)
    }
    const specFile = args.spec ? resolve(args.spec) : findSpecFile(project)
    const sqlMeta = parseSql(readFileSync(sqlFile, 'utf8'))
    if (!sqlMeta.tables.length) {
        console.error(c.red(`No CREATE TABLE found in ${sqlFile}`))
        process.exit(1)
    }
    const spec = specFile ? parseSpec(readFileSync(specFile, 'utf8')) : null
    const cfg = buildConfig(sqlMeta, spec, { studentId: args.id, studentName: args.name, secretKey: args.secret, password: args.password })
    cfg.sqlFile = sqlFile
    cfg.specFile = specFile
    cfg.project = project
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n')

    console.log(c.bold('\n== Config created =='))
    console.log(`SQL    : ${sqlFile}`)
    console.log(`Spec   : ${specFile || c.yellow('(none found — DTOs use SQL defaults; pass --spec to use the exam spec)')}`)
    console.log(`Config : ${c.cyan(configPath)}`)
    console.log(`Student: ${cfg.studentId} / ${cfg.studentName} / ${cfg.secretKey}   DB: ${cfg.database}`)
    for (const r of cfg.resources) {
        console.log(`\n  ${c.bold('/' + r.path)}  ${c.dim(`table ${r.table}, PK ${r.primaryKey.join('+')}${r.autoIncrement ? ' (auto)' : ''}, list ${r.listPagination}, delete ${r.delete.status}`)}`)
        console.log(`    summary: ${Object.keys(r.summary).join(', ')}`)
        console.log(`    detail : ${Object.keys(r.detail).join(', ')}`)
        if (r.children.length) console.log(`    nested : ${r.children.map(ch => `/${r.path}/:id/${ch.path}`).join(', ')}`)
        if (Object.keys(r.valueHints).length) console.log(c.dim(`    values : ${Object.entries(r.valueHints).map(([k, v]) => `${k}=${v.join('|')}`).join('  ')}`))
    }
    for (const w of cfg.warnings) console.log(c.yellow(`  ! ${w}`))
    return cfg
}

function build(cfg) {
    const writer = new Writer(project, join(KIT, 'work', 'backup', `${projectName(project)}-${new Date().toISOString().replace(/[:.]/g, '-')}`), { force: args.force, dry: args.dry })
    const found = scanSymbols(project)
    const P = rel => join(project, rel)

    // core files: reuse what the project already has, otherwise copy ours
    const core = {
        db: { symbol: 'pool', path: 'src/configs/db-config.js', content: () => dbConfigFile(cfg) },
        appError: { symbol: 'AppError', path: 'src/middlewares/error-handler.js', content: () => readFileSync(join(CORE, 'src/middlewares/error-handler.js'), 'utf8') },
        apiResponse: { symbol: 'apiResponse', path: 'src/mappers/api-response.js', content: () => readFileSync(join(CORE, 'src/mappers/api-response.js'), 'utf8') },
        queryParser: { symbol: 'queryParser', path: 'src/middlewares/pagination-middleware.js', content: () => readFileSync(join(CORE, 'src/middlewares/pagination-middleware.js'), 'utf8') }
    }
    const located = {}
    const ours = new Set()
    const notes = []
    const writeCore = item => {
        let target = item.path
        const firstLine = text => text.split('\n', 1)[0]
        if (existsSync(P(target)) && firstLine(readFileSync(P(target), 'utf8')) !== firstLine(item.content())) target = target.replace(/\.js$/, '-kit.js')
        writer.write(target, item.content(), { overwrite: true, label: `core ${item.symbol}` })
        return P(target)
    }
    for (const [name, item] of Object.entries(core)) {
        const existing = found[item.symbol]
        if (existing && !(name === 'db' && found.poolNotDefault)) {
            located[name] = existing.file
            notes.push(`reuse ${item.symbol} from ${relative(project, existing.file)}`)
            continue
        }
        located[name] = writeCore(item)
        ours.add(name)
    }
    if (found.AppError) {
        const ctor = found.AppError.text.match(/constructor\s*\(([^)]*)\)/)
        if (ctor && !/^\s*message\b/.test(ctor[1])) notes.push(c.yellow(`AppError constructor is (${ctor[1]}) — generated code calls new AppError(message, statusCode, errorCode); adjust if the order differs`))
    }
    // errorHandler / notFoundHandler for app.js: the project's own if it has one, else ours
    let handlerFile = found.errorHandler?.file
    let hasNotFound = Boolean(found.notFoundHandler) && found.notFoundHandler.file === handlerFile
    if (!handlerFile) {
        handlerFile = ours.has('appError') ? located.appError : writeCore(core.appError)
        hasNotFound = true
    }

    const paths = from => ({
        db: importPath(P(from), located.db),
        appError: importPath(P(from), located.appError),
        apiResponse: importPath(P(from), located.apiResponse)
    })
    for (const r of cfg.resources) {
        // a mapper the template already ships (not written by this kit) is left alone; ours goes next to it
        let mapperRel = `src/mappers/${r.file}-mapper.js`
        const mapperCode = mapperFile(r)
        if (existsSync(P(mapperRel))) {
            const current = readFileSync(P(mapperRel), 'utf8')
            if (current.split('\n', 1)[0] !== mapperCode.split('\n', 1)[0]) {
                mapperRel = `src/mappers/${r.file}-dto-mapper.js`
                notes.push(c.yellow(`src/mappers/${r.file}-mapper.js came with the template — kept it, generated ${mapperRel} for the service`))
            }
        }
        writer.write(mapperRel, mapperCode.replace(`// src/mappers/${r.file}-mapper.js`, `// ${mapperRel}`))
        writer.write(`src/repositories/${r.file}-repo.js`, repoFile(r, paths(`src/repositories/${r.file}-repo.js`)))
        writer.write(`src/services/${r.file}-service.js`, serviceFile(r, cfg.resources, { ...paths(`src/services/${r.file}-service.js`), mapper: importPath(P(`src/services/${r.file}-service.js`), P(mapperRel)) }))
        writer.write(`src/routes/${r.file}-route.js`, routeFile(r, paths(`src/routes/${r.file}-route.js`)))
    }
    writer.write('src/routes/api-router.js', apiRouterFile(cfg.resources))

    // app.js
    const appRel = 'src/app.js'
    const fromApp = target => importPath(P(appRel), target)
    if (!existsSync(P(appRel))) {
        writer.write(appRel, appFile(cfg, {
            queryParserFromApp: fromApp(located.queryParser),
            errorHandlerFromApp: fromApp(handlerFile),
            apiResponseFromApp: fromApp(located.apiResponse)
        }), { label: 'new app.js' })
    } else {
        const result = patchApp(readFileSync(P(appRel), 'utf8'), {
            studentId: cfg.studentId, studentName: cfg.studentName, secretKey: cfg.secretKey,
            imports: { queryParser: fromApp(located.queryParser), errorHandler: fromApp(handlerFile), apiResponse: fromApp(located.apiResponse), hasNotFound }
        })
        if (!result.ok) notes.push(c.red(`app.js not patched: ${result.reason}`))
        else if (!result.changes.length) notes.push('app.js already has everything')
        else if (args.app) {
            writer.write(appRel, result.code, { overwrite: true, label: 'patched app.js (lines added only)' })
            notes.push(...result.changes.map(ch => c.dim('  app.js ' + ch)))
        } else {
            notes.push(c.yellow('app.js exists — lines to add (or rerun with --app to add them automatically, nothing is removed):'))
            notes.push(...result.changes.map(ch => '    ' + ch))
        }
    }

    // package.json sanity
    const pkgPath = P('package.json')
    if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        if (pkg.type !== 'module') notes.push(c.red('package.json has no "type": "module" — import/export will fail. Add  "type": "module"'))
        for (const dep of ['express', 'mysql2']) {
            if (!pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]) notes.push(c.red(`package.json does not list ${dep} — run: npm install ${dep}  (offline: node <kit>/kit/offline-install.mjs <project>)`))
        }
        if (!pkg.scripts?.start) notes.push(c.yellow('package.json has no "start" script — add  "start": "node src/app.js"'))
        if (!pkg.scripts?.dev) notes.push(c.dim('auto-restart: npx nodemon src/app.js  (or add  "dev": "nodemon src/app.js"  and run npm run dev)'))
    } else {
        writer.write('package.json', JSON.stringify({
            name: projectName(project).toLowerCase(), version: '1.0.0', type: 'module', main: 'src/app.js',
            scripts: { start: 'node src/app.js', dev: 'nodemon src/app.js' },
            dependencies: { express: '^5.1.0', mysql2: '^3.14.0' },
            devDependencies: { nodemon: '^3.1.14' }
        }, null, 2) + '\n', { label: 'new package.json' })
    }

    console.log(c.bold(`\n== ${args.dry ? 'Dry run' : 'Generated'} in ${project} ==`))
    const icon = { create: c.green('+'), overwrite: c.yellow('~'), same: c.dim('='), skip: c.yellow('-'), 'would-create': '+?', 'would-overwrite': '~?' }
    for (const [kind, file, label] of writer.log) console.log(`  ${icon[kind] || kind} ${file}${label ? c.dim('  ' + label) : ''}`)
    for (const n of notes) console.log('  ' + n)
    if (writer.log.some(([k]) => k === 'skip')) console.log(c.yellow('\n  Some files were kept because they already exist. Rerun with --force to regenerate them (backups go to kit/work/backup).'))
    if (writer.log.some(([k]) => k === 'overwrite')) console.log(c.dim(`  Backups: ${writer.backupDir}`))
    const short = p => { const rel = relative(process.cwd(), p) || '.'; return rel.split('..').length > 3 ? p : rel }
    console.log(`\nNext: ${c.cyan('npm start')}  then  ${c.cyan(`node ${short(join(KIT, 'kit/selftest.mjs'))} ${short(project)}`)}`)
}

// set a.b.c=value on the config; the first segment may be a resource path/table
function setValues(cfg, assignments) {
    for (const item of assignments) {
        const eq = item.indexOf('=')
        if (eq === -1) { console.error(c.red(`expected key=value, got "${item}"`)); process.exit(1) }
        const keys = item.slice(0, eq).split('.')
        let raw = item.slice(eq + 1)
        let value
        try { value = JSON.parse(raw) } catch { value = raw }
        // [A,B] without quotes (easier to type in cmd) -> ["A","B"]
        if (typeof value === 'string' && /^\[.*\]$/.test(raw.trim())) {
            value = raw.trim().slice(1, -1).split(',').map(x => x.trim()).filter(Boolean)
                .map(x => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x.replace(/^["']|["']$/g, '')))
        }
        let target = cfg
        const resource = cfg.resources.find(r => r.path === keys[0] || r.table === keys[0])
        if (resource) { target = resource; keys.shift() }
        for (const k of keys.slice(0, -1)) {
            if (target[k] === undefined || typeof target[k] !== 'object') target[k] = {}
            target = target[k]
        }
        const last = keys.at(-1)
        const before = JSON.stringify(target[last])
        target[last] = value
        console.log(`  ${item.slice(0, eq)}: ${c.dim(before ?? 'undefined')} -> ${c.cyan(JSON.stringify(value))}`)
    }
    if (args.dry) console.log(c.dim('  (--dry: config not saved)'))
    else writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n')
}

let cfg
if (command === 'set') {
    if (!existsSync(configPath)) {
        console.error(c.red(`No config yet: ${configPath}\nRun: node kit/gen.mjs init ${projectArg}`))
        process.exit(1)
    }
    cfg = JSON.parse(readFileSync(configPath, 'utf8'))
    setValues(cfg, args._.slice(2))
    args.force = true
} else if (command === 'init' || (command === 'auto' && (!existsSync(configPath) || args.sql || args.spec))) {
    cfg = init()
    if (command === 'init') {
        console.log(`\nEdit the config if needed, then: ${c.cyan(`node kit/gen.mjs build ${projectArg}`)}`)
        process.exit(0)
    }
} else {
    if (!existsSync(configPath)) {
        console.error(c.red(`No config yet: ${configPath}\nRun: node kit/gen.mjs init ${projectArg}`))
        process.exit(1)
    }
    cfg = JSON.parse(readFileSync(configPath, 'utf8'))
    console.log(c.dim(`Using config ${configPath}`))
}
build(cfg)
