# โจทย์แบบต่าง ๆ และวิธีรับมือ

แต่ละข้อมี 2 ทาง:
- **ทาง config:** ใช้ `gen.mjs set` หรือแก้ `work/<project>.config.json` แล้ว `gen.mjs build <project> --force`
- **ทางแก้โค้ดเอง:** ใช้ได้ทั้งตอนไม่ได้ใช้ gen และตอนที่อยากแก้แค่จุดเดียว

`<p>` ในคำสั่งคือ path ของโปรเจกต์ เช่น `.`

---

## 1. path ในสเปคไม่ตรงชื่อตาราง

สเปคใช้ `/product-lines` แต่ตารางชื่อ `productlines`

```bash
node kit/gen.mjs set <p> productlines.path=product-lines
```
ถ้าแก้เอง ให้แก้ใน `src/routes/api-router.js`: `router.use("/product-lines", productlineRouter)`

กติกา REST ที่อาจารย์เน้น: ใช้พหูพจน์ ตัวเล็ก คั่นคำด้วย `-` และอยู่ใต้ `/api/<รหัส>` เสมอ

## 2. ชื่อฟิลด์ใน DTO ต่างจากคอลัมน์

ใน config `summary` และ `detail` เป็นคู่ `"ชื่อใน JSON": "คอลัมน์"`
- ถ้ามีสเปค gen จะใช้ key จากตัวอย่าง JSON ให้แล้ว
- ถ้าต้องแก้ ให้แก้ใน config เช่น
```json
"detail": { "productId": "id", "productName": "name", "brand": "brand_name" }
```
ถ้าแก้เอง ให้แก้ `toSummaryDTO` / `toDetailDTO` ใน `src/mappers/<x>-mapper.js`

- **ชื่อจากตารางแม่ (เช่น `brandName`)** มาจาก `LEFT JOIN` ใน `FROM_SQL` ของ repo และ `SELECT_SQL` ที่ได้ alias `brand_name`
- **อยากได้คอลัมน์อื่นของแม่ด้วย** ให้เพิ่มใน `SELECT_SQL` เช่น `, b.country_of_origin AS brand_country` แล้วใส่ใน DTO

## 3. list ต้องแบ่งหน้า หรือไม่ต้อง

```bash
node kit/gen.mjs set <p> brands.listPagination=always     # แบ่งเสมอ (ไม่ส่ง ?page ก็ได้ page 1)
node kit/gen.mjs set <p> brands.listPagination=optional   # แบ่งเฉพาะเมื่อส่ง ?page หรือ ?limit
node kit/gen.mjs set <p> brands.listPagination=never      # คืนทั้งหมดเสมอ
```
- **เปลี่ยน limit เริ่มต้น:** ใน `app.js` ใช้ `app.use(queryParser(20))` (ค่าแรกคือ default limit ค่าที่สองคือ max)
- **สเปคใช้ชื่ออื่น เช่น `?size=` หรือ `?pageSize=`:** `queryParser` ของ core รองรับอยู่แล้ว

## 4. DELETE ตอบ 200 พร้อมข้อความ

```bash
node kit/gen.mjs set <p> customers.delete.status=200 "customers.delete.message=Customer record successfully deleted"
```
ได้ `{ "success": true, "data": { "message": "..." } }`

ถ้าสเปคต้องการ message อยู่นอก data ให้แก้ route เอง:
```js
res.status(200).json({success: true, message: "Customer record successfully deleted", timestamp: new Date().toISOString()})
```

## 5. error code ชื่ออื่น

| อยากเปลี่ยน | ทำที่ |
|---|---|
| 404 เช่น `CUSTOMER_NOT_FOUND` → `NOT_FOUND` | `set <p> customers.notFoundCode=NOT_FOUND` |
| 400 validation เช่น `INVALID_PAYMENT_DATA` | `set <p> payments.validation.code=INVALID_PAYMENT_DATA` |
| 400 email | `set <p> employees.validation.emailCode=INVALID_EMAIL` |
| 409 ซ้ำ / FK / in-use | แก้ string `"DUPLICATE_KEY"`, `"FOREIGN_KEY_NOT_FOUND"`, `"RESOURCE_IN_USE"` ใน service และ `MYSQL_ERRORS` ใน `error-handler.js` |

## 6. validation

| สเปคบอก | config |
|---|---|
| ฟิลด์บังคับเพิ่ม/ลด | `set <p> "products.validation.required=[sku,name,brand_id,price]"` |
| ค่าได้แค่บางค่า | `set <p> "products.validation.oneOf.status=[AVAILABLE,OUT_OF_STOCK,DISCONTINUED]"` |
| ต้องเป็น number จริง (`"5"` ไม่ผ่าน) | `set <p> payments.validation.strictNumbers=true` |
| ต้องมากกว่า 0 | `set <p> "payments.validation.positive=[amount]"` |
| ห้ามติดลบ | `set <p> "products.validation.nonNegative=[price,stock_quantity]"` |
| วันที่ต้องเป็น YYYY-MM-DD | `set <p> "orders.validation.dates=[orderDate,requiredDate]"` (gen ใส่ทุกคอลัมน์ DATE ให้อยู่แล้ว) |

