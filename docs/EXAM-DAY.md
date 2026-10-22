# วันสอบปฏิบัติ ทีละขั้น

ข้อมูลจากคาบซ้อมสอบ 9 ต.ค. 2026 และ course outline
- สอบปฏิบัติ 2 ชั่วโมง คิดเป็น 20% ของเกรด
- ใช้เน็ตได้แค่ 15 นาทีแรก หลังจากนั้นเปิดเน็ตถือว่าทุจริต
- ได้ไฟล์ของตัวเองคนละชุด: exam spec `.md`, template โปรเจกต์ (ไม่มี `node_modules`), `init-database.sql` และ test
- คะแนนจาก `node tests/test-runner.mjs <รหัส>` แปลงตามสัดส่วนตรง ๆ

---

## ก่อนวันสอบ

**ต้องทำ**
- [ ] **ถามอาจารย์หรือ TA:** "เปิดโค้ดหรือไฟล์ที่เตรียมมาเอง หรือโหลดของตัวเองในช่วง 15 นาทีแรก ได้ไหม" ถ้าไม่ได้ ให้ใช้ kit แค่ฝึก
- [ ] ถามด้วยว่าส่งงานทาง LEB2 ตอนไหน เพราะต้องใช้เน็ต (เปิดเน็ตตอนส่งได้หรือไม่)
- [ ] เช็กวัน เวลา และห้องสอบใน Teams ของรายวิชา (ช่วงสอบตาม outline คือ 19–26 ต.ค.)
- [ ] เตรียมสอบข้อเขียนด้วย ซึ่งมีน้ำหนัก 30% มากกว่าปฏิบัติ

**เครื่องที่จะใช้สอบ**
- [ ] Node.js 20 หรือ 22 LTS: ตรวจด้วย `node -v` และ `npm -v`
- [ ] MySQL 8 เปิดอยู่และรู้รหัส root (เครื่องแล็บใช้ `root` / `mysql@sit`)
  - ทดสอบ `mysql -u root -p`
  - ถ้า cmd ไม่รู้จักคำสั่ง `mysql` ให้ใช้ WebStorm Run SQL Script แทน หรือเพิ่ม `C:\Program Files\MySQL\MySQL Server 8.x\bin` ใน PATH
- [ ] WebStorm หรือ VS Code มี Data Source ต่อ MySQL ได้ และเคยลอง Run SQL Script แล้ว
- [ ] รู้วิธีปิดเน็ตเร็ว ๆ (ปิด Wi-Fi หรือเปิดโหมดเครื่องบิน) และรู้ว่าปิดแล้วจริง
- [ ] แบตเต็ม เอาสายชาร์จไปด้วย

**ซ้อม**
- [ ] จับเวลา 2 ชั่วโมงและปิดเน็ต ซ้อมกับ `fixtures/mobile`, `fixtures/library`, `fixtures/classicmodels` อย่างน้อย 2 รอบ
- [ ] ซ้อมเขียนเองโดยไม่ใช้ gen อย่างน้อย 1 รอบ (อ่าน `example/` ประกอบ) เผื่อไม่อนุญาตให้ใช้เครื่องมือ
- [ ] จำลำดับใน app.js ให้ได้: `express.json()` → `queryParser()` → student-info → routers → `notFoundHandler` → `errorHandler` → `listen`
- [ ] ลอง `node kit/doctor.mjs <project>` บนเครื่องที่จะใช้สอบ ให้ผ่านทุกข้อ

---

## 0–15 นาที (ยังใช้เน็ตได้)

ทำให้เสร็จก่อนปิดเน็ต เพราะหลังจากนั้นโหลดอะไรไม่ได้แล้ว

1. **โหลดไฟล์ของอาจารย์ให้ครบ**
   - spec `.md`
   - template zip
   - `init-database.sql`
   - `tests.zip` ถ้ามี
2. **โหลด kit (ถ้าอนุญาต)** จาก `https://github.com/113-Akalak/int161-backend-kit/archive/refs/heads/main.zip`
3. **แตก zip ทั้งหมด** เช่น
   ```
   Desktop\exam\<โปรเจกต์>\               <- template ของอาจารย์ (ตัวที่จะส่ง)
   Desktop\exam\int161-backend-kit-main\  <- kit
   ```
   แตก `tests.zip` ลงในโปรเจกต์ให้ได้ `tests\test-runner.mjs`
