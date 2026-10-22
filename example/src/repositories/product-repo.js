// src/repositories/product-repo.js  — SQL ทั้งหมดของตาราง products อยู่ที่นี่ที่เดียว
import db from "../configs/db-config.js"
import {AppError} from "../middlewares/error-handler.js"

const TABLE_NAME = "products"
const ENTITY_NAME = "Product"
const NOT_FOUND_CODE = "PRODUCT_NOT_FOUND"

// FROM + JOIN ใช้ร่วมกันทั้ง list / count / findOne
const FROM_SQL = `FROM ${TABLE_NAME} p
    LEFT JOIN brands b ON p.brand_id = b.id`
const SELECT_SQL = `SELECT p.*, b.name AS brand_name ${FROM_SQL}`
const KEY_WHERE = "p.id = ?"
const CREATE_SQL = `INSERT INTO ${TABLE_NAME} SET ?`
const UPDATE_SQL = `UPDATE ${TABLE_NAME} SET ? WHERE id = ?`
const REMOVE_SQL = `DELETE FROM ${TABLE_NAME} WHERE id = ?`

// ?param=value -> WHERE ... (ค่าทุกตัวส่งผ่าน ? เสมอ) เพิ่ม/ลบได้ตามสเปค
const FILTERS = [
    {params: ["brandId", "brand_id"], sql: "p.brand_id = ?"},
    {params: ["category"], sql: "p.category = ?"},
    {params: ["minPrice", "min_price"], sql: "p.price >= ?"},
    {params: ["maxPrice", "max_price"], sql: "p.price <= ?"},
    {params: ["ramGb", "ram_gb"], sql: "p.ram_gb = ?"},
    {params: ["storageGb", "storage_gb"], sql: "p.storage_gb = ?"},
    {params: ["stockQuantity", "stock_quantity"], sql: "p.stock_quantity = ?"},
    {params: ["minStockQuantity", "min_stock_quantity"], sql: "p.stock_quantity >= ?"},
    {params: ["maxStockQuantity", "max_stock_quantity"], sql: "p.stock_quantity <= ?"},
    {params: ["status"], sql: "p.status = ?"},
    {params: ["releaseDateFrom", "release_date_from"], sql: "p.release_date >= ?"},
    {params: ["releaseDateTo", "release_date_to"], sql: "p.release_date <= ?"},
    {params: ["search", "q", "keyword"], sql: "(p.sku LIKE ? OR p.name LIKE ?)", like: true},
]

// ORDER BY ใช้ ? ไม่ได้ จึง whitelist ชื่อคอลัมน์ (?sort=price&order=desc หรือ ?sort=-price)
const SORTABLE = {
    id: "id",
    sku: "sku",
    name: "name",
    brand_id: "brand_id",
    brandId: "brand_id",
    category: "category",
    price: "price",
    ram_gb: "ram_gb",
    ramGb: "ram_gb",
    storage_gb: "storage_gb",
    storageGb: "storage_gb",
    color: "color",
    stock_quantity: "stock_quantity",
    stockQuantity: "stock_quantity",
    status: "status",
    release_date: "release_date",
    releaseDate: "release_date",
    created_at: "created_at",
    createdAt: "created_at",
    updated_at: "updated_at",
    updatedAt: "updated_at",
}
const DEFAULT_SORT = "id"

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
        conditions.push(`p.${column} = ?`)
        params.push(value)
    }
    for (const filter of FILTERS) {
        const name = filter.params.find(p => query[p] !== undefined && query[p] !== "")
        if (!name) continue
        const value = filter.like ? `%${toSqlValue(query[name])}%` : toSqlValue(query[name])
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
    const tieBreak = column === DEFAULT_SORT ? "" : `, p.${DEFAULT_SORT} ASC`   // ให้ลำดับคงที่ แบ่งหน้าแล้วไม่ซ้ำ
    return ` ORDER BY p.${column} ${direction}${tieBreak}`
}

// COUNT ต้องใช้ WHERE เดียวกับตอนดึงข้อมูล ไม่งั้น total ผิด
export async function count(query = {}, scope = {}) {
    const {where, params} = buildWhere(query, scope)
    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total ${FROM_SQL}${where}`, params)
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

export async function findOne(id) {
    const [rows] = await db.query(SELECT_SQL + " WHERE " + KEY_WHERE, [id])
    if (rows.length === 0) {
        throw new AppError(`${ENTITY_NAME} '${id}' was not found`, 404, NOT_FOUND_CODE)
    }
    return rows[0]
}

export async function exists(id) {
    const [rows] = await db.query(`SELECT 1 FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`, [id])
    return rows.length > 0
}

// ใช้เช็กค่าซ้ำก่อน INSERT/UPDATE (คอลัมน์ UNIQUE)
export async function findBySku(value) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE_NAME} WHERE sku = ?`, [value])
    return rows[0] ?? null
}

export async function create(entity) {
    const [result] = await db.query(CREATE_SQL, [entity])
    return result.insertId          // id ที่ AUTO_INCREMENT สร้าง
}

export async function update(id, entity) {
    const [result] = await db.query(UPDATE_SQL, [entity, id])
    return result.affectedRows      // 0 = ไม่มีแถวนี้
}

export async function remove(id) {
    const [result] = await db.query(REMOVE_SQL, [id])
    if (result.affectedRows === 0) {
        throw new AppError(`${ENTITY_NAME} '${id}' was not found`, 404, NOT_FOUND_CODE)
    }
}
