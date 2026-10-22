// การเชื่อมต่อ MySQL (Week 4) — แก้ user/password/database ให้ตรงกับเครื่องที่สอบ
import mysql from "mysql2/promise"

const pool = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "mysql@sit",          // <-- รหัส root ของเครื่องตัวเอง
    database: "mobile_distributor",     // <-- ชื่อ database ตามสเปค
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,   // DECIMAL (เช่น price) คืนเป็น number ไม่ใช่ string "48900.00"
    dateStrings: ["DATE"]   // คอลัมน์ DATE คืนเป็น "2023-09-22" ไม่เลื่อนวันเพราะ timezone
})

export default pool
