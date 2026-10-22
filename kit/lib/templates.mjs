// Code templates for the generated project files (teacher layout: routes -> services -> repositories, mapper, AppError)
// Generated code depends only on express + mysql2, which every course template already has.
import { camel, pascal } from './naming.mjs'

const IDENT = /^[A-Za-z_$][\w$]*$/
const key = k => (IDENT.test(k) ? k : JSON.stringify(k))
const str = s => JSON.stringify(s)
const list = arr => `[${arr.map(str).join(', ')}]`
const prop = (obj, k) => (IDENT.test(k) ? `${obj}.${k}` : `${obj}[${str(k)}]`)

function keyVars(r) {
    return r.primaryKey.length === 1 ? ['id'] : r.primaryKey.map(camel)
}

function keyParamsRoute(r) {
    return r.primaryKey.length === 1 ? '/:id' : r.primaryKey.map(c => `/:${camel(c)}`).join('')
}

function keyArgsFromReq(r) {
    return keyVars(r).map(v => `req.params.${v}`).join(', ')
}

function keyLabel(r) {
    const vars = keyVars(r)
    return vars.length === 1 ? `'\${id}'` : `'${vars.map(v => `\${${v}}`).join('/')}'`
}

function dtoBody(r, dto, convert) {
    return Object.entries(dto).map(([k, src]) => {
        const category = r.columns[src]
        let value = prop('entity', src)
        if (category === 'decimal') { value = `toNumber(${value})`; convert.add('toNumber') }
        else if (category === 'date') { value = `toDateOnly(${value})`; convert.add('toDateOnly') }
        else if (category === 'boolean' && r.booleanAs === 'boolean') { value = `toBoolean(${value})`; convert.add('toBoolean') }
        return `            ${key(k)}: ${value},`
    }).join('\n')
}

// ---------------------------------------------------------------- mapper
export function mapperFile(r) {
    const convert = new Set()
    const summary = dtoBody(r, r.summary, convert)
    const detail = dtoBody(r, r.detail, convert)
    const fieldMap = {}
    const writable = [...r.writable, ...r.primaryKey.filter(c => !r.autoIncrement && !r.writable.includes(c))]
    for (const col of writable) {
        fieldMap[col] = col
        fieldMap[camel(col)] = col
    }
    for (const [k, src] of Object.entries({ ...r.summary, ...r.detail })) {
        if (writable.includes(src) && !(k in fieldMap)) fieldMap[k] = src
    }
    const helpers = []
    if (convert.has('toNumber')) helpers.push(`// DECIMAL ถูกส่งมาเป็น string ("48900.00") ถ้า db-config ไม่ได้ตั้ง decimalNumbers: true
function toNumber(value) {
    return value === null || value === undefined ? value : Number(value)
}`)
    if (convert.has('toDateOnly')) helpers.push(`// DATE -> "YYYY-MM-DD" (กันวันเลื่อนเพราะ timezone เมื่อ mysql2 คืนค่าเป็น Date)
function toDateOnly(value) {
    if (!(value instanceof Date)) return value
    const pad = n => String(n).padStart(2, "0")
    return \`\${value.getFullYear()}-\${pad(value.getMonth() + 1)}-\${pad(value.getDate())}\`
}`)
    if (convert.has('toBoolean')) helpers.push(`// BOOLEAN ใน MySQL คือ TINYINT(1) -> คืนเป็น true/false
function toBoolean(value) {
    return value === null || value === undefined ? value : Boolean(Number(value))
}`)

    return `// src/mappers/${r.file}-mapper.js  (รูปแบบเดียวกับสไลด์ Week-07 "Mapper")
// DTO: แปลง entity จาก DB -> JSON ที่ตกลงกับ client (เลือกเฉพาะฟิลด์ / เปลี่ยนชื่อ)
export default class ${r.entity}Mapper {
    // Summary DTO (ใช้กับ list GET /${r.path})
    static toSummaryDTO(entity) {
        return {
${summary}
        }
    }

    // Detail DTO (ใช้กับ GET /${r.path}${keyParamsRoute(r)})
    static toDetailDTO(entity) {
        return {
${detail}
        }
    }

    // หลายแถว: default = summary และต้อง copy totalItems กลับไป (array.map สร้าง array ใหม่ totalItems จะหาย)
    static maps(entities, viewType = "summary") {
        const {totalItems} = entities
        const entitiesMap = viewType == "full"
            ? entities.map(item => this.toDetailDTO(item))
            : entities.map(item => this.toSummaryDTO(item))
        if (totalItems !== undefined) entitiesMap.totalItems = totalItems
        return entitiesMap
    }

    // แถวเดียว: default = full/detail
    static map(entity, viewType = "full") {
        return viewType == "summary" ? this.toSummaryDTO(entity) : this.toDetailDTO(entity)
    }

    // Request body (snake_case หรือ camelCase) -> คอลัมน์ในตาราง, ฟิลด์ที่ไม่รู้จักถูกตัดทิ้ง
    static toEntity(body = {}) {
        const entity = {}
        for (const [field, value] of Object.entries(body ?? {})) {
            if (FIELD_MAP[field] && value !== undefined) entity[FIELD_MAP[field]] = value
        }
        return entity
    }
}

const FIELD_MAP = {
${Object.entries(fieldMap).map(([k, v]) => `    ${key(k)}: ${str(v)},`).join('\n')}
}
${helpers.length ? '\n' + helpers.join('\n\n') + '\n' : ''}`
}

