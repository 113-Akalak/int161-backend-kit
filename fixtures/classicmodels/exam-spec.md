# Mock #3 — RESTful API CRUD & Centralized Exception Handling (classicmodels)

ดัดแปลงจากโจทย์ `express_crud_exception_assignment.md` ที่อาจารย์แจกในคาบ 18–25 ก.ย. (5 ข้อ Simple → Intermediate)
เปลี่ยนรูปแบบ JSON เป็นแบบ `success: true/false` ให้ตรงกับข้อสอบซ้อม 9 ต.ค.

- Database: `classicmodels_mini` (`database/init-database.sql`) หรือ `classicmodels` ตัวเต็ม
- Base Path: `/api/67130599999/...` (hardcode รหัส ห้ามใช้ `/api/:studentId`)
- Success: `{ "success": true, "data": ..., "timestamp": "..." }`
- Error: `{ "success": false, "error": { "code": "STRING_ERROR_CODE", "message": "..." }, "timestamp": "..." }` ห้ามส่งหน้า HTML ของ Express
- ใช้ `AppError(message, statusCode, errorCode)` + `errorHandler(err, req, res, next)` กลางที่เดียว

| ข้อ | Endpoint | สำเร็จ | Error ที่ต้องรองรับ |
|---|---|---|---|
| 1 Simple — Office by ID (String PK) | `GET /offices/:officeCode` (เช่น `1`, `4`) | 200 + data | ไม่พบ → 404 `OFFICE_NOT_FOUND` (ห้ามส่ง `{}` หรือ `null`) |
| 2 Simple — Create Product Line (String PK, ไม่ auto increment) | `POST /productlines` body `{"productLine":"Electric Vehicles","textDescription":"..."}` | 201 | ไม่มี/ว่าง → 400 `VALIDATION_ERROR` · ซ้ำ (ER_DUP_ENTRY 1062) → 409 `DUPLICATE_KEY` |
| 3 Intermediate — Update Employee (FK 2 ตัว) | `PUT /employees/:employeeNumber` | 200 | ไม่พบ → 404 `EMPLOYEE_NOT_FOUND` · email ผิดรูปแบบ → 400 `INVALID_EMAIL` · officeCode/reportsTo ไม่มีจริง (ER_NO_REFERENCED_ROW_2 1452) → 400 `FOREIGN_KEY_NOT_FOUND` |
| 4 Intermediate — Delete Customer (FK RESTRICT) | `DELETE /customers/:customerNumber` | **200** + `{"message":"Customer record successfully deleted"}` | ไม่พบ → 404 `CUSTOMER_NOT_FOUND` · มี orders/payments (ER_ROW_IS_REFERENCED_2 1451) → 409 `RESOURCE_IN_USE` |
| 5 Intermediate — Create Payment (Composite PK) | `POST /customers/:customerNumber/payments` body `{"checkNumber":"HQ336338","paymentDate":"2026-09-18","amount":2500.50}` | 201 | ไม่พบลูกค้า → 404 `CUSTOMER_NOT_FOUND` · amount ไม่ใช่ตัวเลข > 0 หรือ paymentDate ไม่ใช่ YYYY-MM-DD → 400 `INVALID_PAYMENT_DATA` · checkNumber ซ้ำของลูกค้าคนเดิม → 409 `DUPLICATE_KEY` |

ทดสอบ: `npm start` แล้ว `node tests/test-runner.mjs 67130599999` (ข้อ 4 ลบลูกค้า 169 จริง ถ้าจะรันซ้ำให้รัน SQL ใหม่ก่อน)

