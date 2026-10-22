// Inspects a target exam project: finds the SQL/spec files and existing core symbols, writes files with backups.
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', '.idea', '.vscode', 'dist', 'build', 'coverage'])

export function walk(dir, filter, depth = 4) {
    const out = []
    if (!existsSync(dir) || depth < 0) return out
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
        const full = join(dir, name)
        let st
        try { st = statSync(full) } catch { continue }
        if (st.isDirectory()) out.push(...walk(full, filter, depth - 1))
        else if (filter(full)) out.push(full)
    }
    return out
}

export function findSqlFile(project) {
    const candidates = [
        ...walk(project, f => f.endsWith('.sql'), 3),
        ...walk(dirname(project), f => f.endsWith('.sql'), 0)
    ]
    const score = f => (/init[-_]?database/i.test(basename(f)) ? 0 : 1) + (f.startsWith(project) ? 0 : 2)
    return candidates.sort((a, b) => score(a) - score(b))[0] || null
}

export function findSpecFile(project) {
    const candidates = [
        ...walk(project, f => f.endsWith('.md'), 2),
        ...walk(dirname(project), f => f.endsWith('.md'), 0)
    ].filter(f => {
        try {
            const text = readFileSync(f, 'utf8')
            return /Student ID|รหัสนักศึกษา|Endpoint/i.test(text) && /\/api\//.test(text)
        } catch { return false }
    })
    const score = f => (/exam[-_]?spec/i.test(basename(f)) ? 0 : 1) + (f.startsWith(project) ? 0 : 2)
    return candidates.sort((a, b) => score(a) - score(b))[0] || null
}

// Where (if anywhere) does the project already define a symbol?
const SYMBOLS = {
    AppError: /\bclass\s+AppError\b/,
    errorHandler: /\b(function\s+errorHandler\b|const\s+errorHandler\s*=)/,
    notFoundHandler: /\b(function\s+notFoundHandler\b|const\s+notFoundHandler\s*=)/,
    apiResponse: /\b(function\s+apiResponse\b|const\s+apiResponse\s*=)/,
    queryParser: /\b(function\s+queryParser\b|const\s+queryParser\s*=)/,
    pool: /\bcreatePool\s*\(/
}

export function scanSymbols(project) {
    const found = {}
    for (const file of walk(join(project, 'src'), f => /\.(m?js)$/.test(f), 5)) {
        const text = readFileSync(file, 'utf8')
        for (const [name, re] of Object.entries(SYMBOLS)) {
            if (!found[name] && re.test(text) && (name === 'pool' || new RegExp(`export[^\\n]*\\b${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(text))) {
                found[name] = { file, text }
            }
        }
        if (!found.pool && SYMBOLS.pool.test(text)) found.pool = { file, text }
    }
    if (found.pool && !/export\s+default/.test(found.pool.text)) found.poolNotDefault = true
    return found
}

export function importPath(fromFile, toFile) {
    let rel = relative(dirname(fromFile), toFile).split(sep).join('/')
    if (!rel.startsWith('.')) rel = './' + rel
    return rel
}

export class Writer {
    constructor(project, backupDir, { force = false, dry = false } = {}) {
        this.project = project
        this.backupDir = backupDir
        this.force = force
        this.dry = dry
        this.log = []
    }

    // returns true if written
    write(relPath, content, { overwrite = this.force, label = '' } = {}) {
        const full = join(this.project, relPath)
        const exists = existsSync(full)
        if (exists) {
            const current = readFileSync(full, 'utf8')
            if (current === content) { this.log.push(['same', relPath, label]); return false }
            if (!overwrite) { this.log.push(['skip', relPath, label || 'exists (use --force to overwrite)']); return false }
        }
        if (this.dry) { this.log.push([exists ? 'would-overwrite' : 'would-create', relPath, label]); return true }
        if (exists) {
            const backup = join(this.backupDir, relPath)
            mkdirSync(dirname(backup), { recursive: true })
            copyFileSync(full, backup)
        }
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, content)
        this.log.push([exists ? 'overwrite' : 'create', relPath, label])
        return true
    }
}

export function projectName(project) {
    return basename(resolve(project)).replace(/[^\w.-]+/g, '_')
}