// ---------------------------------------------------------------- repository
export function repoFile(r, paths) {
    const a = r.alias
    const vars = keyVars(r)
    const keyWhere = r.primaryKey.map(c => `${a}.${c} = ?`).join(' AND ')
    const keyWherePlain = r.primaryKey.map(c => `${c} = ?`).join(' AND ')
    const joins = r.joins.map(j => {
        return `\n    LEFT JOIN ${j.table} ${j.alias} ON ${a}.${j.column} = ${j.alias}.${j.references}`
    }).join('')
    const joinSelects = r.joins.map(j => `, ${j.alias}.${j.select} AS ${j.as}`).join('')
    const sortable = {}
    for (const col of r.sortable) { sortable[col] = col; sortable[camel(col)] = col }
    for (const [k, src] of Object.entries({ ...r.summary, ...r.detail })) if (r.columns[src] && !(k in sortable)) sortable[k] = src
    const createReturn = r.autoIncrement
        ? `    return result.insertId          // id ที่ AUTO_INCREMENT สร้าง`
        : vars.length === 1
            ? `    return ${prop('entity', r.primaryKey[0])}       // PK ไม่ใช่ AUTO_INCREMENT: ใช้ค่าที่ส่งมา`
            : `    return [${r.primaryKey.map(c => prop('entity', c)).join(', ')}]  // Composite PK`
    const uniqueFns = r.unique.filter(c => !r.primaryKey.includes(c) || r.primaryKey.length > 1).map(c => `
// ใช้เช็กค่าซ้ำก่อน INSERT/UPDATE (คอลัมน์ UNIQUE)
export async function findBy${pascal(c)}(value) {
    const [rows] = await db.query(\`SELECT * FROM \${TABLE_NAME} WHERE ${c} = ?\`, [value])
    return rows[0] ?? null
}
`).join('')

    return `// src/repositories/${r.file}-repo.js  — SQL ทั้งหมดของตาราง ${r.table} อยู่ที่นี่ที่เดียว
import db from ${str(paths.db)}
import {AppError} from ${str(paths.appError)}

const TABLE_NAME = ${str(r.table)}
const ENTITY_NAME = ${str(r.entity)}
const NOT_FOUND_CODE = ${str(r.notFoundCode)}

// FROM + JOIN ใช้ร่วมกันทั้ง list / count / findOne
const FROM_SQL = \`FROM \${TABLE_NAME} ${a}${joins}\`
const SELECT_SQL = \`SELECT ${a}.*${joinSelects} \${FROM_SQL}\`
const KEY_WHERE = ${str(keyWhere)}
const CREATE_SQL = \`INSERT INTO \${TABLE_NAME} SET ?\`
const UPDATE_SQL = \`UPDATE \${TABLE_NAME} SET ? WHERE ${keyWherePlain}\`
const REMOVE_SQL = \`DELETE FROM \${TABLE_NAME} WHERE ${keyWherePlain}\`

// ?param=value -> WHERE ... (ค่าทุกตัวส่งผ่าน ? เสมอ) เพิ่ม/ลบได้ตามสเปค
const FILTERS = [
${r.filters.map(f => `    {params: ${list(f.params)}, sql: ${str(f.sql)}${f.like ? ', like: true' : ''}},`).join('\n')}
]

// ORDER BY ใช้ ? ไม่ได้ จึง whitelist ชื่อคอลัมน์ (?sort=price&order=desc หรือ ?sort=-price)
const SORTABLE = {
${Object.entries(sortable).map(([k, v]) => `    ${key(k)}: ${str(v)},`).join('\n')}
}
const DEFAULT_SORT = ${str(r.defaultSort)}

function toSqlValue(value) {
    const v = Array.isArray(value) ? value[0] : value
    if (v === "true") return 1
    if (v === "false") return 0
    return v
}

// scope = เงื่อนไขบังคับจาก nested route เช่น {brand_id: 1}
function buildWhere(query = {}, scope = {}) {
    const conditions = []
    const params = []
    for (const [column, value] of Object.entries(scope)) {
        conditions.push(\`${a}.\${column} = ?\`)
        params.push(value)
    }
    for (const filter of FILTERS) {
        const name = filter.params.find(p => query[p] !== undefined && query[p] !== "")
        if (!name) continue
        const value = filter.like ? \`%\${toSqlValue(query[name])}%\` : toSqlValue(query[name])
        conditions.push(filter.sql)
        params.push(...filter.sql.split("?").slice(1).map(() => value))
    }
    return {where: conditions.length ? " WHERE " + conditions.join(" AND ") : "", params}
}

function buildOrderBy(query = {}) {
    let sort = String(query.sort ?? query.sortBy ?? query.sort_by ?? DEFAULT_SORT)
    let order = String(query.order ?? query.sortOrder ?? query.sort_order ?? query.direction ?? "asc")
    if (sort.startsWith("-")) {
        sort = sort.slice(1)
        order = "desc"
    }
    const column = SORTABLE[sort] ?? DEFAULT_SORT
    const direction = order.toLowerCase() === "desc" ? "DESC" : "ASC"
    const tieBreak = column === DEFAULT_SORT ? "" : \`, ${a}.\${DEFAULT_SORT} ASC\`   // ให้ลำดับคงที่ แบ่งหน้าแล้วไม่ซ้ำ
    return \` ORDER BY ${a}.\${column} \${direction}\${tieBreak}\`
}

// COUNT ต้องใช้ WHERE เดียวกับตอนดึงข้อมูล ไม่งั้น total ผิด
export async function count(query = {}, scope = {}) {
    const {where, params} = buildWhere(query, scope)
    const [[{total}]] = await db.query(\`SELECT COUNT(*) AS total \${FROM_SQL}\${where}\`, params)
    return Number(total)
}

export async function findAll(pagination = null, query = {}, scope = {}) {
    const {where, params} = buildWhere(query, scope)
    const SQL = SELECT_SQL + where + buildOrderBy(query)
    if (!pagination) {
        const [rows] = await db.query(SQL, params)
        return rows
    }
    const {limit, offset} = pagination
    const [rows] = await db.query(SQL + " LIMIT ? OFFSET ?", [...params, limit, offset])  // ลำดับ [limit, offset] ห้ามสลับ
    rows.totalItems = await count(query, scope)  // ให้ apiResponse เอาไปคำนวณ totalPages
    return rows
}

export async function findOne(${vars.join(', ')}) {
    const [rows] = await db.query(SELECT_SQL + " WHERE " + KEY_WHERE, [${vars.join(', ')}])
    if (rows.length === 0) {
        throw new AppError(\`\${ENTITY_NAME} ${keyLabel(r)} was not found\`, 404, NOT_FOUND_CODE)
    }
    return rows[0]
}

export async function exists(${vars.join(', ')}) {
    const [rows] = await db.query(\`SELECT 1 FROM \${TABLE_NAME} WHERE ${keyWherePlain} LIMIT 1\`, [${vars.join(', ')}])
    return rows.length > 0
}
${uniqueFns}
export async function create(entity) {
    const [result] = await db.query(CREATE_SQL, [entity])
${createReturn}
}

export async function update(${vars.join(', ')}, entity) {
    const [result] = await db.query(UPDATE_SQL, [entity, ${vars.join(', ')}])
    return result.affectedRows      // 0 = ไม่มีแถวนี้
}

export async function remove(${vars.join(', ')}) {
    const [result] = await db.query(REMOVE_SQL, [${vars.join(', ')}])
    if (result.affectedRows === 0) {
        throw new AppError(\`\${ENTITY_NAME} ${keyLabel(r)} was not found\`, 404, NOT_FOUND_CODE)
    }
}
`
}

