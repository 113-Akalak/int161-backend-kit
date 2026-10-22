# INT161 Backend Kit

ชุดเครื่องมือสำหรับสอบปฏิบัติ INT161 Basic Backend Development (Express 5 + MySQL) แบบ offline

ทำงานได้โดยไม่ต้องใช้เน็ตและไม่ต้องลง package เพิ่ม ใช้แค่ Node.js ที่มีอยู่

| ส่วน | ทำอะไร |
|---|---|
| `kit/gen.mjs` | อ่าน `init-database.sql` + ไฟล์สเปค `.md` แล้วสร้างโค้ดแบบ layer ตามที่อาจารย์สอน (route → service → repository + mapper + AppError + pagination) |
| `kit/selftest.mjs` | ยิงทดสอบทุก endpoint: envelope, pagination, DTO, 400/404/409, CRUD, filter, sort, nested route |
| `kit/doctor.mjs` | ตรวจเครื่องก่อนเริ่ม: Node, package, app.js, การต่อ MySQL, port 3000 |
| `kit/pack.mjs` | zip งานส่งเป็น `<รหัส>_exam.zip` โดยตัด `node_modules` ออกและตรวจไฟล์ให้ |
| `kit/offline-install.mjs` | ถ้า `npm install` ไม่ได้ จะแตก `vendor/node_modules.zip` (express 5, mysql2, http-status) ลงโปรเจกต์ |
| `core/` | ไฟล์กลางที่ใช้ได้กับทุกโจทย์: `error-handler.js`, `api-response.js`, `pagination-middleware.js` |
| `example/` | เฉลยข้อสอบซ้อม 9 ต.ค. ที่ gen สร้าง (ผ่าน test 100/100) เปิดอ่านโค้ดได้ทันที |
| `docs/` | [วันสอบทีละขั้น](docs/EXAM-DAY.md) · [Cheatsheet](docs/CHEATSHEET.md) · [โจทย์แบบต่าง ๆ](docs/SCENARIOS.md) · [error ที่เจอบ่อย](docs/PITFALLS.md) |

> **ก่อนใช้จริง** อาจารย์บอกว่าใช้เน็ตได้แค่ 15 นาทีแรก หลังจากนั้นเปิดเน็ตถือว่าทุจริต แต่ไม่ได้บอกชัดว่า**เปิดโค้ดหรือเครื่องมือที่เตรียมมาเองได้หรือไม่**
> ให้ถามอาจารย์หรือ TA ให้ชัดก่อนวันสอบ ถ้าไม่อนุญาต ให้ใช้ชุดนี้แค่ฝึกและอ่าน `example/` กับ `docs/` จนเขียนเองได้

---

## วันสอบแบบสั้น (Windows cmd)

```bat
:: 1) ช่วง 15 นาทีแรกที่ใช้เน็ตได้
::    โหลดไฟล์ของอาจารย์ (spec .md, template, init-database.sql, tests) และโหลด kit นี้:
::    https://github.com/aklkbqx/int161-backend-kit/archive/refs/heads/main.zip
::    แตก zip ไว้ข้างกัน เช่น  Desktop\exam\<โปรเจกต์>  และ  Desktop\exam\int161-backend-kit-main
cd Desktop\exam\<โปรเจกต์>
npm install
::    ถ้า npm install ไม่ได้:  node ..\int161-backend-kit-main\kit\offline-install.mjs .
mysql -u root -p < database\init-database.sql
::    (หรือใช้ WebStorm: Data Source > คลิกขวา > SQL Scripts > Run SQL Script)
::    >>> ปิดเน็ต <<<

:: 2) ตรวจเครื่อง แล้วสร้างโค้ด
node ..\int161-backend-kit-main\kit\doctor.mjs .
node ..\int161-backend-kit-main\kit\gen.mjs . --app

:: 3) รัน server ไว้หน้าต่างหนึ่ง แล้วทดสอบอีกหน้าต่าง
npm start
node tests\test-runner.mjs <รหัส>
node ..\int161-backend-kit-main\kit\selftest.mjs .

:: 4) ส่งงาน
node ..\int161-backend-kit-main\kit\pack.mjs .
```

ขั้นตอนละเอียด รวมสิ่งที่ต้องเตรียมก่อนวันสอบ อยู่ใน [docs/EXAM-DAY.md](docs/EXAM-DAY.md)

---

## gen.mjs ทำงานอย่างไร

```
init-database.sql ─┐
                   ├─> work/<โปรเจกต์>.config.json ─> src/ (repo, service, route, mapper, api-router, app.js)
exam-spec.md ──────┘        (แก้ได้)
```

