#!/usr/bin/env node
// Fallback when "npm install" cannot run (no internet / npm error): unpack the bundled node_modules
// (express 5 + mysql2 + http-status, pure JavaScript, works on Windows/macOS/Linux) into the project.
//
//   node kit/offline-install.mjs <project> [--force]
//
// Existing packages are kept unless --force. Packages the project needs but the bundle lacks are listed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readZip } from './lib/zip.mjs'

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const argv = process.argv.slice(2)
const projectArg = argv.find(a => !a.startsWith('--'))
if (!projectArg) {
    console.log('usage: node kit/offline-install.mjs <project> [--force]')
    process.exit(1)
}
const project = resolve(projectArg)
const force = argv.includes('--force')
const bundle = join(KIT, 'vendor', 'node_modules.zip')
if (!existsSync(bundle)) {
    console.error(`Bundle not found: ${bundle}`)
    process.exit(1)
}

const entries = readZip(readFileSync(bundle))
const target = join(project, 'node_modules')
const topLevel = name => {
    const parts = name.replace(/^node_modules\//, '').split('/')
    return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}
// decide per package before writing anything, so a half-written package is never mistaken for an installed one
const installedBefore = new Set([...new Set(entries.map(e => topLevel(e.name)))]
    .filter(pkg => existsSync(join(target, pkg, 'package.json'))))
let written = 0
const skippedPackages = new Set()
for (const e of entries) {
    const rel = e.name.replace(/^node_modules\//, '')
    const dest = join(target, rel)
    if (!dest.startsWith(target + sep)) continue          // never write outside node_modules
    if (!force && installedBefore.has(topLevel(e.name))) {
        skippedPackages.add(topLevel(e.name))
        continue
    }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, e.data)
    written++
}
console.log(`Unpacked ${written} files into ${target}${skippedPackages.size ? ` (kept ${skippedPackages.size} packages already installed; --force to replace)` : ''}`)

// compare with the project's package.json
const pkgPath = join(project, 'package.json')
if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const wanted = { ...pkg.dependencies, ...pkg.devDependencies }
    const missing = Object.keys(wanted).filter(name => !existsSync(join(target, name, 'package.json')))
    for (const [name, range] of Object.entries(wanted)) {
        const p = join(target, name, 'package.json')
        if (!existsSync(p)) continue
        const version = JSON.parse(readFileSync(p, 'utf8')).version
        const major = String(range).match(/\d+/)?.[0]
        if (major && version.split('.')[0] !== major) console.log(`  ! ${name} ${version} installed, package.json wants ${range}`)
    }
    if (missing.length) console.log(`  ! not in the bundle: ${missing.join(', ')} — remove them from package.json if the code does not import them`)
    else console.log('  All dependencies in package.json are present.')
}