// ---------------------------------------------------------------- service
export function serviceFile(r, all, paths) {
    const vars = keyVars(r)
    const v = r.validation
    const imports = [
        `import * as repo from "../repositories/${r.file}-repo.js"`,
        `import mapper from "${paths.mapper || `../mappers/${r.file}-mapper.js`}"`
    ]
    const fkChecks = []
    for (const fk of r.foreignKeys) {
        const parent = all.find(x => x.table === fk.table)
        if (!parent || parent.primaryKey.length !== 1 || parent.primaryKey[0] !== fk.references) continue
        const alias = parent === r ? 'repo' : `${camel(parent.file)}Repo`
        if (parent !== r && !imports.some(i => i.includes(`/${parent.file}-repo.js`))) {
            imports.push(`import * as ${alias} from "../repositories/${parent.file}-repo.js"`)
        }
        fkChecks.push(`    if (${prop('entity', fk.column)} !== undefined && ${prop('entity', fk.column)} !== null && !(await ${alias}.exists(${prop('entity', fk.column)}))) {
        throw new AppError(\`${fk.column} '\${${prop('entity', fk.column)}}' does not exist in ${fk.table}\`, 400, "FOREIGN_KEY_NOT_FOUND")
    }`)
    }
    const children = r.primaryKey.length === 1 ? r.children : []
    for (const c of children) {
        imports.push(`import * as ${camel(c.file)}Repo from "../repositories/${c.file}-repo.js"`)
        imports.push(`import * as ${camel(c.file)}Service from "./${c.file}-service.js"`)
    }
    imports.push(`import {AppError} from ${str(paths.appError)}`)
    const uniqueCols = r.unique.filter(c => !r.primaryKey.includes(c) || r.primaryKey.length > 1)
    const uniqueChecks = uniqueCols.map(c => `    if (${prop('entity', c)} !== undefined) {
        const other = await repo.findBy${pascal(c)}(${prop('entity', c)})
        if (other && (${vars.length === 1 ? 'id === null' : `${vars[0]} === null`} || ${r.primaryKey.map((pk, i) => `String(${prop('other', pk)}) !== String(${vars[i]})`).join(' || ')})) {
            throw new AppError(\`${c} '\${${prop('entity', c)}}' already exists\`, 409, "DUPLICATE_KEY")
        }
    }`)

    const consts = [
        `const VALIDATION_CODE = ${str(v.code)}`,
        `const REQUIRED_ON_CREATE = ${list(v.required)}   // NOT NULL และไม่มี DEFAULT`
    ]
    const checks = [`    if (isCreate) {
        for (const field of REQUIRED_ON_CREATE) {
            if (isBlank(entity[field])) errors.push(\`\${field} is required\`)
        }
    } else {
        for (const field of REQUIRED_ON_CREATE) {
            if (field in entity && isBlank(entity[field])) errors.push(\`\${field} cannot be empty\`)
        }
    }`]
    if (v.numbers.length) {
        consts.push(`const NUMBER_FIELDS = ${list(v.numbers)}${v.strictNumbers ? '   // ต้องเป็น number ใน JSON ("5" ไม่ผ่าน)' : ''}`)
        checks.push(v.strictNumbers
            ? `    for (const field of NUMBER_FIELDS) {
        if (!isBlank(entity[field]) && (typeof entity[field] !== "number" || !Number.isFinite(entity[field]))) errors.push(\`\${field} must be a number\`)
    }`
            : `    for (const field of NUMBER_FIELDS) {
        if (!isBlank(entity[field]) && (typeof entity[field] === "boolean" || Number.isNaN(Number(entity[field])))) errors.push(\`\${field} must be a number\`)
    }`)
    }
    if (v.nonNegative.length) {
        consts.push(`const NON_NEGATIVE_FIELDS = ${list(v.nonNegative)}`)
        checks.push(`    for (const field of NON_NEGATIVE_FIELDS) {
        if (!isBlank(entity[field]) && Number(entity[field]) < 0) errors.push(\`\${field} must not be negative\`)
    }`)
    }
    if (v.positive.length) {
        consts.push(`const POSITIVE_FIELDS = ${list(v.positive)}`)
        checks.push(`    for (const field of POSITIVE_FIELDS) {
        if (!isBlank(entity[field]) && !(Number(entity[field]) > 0)) errors.push(\`\${field} must be greater than 0\`)
    }`)
    }
    if (v.dates.length) {
        consts.push(`const DATE_FIELDS = ${list(v.dates)}   // ต้องเป็น YYYY-MM-DD`)
        checks.push(`    for (const field of DATE_FIELDS) {
        if (!isBlank(entity[field]) && !isDate(entity[field])) errors.push(\`\${field} must be a date in YYYY-MM-DD format\`)
    }`)
    }
    if (Object.keys(v.oneOf).length) {
        consts.push(`const ALLOWED_VALUES = {\n${Object.entries(v.oneOf).map(([k, vals]) => `    ${key(k)}: ${list(vals)},`).join('\n')}\n}`)
        checks.push(`    for (const [field, values] of Object.entries(ALLOWED_VALUES)) {
        if (!isBlank(entity[field]) && !values.includes(entity[field])) errors.push(\`\${field} must be one of \${values.join(", ")}\`)
    }`)
    }
    if (Object.keys(v.maxLength || {}).length) {
        consts.push(`const MAX_LENGTH = {${Object.entries(v.maxLength).map(([k, n]) => `${key(k)}: ${n}`).join(', ')}}`)
        checks.push(`    for (const [field, max] of Object.entries(MAX_LENGTH)) {
        if (typeof entity[field] === "string" && entity[field].length > max) errors.push(\`\${field} must be at most \${max} characters\`)
    }`)
    }
    let emailCheck = ''
    if (v.emails.length) {
        consts.push(`const EMAIL_FIELDS = ${list(v.emails)}`)
        consts.push(`const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`)
        emailCheck = `
    for (const field of EMAIL_FIELDS) {
        if (!isBlank(entity[field]) && !EMAIL_PATTERN.test(String(entity[field]))) {
            throw new AppError(\`\${field} '\${entity[field]}' is not a valid email\`, 400, ${str(v.emailCode)})
        }
    }`
    }

    const pkFromEntity = r.primaryKey.map(c => prop('entity', c)).join(', ')
    const duplicatePk = r.autoIncrement ? '' : `
    if (await repo.exists(${pkFromEntity})) {
        throw new AppError(\`${r.entity} ${r.primaryKey.length === 1 ? `'\${${pkFromEntity}}'` : `'${r.primaryKey.map(c => `\${${prop('entity', c)}}`).join('/')}'`} already exists\`, 409, "DUPLICATE_KEY")
    }`
    const createTail = r.autoIncrement || vars.length === 1
        ? `    const id = await repo.create(entity)
    return getObject(id)`
        : `    const keys = await repo.create(entity)
    return getObject(...keys)`

    const inUse = children.filter(c => !/CASCADE|SET NULL/.test(c.onDelete)).map(c => `    if (await ${camel(c.file)}Repo.count({}, {${key(c.column)}: id}) > 0) {
        throw new AppError(\`${r.entity} '\${id}' is still referenced by ${c.table}\`, 409, "RESOURCE_IN_USE")
    }`)

    const nested = children.map(c => `
// GET /${r.path}/:id/${c.path}  (One-to-Many) -> ${r.entity} ไม่มี = 404
export async function get${pascal(c.path)}Of${r.entity}(id, pagination = null, query = {}) {
    await repo.findOne(id)
    return ${camel(c.file)}Service.getAllObjects(pagination, query, query.view || "summary", {${key(c.column)}: id})
}

// POST /${r.path}/:id/${c.path}  -> สร้าง ${c.entity} ที่ ${c.column} = id
export async function create${c.entity}Of${r.entity}(id, body) {
    await repo.findOne(id)
    return ${camel(c.file)}Service.createObject({...body, ${key(c.column)}: ${r.columns[r.primaryKey[0]] === 'integer' ? 'Number(id)' : 'id'}})
}
`).join('')

    return `// src/services/${r.file}-service.js  — business logic: validate, เช็กซ้ำ/FK, เรียก repo, แปลง DTO
${imports.join('\n')}

${consts.join('\n')}

export async function getAllObjects(pagination = null, query = {}, viewType = "summary", scope = {}) {
    const objects = await repo.findAll(pagination, query, scope)
    return mapper.maps(objects, viewType)
}

export async function getObject(${vars.join(', ')}, viewType = "full") {
    return mapper.map(await repo.findOne(${vars.join(', ')}), viewType)
}

export async function createObject(body) {
    const entity = mapper.toEntity(body)
    validate(entity, true)${duplicatePk}
    await checkUnique(entity)
    await checkForeignKeys(entity)
${createTail}
}

// ใช้ทั้ง PUT และ PATCH: อัปเดตเฉพาะฟิลด์ที่ส่งมา
export async function updateObject(${vars.join(', ')}, body) {
    await repo.findOne(${vars.join(', ')})                 // ไม่มี -> 404
    const entity = mapper.toEntity(body)
${r.primaryKey.map(c => `    delete ${prop('entity', c)}                          // ห้ามแก้ PK`).join('\n')}
    if (Object.keys(entity).length === 0) {
        throw new AppError("Request body has no updatable fields", 400, VALIDATION_CODE)
    }
    validate(entity, false)
    await checkUnique(entity, ${vars.join(', ')})
    await checkForeignKeys(entity)
    await repo.update(${vars.join(', ')}, entity)
    return getObject(${vars.join(', ')})
}

