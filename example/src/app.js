import express from "express"
import apiRouter from "./routes/api-router.js"
import {queryParser} from "./middlewares/pagination-middleware.js"
import {errorHandler, notFoundHandler} from "./middlewares/error-handler.js"
import {apiResponse} from "./mappers/api-response.js"

// ===== 1.2 รหัสประจำตัว (ตาม exam-spec ของตัวเอง) =====
const STUDENT_ID = '67130599999';
const STUDENT_NAME = "Firstname Lastname"
const SECRET_KEY = "67FiLa"

const BASE_PATH = `/api/${STUDENT_ID}`    // ทุก route อยู่ใต้ /api/<รหัส>/ (hardcode ห้ามใช้ :studentId)
const PORT = process.env.PORT || 3000

const app = express()
app.use(express.json())       // 1) อ่าน JSON body -> req.body (ต้องมาก่อน router)
app.use(queryParser())        // 2) page/limit -> req.pagination (ต้องมี () และมาก่อน router)

// 2.1 Identity Verification: GET /api/<id>/student-info
app.get(`${BASE_PATH}/student-info`, (req, res) => {
    apiResponse(res, {studentId: STUDENT_ID, name: STUDENT_NAME, secretKey: SECRET_KEY})
})

app.use(BASE_PATH, apiRouter) // 3) resource ทั้งหมด (/brands, /products, ...)

app.use(notFoundHandler)      // 4) route ที่ไม่มี -> 404 JSON
app.use(errorHandler)         // 5) error handler ท้ายสุดเสมอ

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
    console.log(`Base path: http://localhost:${PORT}${BASE_PATH}`)
})
