// src/services/brand-service.js  — business logic: validate, เช็กซ้ำ/FK, เรียก repo, แปลง DTO
import * as repo from "../repositories/brand-repo.js"
import mapper from "../mappers/brand-mapper.js"
import * as productRepo from "../repositories/product-repo.js"
import * as productService from "./product-service.js"
import {AppError} from "../middlewares/error-handler.js"

const VALIDATION_CODE = "VALIDATION_ERROR"
const REQUIRED_ON_CREATE = ["name", "country_of_origin"]   // NOT NULL และไม่มี DEFAULT
const MAX_LENGTH = {name: 100, country_of_origin: 100, website: 255}

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
    if (await productRepo.count({}, {brand_id: id}) > 0) {
        throw new AppError(`Brand '${id}' is still referenced by products`, 409, "RESOURCE_IN_USE")
    }
    await repo.remove(id)
}

// GET /brands/:id/products  (One-to-Many) -> Brand ไม่มี = 404
export async function getProductsOfBrand(id, pagination = null, query = {}) {
    await repo.findOne(id)
    return productService.getAllObjects(pagination, query, query.view || "summary", {brand_id: id})
}

// POST /brands/:id/products  -> สร้าง Product ที่ brand_id = id
export async function createProductOfBrand(id, body) {
    await repo.findOne(id)
    return productService.createObject({...body, brand_id: Number(id)})
}

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === ""
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
    for (const [field, max] of Object.entries(MAX_LENGTH)) {
        if (typeof entity[field] === "string" && entity[field].length > max) errors.push(`${field} must be at most ${max} characters`)
    }
    if (errors.length) throw new AppError(errors.join("; "), 400, VALIDATION_CODE)
}

// UNIQUE ซ้ำ -> 409 (ถ้าหลุดถึง DB ก็ได้ ER_DUP_ENTRY -> 409 จาก errorHandler อีกชั้น)
async function checkUnique(entity, id = null) {
    if (entity.name !== undefined) {
        const other = await repo.findByName(entity.name)
        if (other && (id === null || String(other.id) !== String(id))) {
            throw new AppError(`name '${entity.name}' already exists`, 409, "DUPLICATE_KEY")
        }
    }
}

// FK ไม่มีจริง -> 400 (กันไว้ก่อนถึง DB ซึ่งจะได้ ER_NO_REFERENCED_ROW_2)
async function checkForeignKeys(entity) {
    // ไม่มี FK
}
