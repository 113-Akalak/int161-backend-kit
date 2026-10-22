# Cheatsheet (Express 5 + mysql2 + MySQL)

## โครงโปรเจกต์ตามที่อาจารย์สอน

```
src/
  app.js                          express(), middleware, BASE_PATH, mount router, error handler, listen
  configs/db-config.js            mysql.createPool(...)  export default pool
  routes/<x>-route.js             รับ req -> เรียก service -> apiResponse (ไม่มี SQL)
  services/<x>-service.js         validate, เช็กซ้ำ/FK, เรียก repo, แปลง DTO ด้วย mapper
  repositories/<x>-repo.js        SQL ทั้งหมดของตารางนั้น (TABLE_NAME, FIND_ALL_SQL, ...)
  mappers/<x>-mapper.js           toSummaryDTO / toDetailDTO / maps / map
  mappers/api-response.js         apiResponse(res, data, pagination = null, status = 200)
  middlewares/error-handler.js    AppError + errorHandler(err, req, res, next)
  middlewares/pagination-middleware.js   queryParser() -> req.pagination = {page, limit, offset}
```

ESM: ใน `package.json` ต้องมี `"type": "module"` และ import ไฟล์ตัวเองต้องมี `.js` ต่อท้ายเสมอ

## app.js (ลำดับสำคัญ)

```js
import express from "express"
import apiRouter from "./routes/api-router.js"
import {queryParser} from "./middlewares/pagination-middleware.js"
import {errorHandler, notFoundHandler} from "./middlewares/error-handler.js"
import {apiResponse} from "./mappers/api-response.js"

const STUDENT_ID = '67130599999';
const BASE_PATH = `/api/${STUDENT_ID}`

const app = express()
app.use(express.json())          // 1 ก่อน router
app.use(queryParser())           // 2 มีวงเล็บ
app.get(`${BASE_PATH}/student-info`, (req, res) =>
    apiResponse(res, {studentId: STUDENT_ID, name: "Firstname Lastname", secretKey: "67FiLa"}))
app.use(BASE_PATH, apiRouter)    // 3 ทุก resource ชื่อพหูพจน์ตัวเล็ก
app.use(notFoundHandler)         // 4 404 JSON
app.use(errorHandler)            // 5 ท้ายสุด
app.listen(3000)
```

## Response format

```json
{ "success": true, "data": { }, "timestamp": "2026-10-08T15:00:00.000Z" }
{ "success": true, "data": [ ], "pagination": { "total": 75, "page": 1, "limit": 10, "totalPages": 8, "hasNextPage": true, "hasPrevPage": false }, "timestamp": "..." }
{ "success": false, "error": { "code": "PRODUCT_NOT_FOUND", "message": "..." }, "timestamp": "..." }
```

- `offset = (page - 1) * limit`
- `totalPages = Math.ceil(total / limit)`
- `hasNextPage = page < totalPages`
- `hasPrevPage = page > 1`

## HTTP status ที่ใช้ในวิชา

| status | ใช้เมื่อ | วิธีส่ง |
|---|---|---|
| 200 OK | GET, PUT, PATCH สำเร็จ / DELETE ที่สเปคให้คืน message | `apiResponse(res, data)` |
| 201 Created | POST สำเร็จ | `apiResponse(res, data, null, 201)` |
| 204 No Content | DELETE สำเร็จ **ไม่มี body** | `res.status(204).end()` |
| 400 Bad Request | ข้อมูลไม่ครบ/ผิดรูปแบบ, FK ไม่มีจริง, JSON เสีย | `throw new AppError(msg, 400, "VALIDATION_ERROR")` |
| 404 Not Found | ไม่พบ id / route ไม่มี | `throw new AppError(msg, 404, "PRODUCT_NOT_FOUND")` |
| 409 Conflict | UNIQUE ซ้ำ / ลบแม่ที่ยังมีลูก | `"DUPLICATE_KEY"` / `"RESOURCE_IN_USE"` |
| 500 | bug / DB ล่ม | errorHandler ตั้งให้เอง |

## MySQL error → HTTP