ค่าที่เขียนไว้ใน comment ของ SQL (เช่น `-- FLAGSHIP, MID_RANGE`) จะแสดงเป็น `values:` ตอน gen แต่ยังไม่บังคับใช้ ต้องใส่ `oneOf` เองถ้าสเปคบอกให้ตรวจ

เขียนเอง: เพิ่มเงื่อนไขในฟังก์ชัน `validate()` ของ service แล้ว `throw new AppError(msg, 400, "CODE")`

## 7. PUT ต้องส่งครบทุกฟิลด์ (PATCH แก้บางฟิลด์)

โค้ดที่ gen สร้างให้ PUT กับ PATCH แก้บางฟิลด์ได้เหมือนกัน ถ้าสเปคบอกว่า PUT ต้องส่งครบ ให้แก้ route PUT แบบนี้:
```js
router.put("/:id", async (req, res) => {
    const object = await service.replaceObject(req.params.id, req.body)
    apiResponse(res, object)
})
```
และเพิ่มใน service:
```js
export async function replaceObject(id, body) {
    await repo.findOne(id)
    validate(mapper.toEntity(body), true)      // true = ตรวจ REQUIRED_ON_CREATE ครบทุกตัว
    return updateObject(id, body)
}
```

## 8. filter / search / sort เพิ่ม

`FILTERS` ใน `<x>-repo.js` มีหน้าตาแบบนี้ เพิ่มได้ทีละบรรทัด:
```js
{params: ["brandName"], sql: "b.name = ?"},                          // ใช้คอลัมน์ของตารางที่ JOIN ได้
{params: ["minRam"], sql: "p.ram_gb >= ?"},
{params: ["q"], sql: "(p.name LIKE ? OR b.name LIKE ?)", like: true}, // like: true ใส่ %...% ให้ทุก ?
{params: ["year"], sql: "YEAR(p.release_date) = ?"},
```
- ทุก `?` ใน `sql` ได้ค่าเดียวกัน
- `count()` ใช้ FILTERS ชุดเดียวกัน `total` จึงถูกต้องเสมอ

**sort เริ่มต้นแบบ desc** ให้แก้ `buildOrderBy` ตรง `query.order ?? "asc"` เป็น `"desc"` หรือ `set <p> products.defaultSort=price` (ใช้กับ asc)

**filter ที่รับหลายค่า (`?status=A,B`)**:
```js
{params: ["status"], sql: "FIND_IN_SET(p.status, ?)"}
```

## 9. endpoint สรุปข้อมูล (GROUP BY)

ตัวอย่าง `GET /brands/stats/product-count` ให้เพิ่ม 3 ชั้น:
```js
// brand-repo.js
export async function countProducts() {
    const [rows] = await db.query(`SELECT b.id, b.name, COUNT(p.id) AS product_count
        FROM brands b LEFT JOIN products p ON p.brand_id = b.id
        GROUP BY b.id, b.name ORDER BY product_count DESC`)
    return rows.map(r => ({...r, product_count: Number(r.product_count)}))
}
// brand-service.js
export async function getProductCounts() {
    return (await repo.countProducts()).map(r => ({brandId: r.id, brandName: r.name, productCount: r.product_count}))
}
// brand-route.js  (ต้องอยู่ก่อน router.get("/:id"))
router.get("/stats/product-count", async (req, res) => {
    apiResponse(res, await service.getProductCounts())
})
```
- `COUNT()` และ `SUM()` ใน MySQL อาจคืนเป็น string หรือ BigInt ให้ครอบด้วย `Number()`
- `AVG()` คืน DECIMAL ซึ่งเป็น string ถ้าไม่ได้ตั้ง `decimalNumbers`

## 10. One-to-Many (nested route)

gen สร้างให้ทุกคู่แม่-ลูกอัตโนมัติ:
- `GET /brands/:id/products?page=1&limit=10` คืน 404 ถ้าแม่ไม่มี และใช้ filter/sort ของลูกได้ด้วย
- `POST /brands/:id/products` บังคับ `brand_id` ให้เท่ากับ `:id`
- `DELETE /brands/:id` ถ้ายังมี products จะได้ 409 `RESOURCE_IN_USE` (ยกเว้น FK เป็น `ON DELETE CASCADE`)

## 11. PK ไม่ใช่ `id`