4. **ติดตั้ง package:** `cd Desktop\exam\<โปรเจกต์>` แล้ว `npm install`
   - ถ้า error ให้ใช้ `node ..\int161-backend-kit-main\kit\offline-install.mjs .`
5. **สร้าง database**
   - cmd: `mysql -u root -p < database\init-database.sql` (ถ้าไฟล์ไม่ได้อยู่ใน `database\` ให้ใส่ path ตรง ๆ)
   - WebStorm: Database > Data Source > คลิกขวา > SQL Scripts > Run SQL Script > เลือกไฟล์ > Refresh แล้วติ๊กชื่อ database ให้แสดง
6. **ปิดเน็ต**

## 15–30 นาที: ทำให้ server ขึ้นก่อน

```bat
set KIT=..\int161-backend-kit-main
node %KIT%\kit\doctor.mjs .
```

แก้ทุกข้อที่ขึ้น ✗ ก่อน โดยเฉพาะ MySQL และ password ใน `db-config.js`

```bat
node %KIT%\kit\gen.mjs . --app
```

- **ตรวจผลลัพธ์**
  - path ตรงกับสเปคไหม (`/brands`, `/products`)
  - summary/detail ตรงกับตัวอย่าง JSON ในสเปคไหม
  - รหัส, ชื่อ, Secret Key ถูกไหม (เทียบกับหัวไฟล์สเปค)
- **ถ้าขึ้น `!`** ให้อ่านแล้วแก้ด้วย `gen.mjs set ...` หรือแก้ config แล้ว `gen.mjs build . --force`
- **เปิด `src/app.js` ดูด้วยตา**
  - มี `const STUDENT_ID = '<รหัส>';`
  - router อยู่ใต้ `BASE_PATH`
  - `errorHandler` อยู่ท้ายสุด

## 30–100 นาที: ทดสอบและแก้

หน้าต่างที่ 1:
```bat
npm start
```
หน้าต่างที่ 2:
```bat
node tests\test-runner.mjs <รหัส>          :: ของอาจารย์ (ตัวที่ใช้ให้คะแนนจริง)
node %KIT%\kit\selftest.mjs .              :: ของ kit (ตรวจกว้างกว่า ใช้หาจุดพลาด)
```

**วนทำ:** อ่าน FAIL → แก้ → **restart server** → รัน test ใหม่
- WebStorm ถามว่า "Stop and Rerun" ให้กด ไม่งั้นยังรันโค้ดเก่า
- ถ้าใช้ `npm run dev` (`node --watch`) server จะ restart เอง

| test บอก | ดูที่ |
|---|---|
| 404 ทุกข้อ | base path หรือรหัสใน `app.js` |
| keys ไม่ตรง | `summary`/`detail` ใน config หรือใน `<x>-mapper.js` |
| total/totalPages ผิด | `count()` ต้องใช้ WHERE เดียวกับ `findAll()` |
| 500 | ดู error ในหน้าต่าง `npm start` แล้วเทียบกับ [PITFALLS.md](PITFALLS.md) |
| error code ไม่ตรง | `gen.mjs set . <resource>.validation.code=...` หรือแก้ string ใน service |

ข้อที่ test ของอาจารย์ผ่านแล้ว อย่าไปแก้โค้ดส่วนนั้นอีกถ้าไม่จำเป็น

## 100–115 นาที: ส่งงาน

```bat
node %KIT%\kit\pack.mjs .
```

- ได้ `Desktop\exam\<รหัส>_exam.zip` ที่ไม่มี `node_modules` และตรวจไฟล์ในนั้นแล้ว
- ถ้าจะ zip เอง: คลิกขวาโฟลเดอร์ (หลังย้าย `node_modules` ออกไปไว้ที่อื่น) > Send to > Compressed folder แล้วตั้งชื่อ `<รหัส>_exam.zip`
- ส่งทาง LEB2 ตามที่อาจารย์กำหนด

## ก่อนกดส่ง

- [ ] `node tests\test-runner.mjs <รหัส>` ได้คะแนนตามที่คาด
- [ ] `src/app.js` มีรหัสของตัวเอง และ `/student-info` คืนชื่อกับ Secret Key ตรงสเปค
- [ ] ไม่ได้แก้หรือลบไฟล์ที่อาจารย์ฝังข้อมูลไว้ใน template
- [ ] zip ไม่มี `node_modules` และชื่อไฟล์ `<รหัส>_exam.zip`
