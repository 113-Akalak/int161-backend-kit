-- =====================================================================
-- INT161 Mock Exam #3: classicmodels (ฉบับย่อสำหรับฝึก)
-- ตารางและชื่อคอลัมน์ตรงกับ MySQL Sample Database (mysqltutorial.org) แต่ข้อมูลตัดให้สั้น
-- ถ้าในเครื่องมี classicmodels ตัวเต็มอยู่แล้ว ใช้ตัวเต็มได้เลย (โค้ดเฉลยใช้ได้ทั้งคู่)
-- =====================================================================
CREATE DATABASE IF NOT EXISTS classicmodels_mini
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE classicmodels_mini;

DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS offices;
DROP TABLE IF EXISTS productlines;

CREATE TABLE productlines (
    productLine     VARCHAR(50) NOT NULL PRIMARY KEY,   -- String PK (ไม่ auto increment)
    textDescription VARCHAR(4000),
    htmlDescription MEDIUMTEXT,
    image           MEDIUMBLOB
);

CREATE TABLE offices (
    officeCode   VARCHAR(10) NOT NULL PRIMARY KEY,       -- String PK เช่น '1', 'NA'
    city         VARCHAR(50) NOT NULL,
    phone        VARCHAR(50) NOT NULL,
    addressLine1 VARCHAR(50) NOT NULL,
    addressLine2 VARCHAR(50),
    state        VARCHAR(50),
    country      VARCHAR(50) NOT NULL,
    postalCode   VARCHAR(15) NOT NULL,
    territory    VARCHAR(10) NOT NULL
);

CREATE TABLE employees (
    employeeNumber INT NOT NULL PRIMARY KEY,
    lastName       VARCHAR(50) NOT NULL,
    firstName      VARCHAR(50) NOT NULL,
    extension      VARCHAR(10) NOT NULL,
    email          VARCHAR(100) NOT NULL,
    officeCode     VARCHAR(10) NOT NULL,
    reportsTo      INT,
    jobTitle       VARCHAR(50) NOT NULL,
    CONSTRAINT employees_ibfk_1 FOREIGN KEY (reportsTo) REFERENCES employees (employeeNumber),
    CONSTRAINT employees_ibfk_2 FOREIGN KEY (officeCode) REFERENCES offices (officeCode)
);

CREATE TABLE customers (
    customerNumber         INT NOT NULL PRIMARY KEY,
    customerName           VARCHAR(50) NOT NULL,
    contactLastName        VARCHAR(50) NOT NULL,
    contactFirstName       VARCHAR(50) NOT NULL,
    phone                  VARCHAR(50) NOT NULL,
    addressLine1           VARCHAR(50) NOT NULL,
    addressLine2           VARCHAR(50),
    city                   VARCHAR(50) NOT NULL,
    state                  VARCHAR(50),
    postalCode             VARCHAR(15),
    country                VARCHAR(50) NOT NULL,
    salesRepEmployeeNumber INT,
    creditLimit            DECIMAL(10,2),
    CONSTRAINT customers_ibfk_1 FOREIGN KEY (salesRepEmployeeNumber) REFERENCES employees (employeeNumber)
);

CREATE TABLE orders (
    orderNumber    INT NOT NULL PRIMARY KEY,
    orderDate      DATE NOT NULL,
    requiredDate   DATE NOT NULL,
    shippedDate    DATE,
    status         VARCHAR(15) NOT NULL,
    comments       TEXT,
    customerNumber INT NOT NULL,
    CONSTRAINT orders_ibfk_1 FOREIGN KEY (customerNumber) REFERENCES customers (customerNumber)
);

CREATE TABLE payments (
    customerNumber INT NOT NULL,
    checkNumber    VARCHAR(50) NOT NULL,
    paymentDate    DATE NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (customerNumber, checkNumber),              -- Composite PK
    CONSTRAINT payments_ibfk_1 FOREIGN KEY (customerNumber) REFERENCES customers (customerNumber)
);

INSERT INTO productlines (productLine, textDescription) VALUES
('Classic Cars', 'Attention car enthusiasts: Make your wildest car ownership dreams come true.'),
('Motorcycles',  'Our motorcycles are state of the art replicas of classic as well as contemporary motorcycle legends.'),
('Planes',       'Unique, diecast airplane and helicopter replicas suitable for collections.'),
('Ships',        'The perfect holiday or anniversary gift for executives, clients, friends, and family.'),
('Trains',       'Model trains are a rewarding hobby for enthusiasts of all ages.');