| err.code | errno | ความหมาย | ส่ง |
|---|---|---|---|
| `ER_DUP_ENTRY` | 1062 | UNIQUE/PK ซ้ำ | 409 `DUPLICATE_KEY` |
| `ER_NO_REFERENCED_ROW_2` | 1452 | FK ชี้ไปแถวที่ไม่มี | 400 `FOREIGN_KEY_NOT_FOUND` |
| `ER_ROW_IS_REFERENCED_2` | 1451 | ลบแม่ที่ยังมีลูก | 409 `RESOURCE_IN_USE` |
| `ER_BAD_NULL_ERROR` | 1048 | ส่ง null ให้ NOT NULL | 400 |
| `ER_NO_DEFAULT_FOR_FIELD` | 1364 | ไม่ส่งคอลัมน์ที่ไม่มี DEFAULT | 400 |
| `ER_TRUNCATED_WRONG_VALUE` | 1292 | วันที่/ตัวเลขผิดรูปแบบ | 400 |
| `ER_DATA_TOO_LONG` | 1406 | string ยาวเกิน | 400 |
| `ER_BAD_FIELD_ERROR` | 1054 | ชื่อคอลัมน์ผิด | 400 / แก้โค้ด |
| `ER_ACCESS_DENIED_ERROR` | 1045 | password ผิด | แก้ db-config |
| `ER_BAD_DB_ERROR` | 1049 | ไม่มี database | รัน init-database.sql |
| `ECONNREFUSED` | — | MySQL ไม่ได้เปิด | เปิด service |

## mysql2/promise

```js
import mysql from "mysql2/promise"
const pool = mysql.createPool({host: "localhost", user: "root", password: "mysql@sit", database: "x",
    decimalNumbers: true, dateStrings: ["DATE"]})

const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [id])      // rows = array
const [[row]] = await pool.query("SELECT COUNT(*) AS total FROM products")        // แถวเดียว
const [result] = await pool.query("INSERT INTO products SET ?", [entity])         // result.insertId
const [result] = await pool.query("UPDATE products SET ? WHERE id = ?", [entity, id])  // result.affectedRows
const [result] = await pool.query("DELETE FROM products WHERE id = ?", [id])      // affectedRows 0 = ไม่มี
await pool.query("SELECT * FROM t LIMIT ? OFFSET ?", [limit, offset])              // ใช้ query() ไม่ใช่ execute()
```

- ห้ามต่อค่าจากผู้ใช้เข้า SQL ตรง ๆ ใช้ `?` เสมอ
- ชื่อคอลัมน์ใน `ORDER BY` ใช้ `?` ไม่ได้ ต้อง whitelist

## SQL ที่ใช้บ่อย

```sql
-- list + filter + sort + page
SELECT p.* FROM products p WHERE p.category = ? AND p.price >= ? ORDER BY p.price DESC LIMIT ? OFFSET ?;
SELECT COUNT(*) AS total FROM products p WHERE p.category = ? AND p.price >= ?;   -- WHERE เดียวกัน
-- detail + ชื่อจากตารางแม่
SELECT p.*, b.name AS brand_name FROM products p LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ?;
-- ค้นหา
SELECT * FROM products WHERE name LIKE ? OR sku LIKE ?;    -- params: [`%${q}%`, `%${q}%`]
-- นับลูกต่อแม่
SELECT b.id, b.name, COUNT(p.id) AS product_count
FROM brands b LEFT JOIN products p ON p.brand_id = b.id GROUP BY b.id, b.name ORDER BY product_count DESC;
-- สรุปตัวเลข
SELECT category, COUNT(*) AS count, AVG(price) AS avg_price, MIN(price) AS min_price, MAX(price) AS max_price
FROM products GROUP BY category HAVING COUNT(*) > 1;
-- ลูกของแม่
SELECT * FROM products WHERE brand_id = ? LIMIT ? OFFSET ?;
```

## Express 5 ที่ต่างจาก 4

- error ที่ `throw` ใน `async` handler ไปถึง `errorHandler` เอง ไม่ต้อง `try/catch` หรือ `next(err)`
- `req.query` แก้ค่าไม่ได้ (read-only getter) ให้เก็บค่าที่คำนวณแล้วไว้ใน `req.pagination`
- path แบบ `*` ต้องมีชื่อ เช่น `/*splat` (404 handler ใช้ `app.use((req,res)=>...)` แทนได้เลย)
- path ใน `app.get()` ห้ามมี `)` หลงเข้าไปใน backtick ไม่งั้นแอปพังตอนเริ่ม (`PathError: Unexpected )`)

## Router

```js
const router = express.Router()
router.get("/", list)                     // ประกาศ path คงที่ (/stats, /search) ก่อน "/:id"
router.get("/stats/count", stats)
router.get("/:id", getOne)
router.get("/:id/products", childrenOf)   // nested One-to-Many
router.post("/", create)
router.put("/:id", update)
router.patch("/:id", update)
router.delete("/:id", remove)
export default router
```

## คำสั่ง cmd ที่ใช้บ่อย

```bat
node -v & npm -v
npm install                    :: ติดตั้งตาม package.json
npm start                      :: node src/app.js
mysql -u root -p < database\init-database.sql
netstat -ano | findstr :3000   :: ใครใช้ port 3000 (taskkill /PID <pid> /F)
curl http://localhost:3000/api/<รหัส>/products?page=1^&limit=2     :: ใน cmd ใช้ ^& แทน &
```