export async function removeObject(${vars.join(', ')}) {
    await repo.findOne(${vars.join(', ')})                 // ไม่มี -> 404
${inUse.join('\n')}${inUse.length ? '\n' : ''}    await repo.remove(${vars.join(', ')})
}
${nested}
function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === ""
}
${v.dates.length ? `
function isDate(value) {
    return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(value)) && !Number.isNaN(new Date(value).getTime())
}
` : ''}
function validate(entity, isCreate) {
    const errors = []
${checks.join('\n')}
    if (errors.length) throw new AppError(errors.join("; "), 400, VALIDATION_CODE)${emailCheck}
}

// UNIQUE ซ้ำ -> 409 (ถ้าหลุดถึง DB ก็ได้ ER_DUP_ENTRY -> 409 จาก errorHandler อีกชั้น)
async function checkUnique(entity, ${vars.map(x => `${x} = null`).join(', ')}) {
${uniqueChecks.join('\n') || '    // ไม่มีคอลัมน์ UNIQUE นอกจาก PK'}
}

// FK ไม่มีจริง -> 400 (กันไว้ก่อนถึง DB ซึ่งจะได้ ER_NO_REFERENCED_ROW_2)
async function checkForeignKeys(entity) {
${fkChecks.join('\n') || '    // ไม่มี FK'}
}
`
}

// ---------------------------------------------------------------- route
export function routeFile(r, paths) {
    const kp = keyParamsRoute(r)
    const args = keyArgsFromReq(r)
    const listPagination = {
        always: `    const pagination = req.pagination ?? {page: 1, limit: 10, offset: 0}`,
        optional: `    // แบ่งหน้าเฉพาะเมื่อส่ง ?page หรือ ?limit มา (ไม่ส่ง = คืนทั้งหมด)
    const wantPaging = req.query.page !== undefined || req.query.limit !== undefined
    const pagination = wantPaging ? req.pagination : null`,
        never: `    const pagination = null`
    }[r.listPagination] || `    const pagination = req.pagination`
    const del = Number(r.delete.status) === 200
        ? `// DELETE /${r.path}${kp}  -> 200 + message หรือ 404 / 409 (ยังถูกใช้อยู่)
