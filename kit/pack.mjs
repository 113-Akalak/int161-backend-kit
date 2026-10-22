#!/usr/bin/env node
// Zip the project for submission, without node_modules (and other junk), as <studentId>_exam.zip next to the project.
//
//   node kit/pack.mjs <project> [--id 67130599999] [--out <file.zip>] [--flat]
//
// --flat puts files at the zip root instead of inside a <project-folder>/ directory.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createZip, readZip } from './lib/zip.mjs'
import { projectName } from './lib/project.mjs'

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const argv = process.argv.slice(2)
const opt = name => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : argv[i + 1] }
const projectArg = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
if (!projectArg) {
    console.log('usage: node kit/pack.mjs <project> [--id <studentId>] [--out file.zip] [--flat]')
    process.exit(1)
}
const project = resolve(projectArg)

let studentId = opt('id')
if (!studentId) {
    const configPath = join(KIT, 'work', `${projectName(project)}.config.json`)
    if (existsSync(configPath)) studentId = JSON.parse(readFileSync(configPath, 'utf8')).studentId
}
if (!studentId && existsSync(join(project, 'src/app.js'))) {
    studentId = readFileSync(join(project, 'src/app.js'), 'utf8').match(/(?:STUDENT_ID|ID)\s*=\s*['"`](\d{6,})['"`]/)?.[1]
}
if (!studentId) {
    console.error('Cannot find the student id. Pass --id <studentId>')
    process.exit(1)
}

const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.idea', '.vscode', '.DS_Store', '__MACOSX', 'coverage'])
const EXCLUDE_FILES = [/^\.DS_Store$/, /^Thumbs\.db$/, /_exam\.zip$/, /^test-report-.*\.json$/, /\.log$/]

const files = []
function walk(dir) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        const st = statSync(full)
        if (st.isDirectory()) {
            if (!EXCLUDE_DIRS.has(name)) walk(full)
        } else if (!EXCLUDE_FILES.some(re => re.test(name))) {
            files.push({ full, st })
        }
    }
}
walk(project)

const root = argv.includes('--flat') ? '' : basename(project) + '/'
const entries = files.map(f => ({ name: root + relative(project, f.full).split('\\').join('/'), data: readFileSync(f.full), mtime: f.st.mtime }))
const out = resolve(opt('out') || join(dirname(project), `${studentId}_exam.zip`))
writeFileSync(out, createZip(entries))

// verify by reading it back
const check = readZip(readFileSync(out))
const bad = check.find((e, i) => !e.data.equals(entries[i].data))
if (check.length !== entries.length || bad) {
    console.error('Zip verification failed — compress the folder by hand (without node_modules).')
    process.exit(1)
}
const size = statSync(out).size
console.log(`Created ${out}`)
console.log(`  ${entries.length} files, ${(size / 1024).toFixed(1)} KB, node_modules excluded, verified OK`)
for (const must of ['src/app.js', 'package.json']) {
    if (!entries.some(e => e.name === root + must)) console.log(`  ! ${must} is missing from the project`)
}
if (size > 5 * 1024 * 1024) console.log('  ! larger than 5 MB — check that no big files were included')
