// src/mappers/api-response.js  (รูปแบบเดียวกับสไลด์ Week-07 "Api Response")
// ทุก response ผ่านฟังก์ชันนี้ตัวเดียว => JSON หน้าตาเหมือนกันทุก endpoint (success + timestamp)

export async function apiResponse(res, data, pagination = null, status = 200) {
    return await (pagination ?
            paginate(res, data, pagination, Number(status)) :
            success(res, data, Number(status))
    )
}

// ส่ง Success Response ทั่วไป
async function success(res, data, statusCode) {
    return res.status(statusCode).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
    })
}

// ส่ง Success Response แบบแบ่งหน้า (total มาจาก data.totalItems ที่ repo แปะไว้)
async function paginate(res, data, pagination, statusCode) {
    const {limit, page} = pagination
    const total = Number(data.totalItems ?? data.length)
    const totalPages = Math.ceil(total / limit)
    return res.status(statusCode).json({
        success: true,
        data,
        pagination: {
            total: total,
            page: page,
            limit: limit,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        timestamp: new Date().toISOString()
    })
}

// Error Response: ต้องมี success: false เสมอ
export function apiError(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: {code, message},
        timestamp: new Date().toISOString()
    })
}