| แบบ | gen ทำให้ |
|---|---|
| String PK เช่น `officeCode`, `productLine` | route `/:id` แต่ WHERE ใช้ชื่อจริง, POST ต้องส่ง PK มาเอง, ซ้ำได้ 409 |
| Composite PK เช่น `(customerNumber, checkNumber)` | route `/:customerNumber/:checkNumber`, repo/service รับ 2 ค่า |
| PK ชื่ออื่นแต่ AUTO_INCREMENT เช่น `country_id` | WHERE / UPDATE / DELETE ใช้ `country_id` ทั้ง 3 ที่ |

ถ้าเขียนเอง ข้อนี้พลาดบ่อยมาก: `Unknown column 'id' in 'where clause'` แปลว่าลืมแก้ชื่อ PK

## 12. มากกว่า 2 ตาราง / ตารางเชื่อม (many-to-many)

gen สร้าง resource ให้ทุกตาราง และสร้าง nested route ให้ทุก FK (เช่น `order_items` ได้ `/orders/:id/order-items`)

ถ้าสเปคต้องการเฉพาะบางตาราง ให้ลบ resource ที่ไม่ใช้ออกจาก `resources` ใน config แล้ว `build --force` (หรือปล่อยไว้ก็ได้ endpoint ที่เกินมาไม่ทำให้เสียคะแนน)

## 13. boolean / วันที่ / ตัวเลข

| ปัญหา | ทาง |
|---|---|
| `is_active` ต้องเป็น `true/false` ไม่ใช่ `1/0` | `set <p> brands.booleanAs=boolean` |
| `price` เป็น `"48900.00"` | mapper ครอบ `toNumber()` ให้แล้ว หรือใส่ `decimalNumbers: true` ใน db-config |
| `releaseDate` เลื่อน 1 วัน (`...T17:00:00.000Z`) | mapper ครอบ `toDateOnly()` ให้แล้ว หรือใส่ `dateStrings: ["DATE"]` |
| `created_at` ต้องแสดงหรือไม่แสดง | เพิ่ม/ลบใน `summary` / `detail` ของ config |

## 14. template ของอาจารย์มีไฟล์บางส่วนให้แล้ว

| มีอะไรมา | gen ทำอะไร |
|---|---|
| `db-config.js` (createPool + export default) | ใช้ของอาจารย์ ไม่ทับ |
| `AppError` / `errorHandler` / `apiResponse` / `queryParser` | ใช้ของอาจารย์ และ import จากไฟล์นั้น ถ้า constructor ของ `AppError` เรียงพารามิเตอร์ต่างจาก `(message, statusCode, errorCode)` จะเตือน |
| `<x>-mapper.js` ที่ไม่มี `toEntity` | เก็บไว้ แล้วสร้าง `<x>-dto-mapper.js` ให้ service ใช้แทน |
| `app.js` | `--app` เพิ่มเฉพาะบรรทัดที่ขาด (import, STUDENT_ID, BASE_PATH, queryParser, student-info, router, handler) |
| `example-*.js` | ไม่แตะ |

ถ้า errorHandler ของอาจารย์ไม่แปลง MySQL error (เช่น ER_DUP_ENTRY แล้วได้ 500) ก็ไม่เป็นไร เพราะ service ที่ gen สร้างเช็กค่าซ้ำ, FK และ in-use ก่อนถึง DB แล้ว

## 15. response หน้าตาไม่เหมือนที่ core ทำ

แก้ `src/mappers/api-response.js` ที่เดียว ทุก endpoint จะเปลี่ยนตาม เช่นสเปคให้ pagination อยู่ใน `meta`:
```js
return res.status(statusCode).json({success: true, data, meta: {total, page, limit, totalPages}, timestamp: new Date().toISOString()})
```

## 16. ไม่ใช้ gen (เขียนเองทีละไฟล์)

ลำดับที่เร็วที่สุด โดยเปิด `example/src` ไว้ดูเทียบ:

1. **ทำให้ server ขึ้นก่อน**
   - `db-config.js`: แก้ database และ password
   - `app.js`: STUDENT_ID, BASE_PATH, `express.json()` และ `/student-info`
   - รัน test: identity ควรผ่าน 10 คะแนน
2. **ใส่ middleware:** copy `core/src/middlewares/*` และ `core/src/mappers/api-response.js` แล้วใส่ `queryParser()` กับ `notFoundHandler` / `errorHandler` ใน `app.js`
3. **ตารางแม่ (brands):** ทำ repo → service → route ด้วย `findAll` และ `findOne` ก่อน ได้อีก 10 คะแนน
4. **ตารางลูก (products):**
   - repo: `findAll` (LIMIT/OFFSET + `totalItems`) และ `findOne` (JOIN)
   - mapper: summary/detail
   - route: GET 2 ตัว
   - ส่วนนี้ได้คะแนนมากที่สุด
5. **POST / PUT / DELETE:** 201 / 200 / 204 และ 404
6. **409 ซ้ำ:** errorHandler แปลง `ER_DUP_ENTRY` ให้อยู่แล้ว
