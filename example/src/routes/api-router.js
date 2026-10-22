// src/routes/api-router.js  — รวมทุก resource ไว้ใต้ BASE_PATH (/api/<รหัส>) ชื่อพหูพจน์ตัวเล็ก
import express from "express"
import brandRouter from "./brand-route.js"
import productRouter from "./product-route.js"

const router = express.Router()

router.use("/brands", brandRouter)
router.use("/products", productRouter)

export default router
