// Reads an exam-spec .md and pulls out what can be inferred mechanically:
// student identity, endpoint list (method + path + status), and the JSON examples that follow each endpoint.
// Everything here is best effort: anything it cannot read is simply left out and the generator falls back to SQL defaults.

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function pick(text, patterns) {
    for (const re of patterns) {
        const m = text.match(re)
        if (m) return m[1].trim()
    }
    return null
}

export function parseIdentity(text) {
    return {
        studentId: pick(text, [/Student ID\)?[^`\n]*`(\d{6,})`/i, /รหัสนักศึกษา[^`\n]*`(\d{6,})`/, /STUDENT_ID\s*=\s*['"](\d{6,})['"]/]),
        studentName: pick(text, [/ชื่อ\s*-?\s*นามสกุล[^`\n]*`([^`]+)`/, /Name\)?[^`\n]*`([^`]+)`/i]),
        secretKey: pick(text, [/Secret Key\)?[^`\n]*`([^`]+)`/i, /รหัสลับ[^`\n]*`([^`]+)`/])
    }
}

// Lenient JSON: tolerate // comments, trailing commas and "..." placeholders
function looseJson(text) {
    const cleaned = text
        .replace(/("(?:\\.|[^"\\])*")|\/\/.*$/gm, (m, str) => str ?? '')
        .replace(/,\s*\.\.\.\s*/g, ',')
        .replace(/\[\s*\.\.\.\s*\]/g, '[]')
        .replace(/,(\s*[}\]])/g, '$1')
    try { return JSON.parse(cleaned) } catch { return null }
}

// "/api/67130599999/products/:id" or "/products/:id" -> "/products/:id"
function normalisePath(raw, studentId) {
    let p = raw.trim().replace(/\?.*$/, '').replace(/\/+$/, '')
    p = p.replace(/^\/api\/(?:\d+|:studentId|<[^>]+>|\{[^}]+\})/, '')
    if (studentId) p = p.replace(new RegExp(`^/api/${studentId}`), '')
    p = p.replace(/\{(\w+)\}/g, ':$1').replace(/<(\w+)>/g, ':$1')
    return p || '/'
}

export function parseEndpoints(text, studentId) {
    const lines = text.split(/\r?\n/)
    const events = []
    let inCode = false
    let codeLang = ''
    let code = []
    let lastHeading = ''
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const fence = line.match(/^\s*```(\w*)/)
        if (fence) {
            if (!inCode) { inCode = true; codeLang = fence[1].toLowerCase(); code = [] }
            else {
                inCode = false
                if (!codeLang || codeLang === 'json') {
                    const json = looseJson(code.join('\n'))
                    if (json && typeof json === 'object') events.push({ kind: 'json', json, line: i })
                }
            }
            continue
        }
        if (inCode) { code.push(line); continue }
        if (/^\s*#{1,6}\s|^\s*\*\*\d*\)?\s*\[/.test(line)) lastHeading = line
        for (const m of line.matchAll(/`(?:(GET|POST|PUT|PATCH|DELETE)\s+)?(\/[A-Za-z0-9_\-/:{}<>.]+(?:\?[^`]*)?)`/g)) {
            const path = normalisePath(m[2], studentId)
            if (path === '/' || path.includes('...') || /^\/(api|src|tests|database)\b/.test(path) || /\.(js|sql|md|mjs|json)$/.test(path)) continue
            const context = [line, lines[i - 1] || '', lines[i - 2] || '', lastHeading].join(' ')
            const method = m[1] || METHODS.find(x => new RegExp(`\\[${x}\\]|\\b${x}\\b`).test(line))
                || METHODS.find(x => new RegExp(`\\[${x}\\]|\`${x}\``).test(context)) || 'GET'
            // statuses on this line or in the next few lines before the next endpoint
            const following = []
            if (!/^\s*\|/.test(line)) {
                for (const next of lines.slice(i + 1, i + 4)) {
                    if (/`(?:[A-Z]+\s+)?\//.test(next) || /^\s*(```|#)/.test(next)) break
                    following.push(next)
                }
            }
            const around = [line, ...following].join(' ')
            const statuses = [...around.matchAll(/\b(200|201|204|400|404|409)\b/g)].map(x => Number(x[1]))
            const message = line.match(/\{\s*"message"\s*:\s*"([^"]+)"\s*\}/)
            events.push({ kind: 'endpoint', method, path, statuses: [...new Set(statuses)], message: message ? message[1] : null, line: i })
            // inline example body on the same line, e.g. body `{"checkNumber":"HQ1","amount":10}`
            for (const inline of line.matchAll(/`(\{[^`]*\})`/g)) {
                const json = looseJson(inline[1])
                if (json && Object.keys(json).length && !('message' in json && Object.keys(json).length === 1)) events.push({ kind: 'json', json, line: i })
            }
        }
    }

    // attach each JSON block to the closest endpoint before it
    const endpoints = []
    let current = null
    for (const ev of events) {
        if (ev.kind === 'endpoint') {
            current = { method: ev.method, path: ev.path, statuses: ev.statuses, message: ev.message, response: null, request: null }
            endpoints.push(current)
        } else if (current) {
            if ('success' in ev.json || 'data' in ev.json) current.response ??= ev.json
            else current.request ??= ev.json
        }
    }
    // the same endpoint can be mentioned twice (heading + checklist): merge
    const merged = new Map()
    for (const ep of endpoints) {
        const key = `${ep.method} ${ep.path.replace(/:\w+/g, ':x')}`
        const prev = merged.get(key)
        if (!prev) { merged.set(key, ep); continue }
        prev.response ??= ep.response
        prev.request ??= ep.request
        prev.message ??= ep.message
        prev.statuses = [...new Set([...prev.statuses, ...ep.statuses])]
    }
    return [...merged.values()].filter(ep => ep.path !== '/student-info')
}

export function parseSpec(text) {
    const identity = parseIdentity(text)
    const db = pick(text, [/Database:\s*`(\w+)`/i])
    return { ...identity, database: db, endpoints: parseEndpoints(text, identity.studentId) }
}