router.delete(${str(kp)}, async (req, res) => {
    await service.removeObject(${args})
    apiResponse(res, {message: ${str(r.delete.message)}})
})`
        : `// DELETE /${r.path}${kp}  -> 204 No Content (ห้ามมี body) หรือ 404 / 409 (ยังถูกใช้อยู่)
router.delete(${str(kp)}, async (req, res) => {
    await service.removeObject(${args})
    res.status(204).end()
})`
    const children = r.primaryKey.length === 1 ? r.children : []
    const nested = children.map(c => `
// GET /${r.path}/:id/${c.path}?page=1&limit=10  (One-to-Many)
router.get("/:id/${c.path}", async (req, res) => {
    const pagination = req.pagination ?? {page: 1, limit: 10, offset: 0}
    const objects = await service.get${pascal(c.path)}Of${r.entity}(req.params.id, pagination, req.query)
    apiResponse(res, objects, pagination)
})

// POST /${r.path}/:id/${c.path}  -> 201
router.post("/:id/${c.path}", async (req, res) => {
    const object = await service.create${c.entity}Of${r.entity}(req.params.id, req.body)
    apiResponse(res, object, null, 201)
})
`).join('')

    return `// src/routes/${r.file}-route.js  — รับ request -> เรียก service -> ส่ง response (ไม่มี SQL ใน layer นี้)
