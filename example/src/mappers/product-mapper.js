// src/mappers/product-mapper.js  (รูปแบบเดียวกับสไลด์ Week-07 "Mapper")
// DTO: แปลง entity จาก DB -> JSON ที่ตกลงกับ client (เลือกเฉพาะฟิลด์ / เปลี่ยนชื่อ)
export default class ProductMapper {
    // Summary DTO (ใช้กับ list GET /products)
    static toSummaryDTO(entity) {
        return {
            id: entity.id,
            sku: entity.sku,
            name: entity.name,
            brandId: entity.brand_id,
            category: entity.category,
            price: toNumber(entity.price),
            status: entity.status,
        }
    }

    // Detail DTO (ใช้กับ GET /products/:id)
    static toDetailDTO(entity) {
        return {
            id: entity.id,
            sku: entity.sku,
            name: entity.name,
            brandId: entity.brand_id,
            brandName: entity.brand_name,
            category: entity.category,
            price: toNumber(entity.price),
            ramGb: entity.ram_gb,
            storageGb: entity.storage_gb,
            color: entity.color,
            stockQuantity: entity.stock_quantity,
            status: entity.status,
            releaseDate: toDateOnly(entity.release_date),
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
}

// DECIMAL ถูกส่งมาเป็น string ("48900.00") ถ้า db-config ไม่ได้ตั้ง decimalNumbers: true
function toNumber(value) {
    return value === null || value === undefined ? value : Number(value)
}

// DATE -> "YYYY-MM-DD" (กันวันเลื่อนเพราะ timezone เมื่อ mysql2 คืนค่าเป็น Date)
function toDateOnly(value) {
    if (!(value instanceof Date)) return value
    const pad = n => String(n).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
