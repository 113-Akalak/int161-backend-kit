# example — เฉลยข้อสอบซ้อม 9 ต.ค. (Mobile Phone Distributor)

สร้างด้วย `node kit/gen.mjs example` จาก `database/init-database.sql` และ `exam-spec.md` (ข้อมูลนักศึกษาเป็นค่าสมมติ)

```bash
cd example
npm install                                   # หรือ node ../kit/offline-install.mjs .
mysql -u root -p < database/init-database.sql
npm start
node ../kit/selftest.mjs . --config ../work/example.config.json   # หลังรัน gen ครั้งแรก
node ../fixtures/mobile/test-runner.mjs 67130599999               # test เลียนแบบของอาจารย์
```

ไฟล์ที่ควรอ่านก่อน: `src/app.js` → `src/routes/product-route.js` → `src/services/product-service.js` → `src/repositories/product-repo.js` → `src/mappers/product-mapper.js`
