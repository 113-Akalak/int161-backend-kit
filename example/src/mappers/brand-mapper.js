// src/mappers/brand-mapper.js  (รูปแบบเดียวกับสไลด์ Week-07 "Mapper")
// DTO: แปลง entity จาก DB -> JSON ที่ตกลงกับ client (เลือกเฉพาะฟิลด์ / เปลี่ยนชื่อ)
export default class BrandMapper {
    // Summary DTO (ใช้กับ list GET /brands)
    static toSummaryDTO(entity) {
        return {
            id: entity.id,
            name: entity.name,
            country_of_origin: entity.country_of_origin,
            website: entity.website,
            is_active: entity.is_active,
            created_at: entity.created_at,
        }
    }

    // Detail DTO (ใช้กับ GET /brands/:id)
    static toDetailDTO(entity) {
        return {
            id: entity.id,
            name: entity.name,
            country_of_origin: entity.country_of_origin,
            website: entity.website,
            is_active: entity.is_active,
            created_at: entity.created_at,
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
    name: "name",
    country_of_origin: "country_of_origin",
    countryOfOrigin: "country_of_origin",
    website: "website",
    is_active: "is_active",
    isActive: "is_active",
}
