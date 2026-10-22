// src/middlewares/error-handler.js  (Week-06 Centralized Error Handling)
// - AppError(message, statusCode, errorCode): โยนจาก repo/service
// - errorHandler(err, req, res, next): 4 พารามิเตอร์ -> Express รู้ว่าเป็น error middleware, ต้อง app.use() ไว้ท้ายสุด
// - Express 5: error ที่ throw ใน async handler ถูกส่งมาที่นี่อัตโนมัติ (ไม่ต้อง try/catch / next(err))
// ไฟล์นี้ไม่ import อะไรเลย จึงวางลงโปรเจกต์ไหนก็ได้

// Error Response: { success: false, error: { code, message }, timestamp }
function sendError(res, statusCode, code, message) {
    return res.status(statusCode).json({
        success: false,
        error: {code, message},
        timestamp: new Date().toISOString()
    })
}

class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR") {
        super(message)
        this.name = "AppError"
        this.statusCode = statusCode
        this.errorCode = errorCode
    }
}

// MySQL error code -> [HTTP status, errorCode]
const MYSQL_ERRORS = {
    ER_DUP_ENTRY: [409, "DUPLICATE_KEY"],                 // 1062 UNIQUE / PK ซ้ำ
    ER_NO_REFERENCED_ROW_2: [400, "FOREIGN_KEY_NOT_FOUND"], // 1452 FK ชี้ไปแถวที่ไม่มี
    ER_NO_REFERENCED_ROW: [400, "FOREIGN_KEY_NOT_FOUND"],
    ER_ROW_IS_REFERENCED_2: [409, "RESOURCE_IN_USE"],       // 1451 ลบ parent ที่ยังมี child
    ER_ROW_IS_REFERENCED: [409, "RESOURCE_IN_USE"],
    ER_BAD_NULL_ERROR: [400, "VALIDATION_ERROR"],           // 1048 ส่ง null ให้คอลัมน์ NOT NULL
    ER_NO_DEFAULT_FOR_FIELD: [400, "VALIDATION_ERROR"],     // 1364 ไม่ส่งคอลัมน์ที่ไม่มี DEFAULT
    ER_TRUNCATED_WRONG_VALUE: [400, "VALIDATION_ERROR"],    // 1292 วันที่/ตัวเลขผิดรูปแบบ
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [400, "VALIDATION_ERROR"],
    WARN_DATA_TRUNCATED: [400, "VALIDATION_ERROR"],         // 1265 ค่า ENUM ผิด
    ER_DATA_TOO_LONG: [400, "VALIDATION_ERROR"],            // 1406 string ยาวเกิน
    ER_WARN_DATA_OUT_OF_RANGE: [400, "VALIDATION_ERROR"],   // 1264 ตัวเลขเกินช่วง
    ER_CHECK_CONSTRAINT_VIOLATED: [400, "VALIDATION_ERROR"],// 3819 CHECK ไม่ผ่าน
    ER_BAD_FIELD_ERROR: [400, "INVALID_FIELD"],             // 1054 ส่งชื่อคอลัมน์ที่ไม่มี
}

// route ที่ไม่มีอยู่ -> 404 JSON (ไม่ใช่หน้า HTML ของ Express) วางหลัง router ทั้งหมด ก่อน errorHandler
function notFoundHandler(req, res) {
    sendError(res, 404, "ROUTE_NOT_FOUND", `Cannot ${req.method} ${req.originalUrl}`)
}

function errorHandler(err, req, res, next) {
    let statusCode = err.statusCode || err.status || 500
    let errorCode = err.errorCode || "INTERNAL_SERVER_ERROR"
    let message = err.message || "An unexpected error occurred"

    if (MYSQL_ERRORS[err.code]) {
        [statusCode, errorCode] = MYSQL_ERRORS[err.code]
        message = err.sqlMessage || message
    } else if (err.type === "entity.parse.failed") {   // body ไม่ใช่ JSON ที่ถูกต้อง
        statusCode = 400
        errorCode = "INVALID_JSON"
        message = "Request body is not valid JSON"
    } else if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR" || err.code === "ER_BAD_DB_ERROR") {
        statusCode = 500
        errorCode = "DATABASE_CONNECTION_ERROR"           // MySQL ไม่ได้เปิด / password ผิด / ยังไม่ได้รัน init-database.sql
    }
    if (statusCode >= 500) console.error(err)
    if (res.headersSent) return next(err)
    sendError(res, statusCode, errorCode, message)
}

export {AppError, errorHandler, notFoundHandler}
