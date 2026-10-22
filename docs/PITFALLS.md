# Error ที่เจอบ่อย

ส่วนใหญ่เห็นในคาบจริงและคาบซ้อมสอบ 9 ต.ค. เรียงตามที่เจอบ่อย

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| test บอก expected 200 got 404 **ทุกข้อ** | base path ไม่ตรง เช่นลืม `/api/<รหัส>` หรือพิมพ์รหัสผิด | `const STUDENT_ID = '<รหัส>';` แล้ว mount ทุก router ใต้ `` `/api/${STUDENT_ID}` `` |
| แอปพังตอนเริ่ม `PathError: Unexpected )` | วงเล็บปิดหลงเข้าไปใน backtick เช่น `` app.get(`/api/${ID}/student-info)`, ...) `` | ให้ `` ` `` ปิดก่อน `)` |
| request ค้าง ไม่ตอบเลย | `app.use(queryParser)` ไม่มีวงเล็บ หรือ middleware ไม่เรียก `next()` | `app.use(queryParser())` และ middleware ทุกตัวต้อง `next()` หรือส่ง response |
| `req.body` เป็น `undefined` | ไม่มี `app.use(express.json())` หรือวางหลัง router | วาง `express.json()` ก่อน router ทุกตัว |
| `ReferenceError: page is not defined` | ใช้ตัวแปรที่ไม่ได้ประกาศใน route | อ่านจาก `req.pagination` หรือ `req.query` ก่อนใช้ |
| `does not provide an export named 'AppError'` | ไฟล์ใช้ `module.exports` (CommonJS) หรือลืม export | `export {AppError, errorHandler}` |
| `Cannot find module '../repositories/x-repo'` | ESM ต้องมีนามสกุลไฟล์ | `import ... from "../repositories/x-repo.js"` |
| `Cannot use import statement outside a module` | `package.json` ไม่มี `"type": "module"` | เพิ่ม `"type": "module"` |
| `Unknown column 'id' in 'where clause'` (1054) | PK ไม่ได้ชื่อ `id` เช่น `country_id`, `officeCode` | แก้ WHERE ทั้งใน findOne, update และ remove |
| `You have an error in your SQL syntax near 'LIMIT'` | ต่อ string แล้วไม่มีช่องว่าง | `SQL + " LIMIT ? OFFSET ?"` และ `" WHERE ..."` (มีช่องว่างนำหน้า) |
| page 2 ซ้ำกับ page 1 | ส่ง `[offset, limit]` สลับกัน หรือคำนวณ offset ผิด | `[limit, offset]` และ `offset = (page - 1) * limit` |
| `pagination.total` หาย / `totalPages` เป็น `NaN` | แปะ `totalItems` บน array แล้ว `.map()` ทำให้หาย | ใน mapper ให้ copy `totalItems` กลับไป แล้วให้ `apiResponse` อ่าน `data.totalItems` |
| `total` ไม่ตรงกับจำนวนที่ filter | `COUNT(*)` ไม่ได้ใช้ WHERE เดียวกัน | ใช้ `buildWhere()` ตัวเดียวกันทั้ง `findAll` และ `count` |
| ได้ `Promise { <pending> }` หรือ `{}` | ลืม `await` ในบางชั้น | `async`/`await` ให้ครบทุกชั้น repo → service → route |
| `ER_ACCESS_DENIED_ERROR` | password ใน db-config ไม่ตรงกับเครื่อง | แก้ password (เครื่องแล็บ: `root` / `mysql@sit`) |
| `ER_BAD_DB_ERROR: Unknown database` | ยังไม่ได้รัน `init-database.sql` หรือชื่อไม่ตรง | รันสคริปต์ แล้วตั้ง `database` ให้ตรงกับ `CREATE DATABASE` |
| `connect ECONNREFUSED 127.0.0.1:3306` | MySQL ไม่ได้เปิด | `services.msc` แล้ว Start MySQL80 หรือ `net start MySQL80` (cmd แบบ admin) |
| `'mysql' is not recognized` | MySQL bin ไม่อยู่ใน PATH | ใช้ WebStorm Run SQL Script หรือเรียกด้วย path เต็ม `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql" -u root -p` |
| `listen EADDRINUSE :::3000` | มีแอปอื่นใช้ port 3000 อยู่ (โปรเจกต์เก่า) | หยุดตัวเก่า (Ctrl+C / Stop) หรือ `netstat -ano \| findstr :3000` แล้ว `taskkill /PID <pid> /F` |
| test บอก `Unexpected token '<' ... is not valid JSON` | Express ตอบเป็นหน้า HTML (route ไม่มี หรือไม่มี error handler) | ใส่ `notFoundHandler` และ `errorHandler` ที่ตอบ JSON ไว้ท้าย `app.js` |
| `Error response should have success: false` | error JSON เป็นรูปแบบอื่น | errorHandler ต้องส่ง `{success:false, error:{code,message}, timestamp}` |
| `price` เป็น `"48900.00"` | mysql2 คืน DECIMAL เป็น string | `decimalNumbers: true` ใน createPool หรือ `Number()` ใน mapper |
| `releaseDate` เลื่อน 1 วัน | DATE กลายเป็น Date object แล้วติด timezone | `dateStrings: ["DATE"]` ใน createPool |
| DELETE ได้ 204 แต่ test บอกต้องไม่มี body | ใช้ `res.status(204).json(...)` | `res.status(204).end()` |
| แก้โค้ดแล้ว test ยังได้ผลเดิม | server ยังรันโค้ดเก่า | restart server (WebStorm: Stop and Rerun) หรือใช้ `npm run dev` |
| server ตาย `exit code 1` เมื่อเกิด error | Express 4 หรือ error นอก route | ใช้ Express 5 ส่วนสคริปต์ที่ไม่ใช่ route ให้ใช้ `try/catch` |
| `/stats` ถูกจับเป็น `/:id` | ประกาศ `router.get("/:id")` ก่อน path คงที่ | ย้าย path คงที่ขึ้นไปก่อน `/:id` |
| POST ได้ 500 แทน 409 เมื่อค่าซ้ำ | errorHandler ไม่แปลง `ER_DUP_ENTRY` | map `ER_DUP_ENTRY` เป็น 409 หรือเช็กค่าซ้ำใน service ก่อน insert |