import * as service from "../services/${r.file}-service.js"
import express from "express"
import {apiResponse} from ${str(paths.apiResponse)}

const router = express.Router()

// GET /${r.path}?page=1&limit=10&sort=${r.defaultSort}&order=asc  (+ filter ดู FILTERS ใน ${r.file}-repo.js, ?view=full = detail)
router.get("/", async (req, res) => {
${listPagination}
    const objects = await service.getAllObjects(pagination, req.query, req.query.view || "summary")
    apiResponse(res, objects, pagination)
})
${nested}
// GET /${r.path}${kp}  -> 200 Detail DTO หรือ 404
router.get(${str(kp)}, async (req, res) => {
    const object = await service.getObject(${args}, req.query.view || "full")
    apiResponse(res, object)
})

// POST /${r.path}  -> 201 Created / 400 ข้อมูลไม่ครบ / 409 ซ้ำ
router.post("/", async (req, res) => {
    const object = await service.createObject(req.body)
    apiResponse(res, object, null, 201)
})

// PUT /${r.path}${kp}  -> 200 หรือ 404
router.put(${str(kp)}, async (req, res) => {
    const object = await service.updateObject(${args}, req.body)
    apiResponse(res, object)
})

// PATCH /${r.path}${kp}  -> แก้บางฟิลด์
router.patch(${str(kp)}, async (req, res) => {
    const object = await service.updateObject(${args}, req.body)
    apiResponse(res, object)
})

