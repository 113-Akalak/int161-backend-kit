// src/services/product-service.js  — business logic: validate, เช็กซ้ำ/FK, เรียก repo, แปลง DTO
import * as repo from "../repositories/product-repo.js"
import mapper from "../mappers/product-mapper.js"
import * as brandRepo from "../repositories/brand-repo.js"
import {AppError} from "../middlewares/error-handler.js"

const VALIDATION_CODE = "VALIDATION_ERROR"
const REQUIRED_ON_CREATE = ["sku", "name", "brand_id", "category", "price", "ram_gb", "storage_gb", "color"]   // NOT NULL และไม่มี DEFAULT
const NUMBER_FIELDS = ["brand_id", "price", "ram_gb", "storage_gb", "stock_quantity"]
const NON_NEGATIVE_FIELDS = ["price", "ram_gb", "storage_gb", "stock_quantity"]
const DATE_FIELDS = ["release_date"]   // ต้องเป็น YYYY-MM-DD
const MAX_LENGTH = {sku: 50, name: 150, category: 50, color: 50, status: 30}

export async function getAllObjects(pagination = null, query = {}, viewType = "summary", scope = {}) {
    const objects = await repo.findAll(pagination, query, scope)
    return mapper.maps(objects, viewType)
}

export async function getObject(id, viewType = "full") {
    return mapper.map(await repo.findOne(id), viewType)
}

export async function createObject(body) {
    const entity = mapper.toEntity(body)
    validate(entity, true)
    await checkUnique(entity)
    await checkForeignKeys(entity)
    const id = await repo.create(entity)
    return getObject(id)
}

// ใช้ทั้ง PUT และ PATCH: อัปเดตเฉพาะฟิลด์ที่ส่งมา
export async function updateObject(id, body) {
    await repo.findOne(id)                 // ไม่มี -> 404
    const entity = mapper.toEntity(body)
    delete entity.id                          // ห้ามแก้ PK
    if (Object.keys(entity).length === 0) {
        throw new AppError("Request body has no updatable fields", 400, VALIDATION_CODE)
    }
    validate(entity, false)
    await checkUnique(entity, id)
    await checkForeignKeys(entity)
    await repo.update(id, entity)
    return getObject(id)
}

export async function removeObject(id) {
    await repo.findOne(id)                 // ไม่มี -> 404
    await repo.remove(id)
}

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === ""
}

function isDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(new Date(value).getTime())
}

function validate(entity, isCreate) {
    const errors = []
    if (isCreate) {
        for (const field of REQUIRED_ON_CREATE) {
            if (isBlank(entity[field])) errors.push(`${field} is required`)
        }
    } else {
        for (const field of REQUIRED_ON_CREATE) {
            if (field in entity && isBlank(entity[field])) errors.push(`${field} cannot be empty`)
        }
    }
    for (const field of NUMBER_FIELDS) {
        if (!isBlank(entity[field]) && (typeof entity[field] === "boolean" || Number.isNaN(Number(entity[field])))) errors.push(`${field} must be a number`)
    }
    for (const field of NON_NEGATIVE_FIELDS) {
        if (!isBlank(entity[field]) && Number(entity[field]) < 0) errors.push(`${field} must not be negative`)
    }
    for (const field of DATE_FIELDS) {
        if (!isBlank(entity[field]) && !isDate(entity[field])) errors.push(`${field} must be a date in YYYY-MM-DD format`)
    }
    for (const [field, max] of Object.entries(MAX_LENGTH)) {
        if (typeof entity[field] === "string" && entity[field].length > max) errors.push(`${field} must be at most ${max} characters`)
    }
    if (errors.length) throw new AppError(errors.join("; "), 400, VALIDATION_CODE)
}

// UNIQUE ซ้ำ -> 409 (ถ้าหลุดถึง DB ก็ได้ ER_DUP_ENTRY -> 409 จาก errorHandler อีกชั้น)
async function checkUnique(entity, id = null) {
    if (entity.sku !== undefined) {
        const other = await repo.findBySku(entity.sku)
        if (other && (id === null || String(other.id) !== String(id))) {
            throw new AppError(`sku '${entity.sku}' already exists`, 409, "DUPLICATE_KEY")
        }
    }
}

// FK ไม่มีจริง -> 400 (กันไว้ก่อนถึง DB ซึ่งจะได้ ER_NO_REFERENCED_ROW_2)
async function checkForeignKeys(entity) {
    if (entity.brand_id !== undefined && entity.brand_id !== null && !(await brandRepo.exists(entity.brand_id))) {
        throw new AppError(`brand_id '${entity.brand_id}' does not exist in brands`, 400, "FOREIGN_KEY_NOT_FOUND")
    }
}
