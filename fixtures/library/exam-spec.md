# exam-spec-67130599999.md (Mock #2 — ฝึกเอง)

## ใบงานข้อสอบปฏิบัติการ: RESTful API Development (Express.js)
### ระบบบริการข้อมูล SIT Library Book Service

### ข้อมูลประจำตัวผู้เข้าสอบ (Student Profile)
> [IMPORTANT] ข้อมูลในส่วนนี้เป็นข้อมูลเฉพาะบุคคล ห้ามแก้ไขหรือนำของผู้อื่นมาใช้ ระบบตรวจข้อสอบจะตรวจรหัสและ Secret Key อัตโนมัติ

- รหัสนักศึกษา (Student ID): `67130599999`
- ชื่อ - นามสกุล: `Firstname Lastname`
- รหัสลับเฉพาะตัว (Secret Key): `67FiLa`
- เวลาในการทำข้อสอบ: 2 ชั่วโมง (120 นาที)
- ระดับความยาก: Beginner

---

## 1. การตั้งค่าโครงงานและระบบระบุตัวตน (Setup & Student Identity)

### 1.1 นำเข้าฐานข้อมูล
1. รันไฟล์ SQL นำเข้าฐานข้อมูล: `mysql -u root -p < database/init-database.sql`
2. ตรวจสอบการตั้งค่าการเชื่อมต่อใน `src/configs/db-config.js` ให้ตรงกับเครื่องของนักศึกษา (Database: `sit_library`)

### 1.2 กำหนดรหัสประจำตัวใน `src/app.js`
```js
const STUDENT_ID = '67130599999';
```
และตั้งค่า Routing ทั้งหมดภายใต้ Base Path: `/api/67130599999/...`

---

## 2. รายการ Endpoints เฉพาะของนักศึกษา (Customized Endpoints)
ทุก Endpoint ต้องใช้ Base Path ที่มีรหัสนักศึกษาเสมอ และต้องเขียนแบบ Layer (route → service → repository)

### 2.1 ระบบระบุตัวตน (Identity Verification) - 10 คะแนน
- Method: `GET` · Endpoint: `/api/67130599999/student-info` · Status: `200 OK`
```json
{
  "success": true,
  "data": { "studentId": "67130599999", "name": "Firstname Lastname", "secretKey": "67FiLa" },
  "timestamp": "2026-10-20T09:00:00.000Z"
}
```

### 2.2 บริการข้อมูลผู้แต่ง (Authors API) - 10 คะแนน
**[GET] รายการผู้แต่งทั้งหมด** · `/api/67130599999/authors` · `200 OK`
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "J.K. Rowling", "nationality": "British", "birth_year": 1965, "is_active": 1, "created_at": "2024-02-01T00:00:00.000Z" }
  ],
  "timestamp": "2026-10-20T09:00:00.000Z"
}
```
**[GET] ข้อมูลผู้แต่งตามรหัส ID** · `/api/67130599999/authors/:id` · `200 OK` (พบ) หรือ `404 Not Found` (ไม่พบ)

### 2.3 บริการข้อมูลหนังสือ (Books API) - 65 คะแนน

**1) [GET] รายการหนังสือแบบแบ่งหน้าและแปลง DTO (30 คะแนน)**
- Endpoint: `/api/67130599999/books`
- Query Parameters: `page` (เริ่มต้นที่ 1, ค่า default คือ 1), `limit` (เช่น 10)
- Summary DTO: `id`, `isbn`, `title`, `authorId`, `genre`, `price`, `status`
```json
{
  "success": true,
  "data": [
    { "id": 1, "isbn": "978-0747532699", "title": "Harry Potter and the Philosopher's Stone", "authorId": 1, "genre": "FANTASY", "price": 395, "status": "IN_STOCK" }
  ],
  "pagination": { "total": 18, "page": 1, "limit": 10, "totalPages": 2, "hasNextPage": true, "hasPrevPage": false },
  "timestamp": "2026-10-20T09:00:00.000Z"
}
```

**2) [GET] ดูรายละเอียดหนังสือตาม ID (Detail DTO) (10 คะแนน)**
- Endpoint: `/api/67130599999/books/:id` · `200 OK` หรือ `404 Not Found`
```json
{
  "success": true,
  "data": {
    "id": 12, "isbn": "978-0132350884", "title": "Clean Code", "authorId": 5, "authorName": "Robert C. Martin",
    "genre": "PROGRAMMING", "price": 1450, "pages": 464, "language": "English",
    "stockQuantity": 10, "status": "IN_STOCK", "publishedDate": "2008-08-01"
  },
  "timestamp": "2026-10-20T09:00:00.000Z"
}
```

**3) [POST] เพิ่มหนังสือใหม่ (10 คะแนน)** · `/api/67130599999/books` · `201 Created` หรือ `409 Conflict` เมื่อ ISBN ซ้ำ
```json
{
  "isbn": "978-6160000999", "title": "Test Book 2026", "author_id": 1, "genre": "FANTASY",
  "price": 499.00, "pages": 320, "language": "Thai", "stock_quantity": 10,
  "status": "IN_STOCK", "published_date": "2026-01-01"
}
```

**4) [PUT] แก้ไขข้อมูลหนังสือ (10 คะแนน)** · `/api/67130599999/books/:id` · `200 OK` หรือ `404 Not Found`

**5) [DELETE] ลบหนังสือ (5 คะแนน)** · `/api/67130599999/books/:id` · `204 No Content` (ไม่มี body) หรือ `404 Not Found`

### มาตรฐานร่วม (Standards & Error) - 15 คะแนน
- ทุก response (รวม error) ต้องมี `success` เป็น boolean และ `timestamp`
- Error ต้องเป็น JSON ที่มี `success: false` ห้ามส่งหน้า HTML ของ Express
- ใช้ resource พหูพจน์ตัวพิมพ์เล็ก (`/books`, `/authors`)

---

## 3. คำสั่งทดสอบระบบด้วยตนเองแบบ Offline (Self-Testing)
1. ตรวจว่า Express Server ทำงานที่พอร์ต 3000 (`npm start`)
2. เปิด Terminal อีกหน้าต่าง: `node tests/test-runner.mjs 67130599999`
3. หน้าจอจะแสดงสถานะการผ่านและคะแนนของแต่ละส่วน พร้อมสรุปคะแนนรวม (100 คะแนน)

## 4. ข้อกำหนดในการส่งงาน (Submission Checklist)
- [ ] ไฟล์ `src/app.js` กำหนดรหัสนักศึกษา `67130599999` ถูกต้อง
- [ ] Endpoint `/api/67130599999/student-info` ส่งคืนชื่อและ Secret Key ถูกต้อง
- [ ] รัน `node tests/test-runner.mjs 67130599999` ผ่านทุกกรณีทดสอบ
- [ ] บีบอัดเฉพาะโฟลเดอร์งาน (ตัดโฟลเดอร์ `node_modules` ออก) ตั้งชื่อไฟล์ `67130599999_exam.zip`