${del}

export default router
`
}

// ---------------------------------------------------------------- router index / app / db
export function apiRouterFile(resources) {
    return `// src/routes/api-router.js  — รวมทุก resource ไว้ใต้ BASE_PATH (/api/<รหัส>) ชื่อพหูพจน์ตัวเล็ก
import express from "express"
${resources.map(r => `import ${camel(r.file)}Router from "./${r.file}-route.js"`).join('\n')}

const router = express.Router()

${resources.map(r => `router.use(${str('/' + r.path)}, ${camel(r.file)}Router)`).join('\n')}

export default router
`
}

export function appFile(cfg, paths) {
    return `import express from "express"
import apiRouter from "./routes/api-router.js"
import {queryParser} from ${str(paths.queryParserFromApp)}
import {errorHandler, notFoundHandler} from ${str(paths.errorHandlerFromApp)}
import {apiResponse} from ${str(paths.apiResponseFromApp)}

// ===== 1.2 รหัสประจำตัว (ตาม exam-spec ของตัวเอง) =====
const STUDENT_ID = '${cfg.studentId}';
const STUDENT_NAME = ${str(cfg.studentName)}
const SECRET_KEY = ${str(cfg.secretKey)}

const BASE_PATH = \`/api/\${STUDENT_ID}\`    // ทุก route อยู่ใต้ /api/<รหัส>/ (hardcode ห้ามใช้ :studentId)
const PORT = process.env.PORT || ${cfg.port || 3000}

const app = express()
app.use(express.json())       // 1) อ่าน JSON body -> req.body (ต้องมาก่อน router)
app.use(queryParser())        // 2) page/limit -> req.pagination (ต้องมี () และมาก่อน router)

// 2.1 Identity Verification: GET /api/<id>/student-info
app.get(\`\${BASE_PATH}/student-info\`, (req, res) => {
    apiResponse(res, {studentId: STUDENT_ID, name: STUDENT_NAME, secretKey: SECRET_KEY})
})

app.use(BASE_PATH, apiRouter) // 3) resource ทั้งหมด (/brands, /products, ...)

app.use(notFoundHandler)      // 4) route ที่ไม่มี -> 404 JSON
app.use(errorHandler)         // 5) error handler ท้ายสุดเสมอ

app.listen(PORT, () => {
    console.log(\`Example app listening on port \${PORT}\`)
    console.log(\`Base path: http://localhost:\${PORT}\${BASE_PATH}\`)
})
`
}

export function dbConfigFile(cfg) {
    return `// การเชื่อมต่อ MySQL (Week 4) — แก้ user/password/database ให้ตรงกับเครื่องที่สอบ
import mysql from "mysql2/promise"

const pool = mysql.createPool({
    host: ${str(cfg.db.host)},
    port: ${Number(cfg.db.port)},
    user: ${str(cfg.db.user)},
    password: ${str(cfg.db.password)},          // <-- รหัส root ของเครื่องตัวเอง
    database: ${str(cfg.database)},     // <-- ชื่อ database ตามสเปค
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,   // DECIMAL (เช่น price) คืนเป็น number ไม่ใช่ string "48900.00"
    dateStrings: ["DATE"]   // คอลัมน์ DATE คืนเป็น "2023-09-22" ไม่เลื่อนวันเพราะ timezone
})

export default pool
`
}
