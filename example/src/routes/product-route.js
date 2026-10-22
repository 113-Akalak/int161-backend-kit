// src/routes/product-route.js  — รับ request -> เรียก service -> ส่ง response (ไม่มี SQL ใน layer นี้)
import * as service from "../services/product-service.js"
import express from "express"
import {apiResponse} from "../mappers/api-response.js"

const router = express.Router()

// GET /products?page=1&limit=10&sort=id&order=asc  (+ filter ดู FILTERS ใน product-repo.js, ?view=full = detail)
router.get("/", async (req, res) => {
    const pagination = req.pagination ?? {page: 1, limit: 10, offset: 0}
    const objects = await service.getAllObjects(pagination, req.query, req.query.view || "summary")
    apiResponse(res, objects, pagination)
})

// GET /products/:id  -> 200 Detail DTO หรือ 404
router.get("/:id", async (req, res) => {
    const object = await service.getObject(req.params.id, req.query.view || "full")
    apiResponse(res, object)
})

// POST /products  -> 201 Created / 400 ข้อมูลไม่ครบ / 409 ซ้ำ
router.post("/", async (req, res) => {
    const object = await service.createObject(req.body)
    apiResponse(res, object, null, 201)
})

// PUT /products/:id  -> 200 หรือ 404
router.put("/:id", async (req, res) => {
    const object = await service.updateObject(req.params.id, req.body)
    apiResponse(res, object)
})

// PATCH /products/:id  -> แก้บางฟิลด์
router.patch("/:id", async (req, res) => {
    const object = await service.updateObject(req.params.id, req.body)
    apiResponse(res, object)
})

// DELETE /products/:id  -> 204 No Content (ห้ามมี body) หรือ 404 / 409 (ยังถูกใช้อยู่)
router.delete("/:id", async (req, res) => {
    await service.removeObject(req.params.id)
    res.status(204).end()
})

export default router