1. **อ่าน SQL:** ชื่อ database, ตาราง, คอลัมน์และชนิด, PK (รวม String PK และ Composite PK), UNIQUE, FK, `ON DELETE`, ค่าที่เขียนไว้ใน comment เช่น `-- AVAILABLE, OUT_OF_STOCK`
2. **อ่านสเปค (ถ้ามี):** รหัสนักศึกษา, ชื่อ, Secret Key, path ของแต่ละ endpoint, ฟิลด์ของ Summary/Detail DTO (เอาจากตัวอย่าง JSON ในสเปค), list ไหนต้องมี `pagination`, DELETE ตอบ 204 หรือ 200 + message
3. **เขียน config** ไว้ที่ `work/<ชื่อโฟลเดอร์>.config.json` ในโฟลเดอร์ kit (config ไม่ได้อยู่ในโปรเจกต์ที่ส่ง)
4. **สร้างโค้ด:**
   - ไฟล์ที่ template มีอยู่แล้ว (`db-config.js`, `AppError`, `apiResponse`, `queryParser`) จะใช้ของเดิม ไม่ทับ
   - ไฟล์ที่ยังไม่มีจะสร้างจาก `core/`
   - ถ้ามี `app.js` อยู่แล้ว `--app` จะ**เพิ่มบรรทัด**ที่ขาดเท่านั้น ไม่ลบหรือย้ายบรรทัดเดิม ข้อมูลที่อาจารย์ฝังไว้ใน template จึงยังอยู่ครบ
   - ถ้าไม่ใส่ `--app` จะพิมพ์บรรทัดที่ต้องเพิ่มออกมาให้ copy เอง

**สิ่งที่โค้ดที่สร้างทำได้ (ทุก resource)**

- `GET /<resources>` รองรับ:
  - `?page&limit` คืน `pagination` (`total`, `page`, `limit`, `totalPages`, `hasNextPage`, `hasPrevPage`)
  - filter ทุกคอลัมน์ที่เหมาะ เช่น FK, status/category, `min/maxPrice`, ช่วงวันที่, `?search=`
  - `?sort=price&order=desc` หรือ `?sort=-price`
  - `?view=full` เพื่อคืน Detail DTO
- `GET /<resources>/:id` คืน Detail DTO (JOIN ชื่อจากตารางแม่ เช่น `brandName`) หรือ 404 `<ENTITY>_NOT_FOUND`
- `POST` คืน 201 หรือ error ตามกรณี:
  - 400 `VALIDATION_ERROR` เมื่อไม่ส่งฟิลด์ที่บังคับ, ตัวเลขผิด, ติดลบ, วันที่ไม่ใช่ YYYY-MM-DD, ค่าไม่อยู่ใน ENUM หรือยาวเกิน
  - 400 `INVALID_EMAIL`
  - 400 `FOREIGN_KEY_NOT_FOUND`
  - 409 `DUPLICATE_KEY`
- `PUT` / `PATCH` แก้เฉพาะฟิลด์ที่ส่งมา คืน 200, 404 หรือ 400/409
- `DELETE` คืน 204 (ไม่มี body) หรือ 200 + `{message}` ถ้าลบตารางแม่ที่ยังมีลูกจะได้ 409 `RESOURCE_IN_USE`
- nested route: `GET/POST /<parents>/:id/<children>`
- รับ request body ได้ทั้ง `snake_case` และ `camelCase` และตัดฟิลด์ที่ไม่รู้จักทิ้ง
- `DECIMAL` แปลงเป็น number และ `DATE` เป็น `"YYYY-MM-DD"` ได้ แม้ `db-config` ของอาจารย์จะไม่ได้ตั้ง `decimalNumbers` หรือ `dateStrings`
- error ทุกตัวเป็น JSON `{success:false, error:{code,message}, timestamp}` รวมถึง route ที่ไม่มีและ body ที่ไม่ใช่ JSON

### คำสั่ง gen

```bash
node kit/gen.mjs <project>                 # ครั้งแรก: สร้าง config แล้วสร้างโค้ด
node kit/gen.mjs <project> --app           # และเพิ่มบรรทัดที่ขาดลง app.js เดิม
node kit/gen.mjs <project> --dry           # ดูว่าจะสร้างหรือแก้ไฟล์อะไร โดยยังไม่เขียน
node kit/gen.mjs init <project>            # สร้าง config ใหม่อย่างเดียว (หลังแก้ SQL/spec)
node kit/gen.mjs build <project> --force   # สร้างโค้ดใหม่จาก config ที่แก้แล้ว (ไฟล์เก่าเก็บไว้ที่ work/backup)
node kit/gen.mjs set <project> customers.delete.status=200 payments.validation.code=INVALID_PAYMENT_DATA
```