INSERT INTO offices (officeCode, city, phone, addressLine1, addressLine2, state, country, postalCode, territory) VALUES
('1', 'San Francisco', '+1 650 219 4782', '100 Market Street', 'Suite 300', 'CA', 'USA', '94080', 'NA'),
('2', 'Boston',        '+1 215 837 0825', '1550 Court Place',  'Suite 102', 'MA', 'USA', '02107', 'NA'),
('3', 'NYC',           '+1 212 555 3000', '523 East 53rd Street', 'apt. 5A', 'NY', 'USA', '10022', 'NA'),
('4', 'Paris',         '+33 14 723 4404', '43 Rue Jouffroy D''abbans', NULL, NULL, 'France', '75017', 'EMEA'),
('7', 'London',        '+44 20 7877 2041', '25 Old Broad Street', 'Level 7', NULL, 'UK', 'EC2N 1HN', 'EMEA');

INSERT INTO employees (employeeNumber, lastName, firstName, extension, email, officeCode, reportsTo, jobTitle) VALUES
(1002, 'Murphy',    'Diane',   'x5800', 'dmurphy@classicmodelcars.com',    '1', NULL, 'President'),
(1056, 'Patterson', 'Mary',    'x4611', 'mpatterso@classicmodelcars.com',  '1', 1002, 'VP Sales'),
(1143, 'Bow',       'Anthony', 'x5428', 'abow@classicmodelcars.com',       '1', 1056, 'Sales Manager (NA)'),
(1165, 'Jennings',  'Leslie',  'x3291', 'ljennings@classicmodelcars.com',  '1', 1143, 'Sales Rep'),
(1188, 'Firrelli',  'Julie',   'x2173', 'jfirrelli@classicmodelcars.com',  '2', 1143, 'Sales Rep'),
(1370, 'Hernandez', 'Gerard',  'x2028', 'ghernande@classicmodelcars.com',  '4', 1056, 'Sales Rep'),
(1501, 'Bott',      'Larry',   'x2311', 'lbott@classicmodelcars.com',      '7', 1056, 'Sales Rep');

INSERT INTO customers (customerNumber, customerName, contactLastName, contactFirstName, phone, addressLine1, city, country, salesRepEmployeeNumber, creditLimit) VALUES
(103, 'Atelier graphique',           'Schmitt', 'Carine',  '40.32.2555',   '54, rue Royale',          'Nantes',        'France', 1370, 21000.00),
(112, 'Signal Gift Stores',          'King',    'Jean',    '7025551838',   '8489 Strong St.',         'Las Vegas',     'USA',    1165, 71800.00),
(114, 'Australian Collectors, Co.',  'Ferguson','Peter',   '03 9520 4555', '636 St Kilda Road',       'Melbourne',     'Australia', 1501, 117300.00),
(119, 'La Rochelle Gifts',           'Labrune', 'Janine',  '40.67.8555',   '67, rue des Cinquante Otages', 'Nantes',  'France', 1370, 118200.00),
(125, 'Havel & Zbyszek Co',          'Piestrzeniewicz', 'Zbyszek', '(26) 642-7555', 'ul. Filtrowa 68', 'Warszawa', 'Poland', NULL, 0.00),
(169, 'Porto Imports Co.',           'de Castro', 'Isabel', '(1) 356-5555', 'Estrada da saude n. 58', 'Lisboa',       'Portugal', NULL, 0.00);

INSERT INTO orders (orderNumber, orderDate, requiredDate, shippedDate, status, customerNumber) VALUES
(10100, '2003-01-06', '2003-01-13', '2003-01-10', 'Shipped', 112),
(10101, '2003-01-09', '2003-01-18', '2003-01-11', 'Shipped', 103),
(10102, '2003-01-10', '2003-01-18', '2003-01-14', 'Shipped', 114),
(10103, '2003-01-29', '2003-02-07', '2003-02-02', 'Shipped', 119);

INSERT INTO payments (customerNumber, checkNumber, paymentDate, amount) VALUES
(103, 'HQ336336', '2004-10-19', 6066.78),
(103, 'JM555205', '2003-06-05', 14571.44),
(112, 'BO864823', '2004-12-17', 14191.12),
(114, 'GG31455',  '2003-05-20', 45864.03),
(125, 'AB000001', '2004-01-01', 100.00);
