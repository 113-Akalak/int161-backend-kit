#!/usr/bin/env node
// Rebuilds vendor/node_modules.zip (needs internet): installs the pinned dependencies into work/vendor-build and zips them.
//
//   node kit/dev/build-vendor.mjs
import { execSync } from 'node:child_process'
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createZip } from '../lib/zip.mjs'

const KIT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const kitPkg = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8'))
const deps = kitPkg.vendorDependencies
const build = join(KIT, 'work', 'vendor-build')
rmSync(build, { recursive: true, force: true })
mkdirSync(build, { recursive: true })
writeFileSync(join(build, 'package.json'), JSON.stringify({ name: 'vendor-build', private: true, type: 'module', dependencies: deps }, null, 2))
execSync('npm install --omit=dev --no-audit --no-fund --ignore-scripts', { cwd: build, stdio: 'inherit' })

const entries = []
function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name)
        const st = lstatSync(full)
        if (st.isSymbolicLink() || name === '.bin') continue
        if (st.isDirectory()) walk(full)
        else entries.push({ name: relative(build, full).split('\\').join('/'), data: readFileSync(full), mtime: new Date('2026-01-01T00:00:00Z') })
    }
}
walk(join(build, 'node_modules'))
writeFileSync(join(KIT, 'vendor', 'node_modules.zip'), createZip(entries))

const versions = readdirSync(join(build, 'node_modules')).filter(n => !n.startsWith('.')).flatMap(n => {
    const dirs = n.startsWith('@') ? readdirSync(join(build, 'node_modules', n)).map(x => `${n}/${x}`) : [n]
    return dirs.map(d => `${d}@${JSON.parse(readFileSync(join(build, 'node_modules', d, 'package.json'), 'utf8')).version}`)
})
writeFileSync(join(KIT, 'vendor', 'VERSIONS.txt'), `# built ${new Date().toISOString().slice(0, 10)} with node ${process.version}\n# top level: ${Object.entries(deps).map(([k, v]) => `${k}@${v}`).join(' ')}\n${versions.join('\n')}\n`)
console.log(`vendor/node_modules.zip: ${entries.length} files, ${versions.length} packages`)
