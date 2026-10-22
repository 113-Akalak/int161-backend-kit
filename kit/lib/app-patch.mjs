// Adds what the generated API needs to an existing src/app.js without deleting or reordering any existing line,
// so anything the teacher embedded in the template stays untouched.

export function patchApp(source, { studentId, studentName, secretKey, imports }) {
    const lines = source.split(/\r?\n/)
    const changes = []
    const has = re => re.test(lines.join('\n'))

    const appLine = lines.findIndex(l => /\b(const|let|var)\s+app\s*=\s*express\(\s*\)/.test(l))
    if (appLine === -1) return { ok: false, reason: 'cannot find "const app = express()" in app.js' }

    // 1) imports after the last import line
    const wanted = []
    if (!has(/from\s+["']express["']/)) wanted.push(`import express from "express"`)
    if (!has(/api-router\.js/)) wanted.push(`import apiRouter from "./routes/api-router.js"`)
    if (!has(/\bqueryParser\b/)) wanted.push(`import {queryParser} from "${imports.queryParser}"`)
    const needErrorHandler = !has(/\berrorHandler\b/)
    const needNotFound = !has(/\bnotFoundHandler\b/) && !has(/ROUTE_NOT_FOUND/)
    const handlerNames = [needErrorHandler && 'errorHandler', needNotFound && imports.hasNotFound && 'notFoundHandler'].filter(Boolean)
    if (handlerNames.length) wanted.push(`import {${handlerNames.join(', ')}} from "${imports.errorHandler}"`)
    const needStudentInfo = !has(/student-info/)
    if (needStudentInfo && !has(/\bapiResponse\b/)) wanted.push(`import {apiResponse} from "${imports.apiResponse}"`)
    let lastImport = -1
    lines.forEach((l, i) => { if (/^\s*import\s/.test(l)) lastImport = i })
    if (wanted.length) {
        lines.splice(lastImport + 1, 0, ...wanted)
        changes.push(...wanted.map(w => `+ ${w}`))
    }

    // 2) identity constants
    const idMatch = lines.join('\n').match(/\b(?:const|let|var)\s+(STUDENT_ID|ID|studentId)\s*=\s*['"`]([^'"`]*)['"`]/)
    let idVar = idMatch ? idMatch[1] : 'STUDENT_ID'
    const insertAt = () => {
        let i = -1
        lines.forEach((l, idx) => { if (/^\s*import\s/.test(l)) i = idx })
        return i + 1
    }
    const block = []
    if (!idMatch) {
        block.push(``, `const STUDENT_ID = '${studentId}';`)
    } else if (idMatch[2] !== studentId) {
        changes.push(`! ${idVar} in app.js is '${idMatch[2]}', spec says '${studentId}' — fix it by hand`)
    }
    if (needStudentInfo) {
        if (!has(/\bSTUDENT_NAME\b/)) block.push(`const STUDENT_NAME = ${JSON.stringify(studentName)}`)
        if (!has(/\bSECRET_KEY\b/)) block.push(`const SECRET_KEY = ${JSON.stringify(secretKey)}`)
    }
    let baseVar = (lines.join('\n').match(/\b(?:const|let|var)\s+(BASE_PATH|BASE_URL|basePath|baseUrl|base)\s*=/) || [])[1]
    if (!baseVar) {
        block.push(`const BASE_PATH = \`/api/\${${idVar}}\``)
        baseVar = 'BASE_PATH'
    }
    if (block.length) {
        lines.splice(insertAt(), 0, ...block)
        changes.push(...block.filter(Boolean).map(b => `+ ${b}`))
    }

    // 3) body parser + pagination right after "const app = express()"
    const appIdx = lines.findIndex(l => /\b(const|let|var)\s+app\s*=\s*express\(\s*\)/.test(l))
    const jsonIdx = lines.findIndex(l => /express\.json\(/.test(l))
    const after = []
    if (jsonIdx === -1) after.push(`app.use(express.json())`)
    if (!has(/queryParser\(/)) after.push(`app.use(queryParser())`)
    if (after.length) {
        lines.splice((jsonIdx === -1 ? appIdx : jsonIdx) + 1, 0, ...after)
        changes.push(...after.map(a => `+ ${a}`))
    }

    // 4) routes go before any existing 404/error handler use, else before app.listen, else at the end
    const tail = []
    if (needStudentInfo) {
        tail.push(`app.get(\`\${${baseVar}}/student-info\`, (req, res) => {`,
            `    apiResponse(res, {studentId: ${idVar}, name: STUDENT_NAME, secretKey: SECRET_KEY})`,
            `})`)
    }
    if (!has(/app\.use\([^)]*apiRouter/)) tail.push(`app.use(${baseVar}, apiRouter)`)
    const candidates = [
        lines.findIndex(l => /app\.use\(\s*(errorHandler|notFoundHandler|\(\s*err\b|function\s*\(\s*err\b)/.test(l)),
        lines.findIndex(l => /\bapp\.listen\(/.test(l))
    ].filter(i => i !== -1)
    let routeIdx = candidates.length ? Math.min(...candidates) : lines.length
    // keep a blank line before what we add if the previous line has code
    if (routeIdx > 0 && lines[routeIdx - 1].trim() !== '') { lines.splice(routeIdx, 0, ''); routeIdx++ }
    if (tail.length) {
        lines.splice(routeIdx, 0, ...tail)
        changes.push(...tail.map(t => `+ ${t}`))
    }

    // 5) 404 + error handler right after the routes we added (they must be last)
    const handlers = []
    if (needNotFound) {
        handlers.push(imports.hasNotFound
            ? `app.use(notFoundHandler)`
            : `app.use((req, res) => res.status(404).json({success: false, error: {code: "ROUTE_NOT_FOUND", message: \`Cannot \${req.method} \${req.originalUrl}\`}, timestamp: new Date().toISOString()}))`)
    }
    if (needErrorHandler) handlers.push(`app.use(errorHandler)`)
    if (handlers.length) {
        const routerIdx = lines.findIndex(l => /app\.use\([^)]*apiRouter/.test(l))
        lines.splice(routerIdx + 1, 0, ...handlers)
        changes.push(...handlers.map(h => `+ ${h}`))
    }

    if (!has(/\bapp\.listen\(/)) {
        lines.push(``, `app.listen(process.env.PORT || 3000, () => console.log("Server running on port " + (process.env.PORT || 3000)))`)
        changes.push(`+ app.listen(...)`)
    }
    return { ok: true, code: lines.join('\n'), changes }
}