ตัวเลือกเพิ่ม: `--sql <file>` `--spec <file>` `--id <รหัส>` `--name "<ชื่อ>"` `--secret <key>` `--password <รหัส MySQL>`

### ค่าใน config ที่แก้บ่อย

ถ้าค่ามีช่องว่างหรือ `[ ]` ให้ครอบทั้งก้อนด้วย `"..."` ซึ่งใช้ได้ทั้ง cmd และ bash/zsh

| อยากได้ | คำสั่ง |
|---|---|
| path ไม่ตรงสเปค เช่น `/product-lines` | `set <p> productlines.path=product-lines` |
| DELETE ตอบ 200 + message | `set <p> customers.delete.status=200 "customers.delete.message=Customer record successfully deleted"` |
| error code ของ validation เป็นชื่ออื่น | `set <p> payments.validation.code=INVALID_PAYMENT_DATA` |
| ตัวเลขต้องเป็น number จริง (`"5"` ไม่ผ่าน) | `set <p> payments.validation.strictNumbers=true` |
| จำกัดค่าที่ส่งได้ | `set <p> "products.validation.oneOf.status=[AVAILABLE,OUT_OF_STOCK]"` |
| list ต้องแบ่งหน้าเสมอ หรือไม่แบ่งเลย | `set <p> brands.listPagination=always` (หรือ `optional`, `never`) |
| boolean ออกเป็น true/false | `set <p> brands.booleanAs=boolean` |
| เปลี่ยนชื่อฟิลด์ใน DTO | แก้ `summary` / `detail` ใน config (key คือชื่อใน JSON, value คือคอลัมน์) แล้วรัน `build --force` |

ตัวอย่างอื่น ๆ และวิธีแก้โค้ดด้วยมือ อยู่ใน [docs/SCENARIOS.md](docs/SCENARIOS.md)

---

## ฝึกที่บ้าน

```bash
# ลองกับโจทย์จำลองใน fixtures/ (mobile, library, classicmodels)
mkdir -p ~/practice/mobile/database && cp fixtures/mobile/init-database.sql ~/practice/mobile/database/ && cp fixtures/mobile/exam-spec.md ~/practice/mobile/
node kit/gen.mjs ~/practice/mobile
cd ~/practice/mobile && npm install && npm start          # ต้องมี MySQL และรัน init-database.sql แล้ว

# ไม่มี MySQL: ใช้ SQLite sandbox (Node 22.15+) ไว้ลองเล่น API
node kit/dev/sandbox.mjs ~/practice/mobile --port 3000
```

**ทดสอบ kit เอง:** `npm test` จะสร้างโปรเจกต์จาก fixture ทุกตัว แล้วรัน selftest และ test-runner ของโจทย์นั้นบน SQLite (ต้องใช้ Node 22.15+ ไม่ใช้เน็ต) ตอนนี้ผ่าน 24/24 ขั้น และ test-runner ของทุกโจทย์ได้คะแนนเต็ม

**ข้อจำกัด**
- ทดสอบกับ SQLite ที่จำลอง `mysql2` เท่านั้น ยังไม่ได้รันกับ MySQL จริง ควรลองบนเครื่องที่มี MySQL อย่างน้อย 1 รอบก่อนสอบ
- `fixtures/*/test-runner.mjs` เขียนเลียนแบบหมวดคะแนนของอาจารย์ ไม่ใช่ไฟล์จริงของอาจารย์

## โครงสร้าง

```
core/src/            ไฟล์กลาง (copy ลงโปรเจกต์เมื่อ template ยังไม่มี)
kit/                 gen, selftest, doctor, pack, offline-install
kit/lib/             sql-parser, spec-parser, plan (config), templates, app-patch, zip
kit/dev/             sandbox (SQLite), build-vendor (สร้าง vendor/node_modules.zip ใหม่)
kit/test/run-all.mjs regression test ของ kit
fixtures/            โจทย์จำลอง 3 ชุด: SQL + spec + test-runner
example/             โปรเจกต์ที่สร้างจาก fixtures/mobile (ข้อสอบซ้อม 9 ต.ค.)
vendor/              node_modules.zip สำหรับติดตั้งแบบ offline + VERSIONS.txt
work/                (ไม่ commit) config, backup, report ของแต่ละโปรเจกต์
```

ข้อมูลนักศึกษาทั้งหมดในชุดนี้เป็นค่าสมมติ (`67130599999`, `Firstname Lastname`) ห้าม commit ไฟล์สเปคจริงของตัวเองขึ้น repo นี้

License: MIT
