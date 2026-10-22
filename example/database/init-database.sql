-- =====================================================================
-- INT161 Practice: Mobile Phone Distributor Ltd.
-- Entity: brands (1) ---< products (N)   (One-to-Many)
-- โครงตารางตามไฟล์จริงในคาบซ้อมสอบ 9 ต.ค. 2026 / ข้อมูลตัวอย่างย่อเหลือ 8 แบรนด์ 25 สินค้า (ของจริง 22 / 75)
-- รัน: mysql -u root -p < database/init-database.sql
--   หรือ WebStorm: คลิกขวา Data Source > SQL Scripts > Run SQL Script...
-- =====================================================================

-- 1. Create database if not exists
CREATE DATABASE IF NOT EXISTS mobile_distributor
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE mobile_distributor;

-- 2. Drop tables in correct order (child table first)
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS brands;

-- 3. Create 'brands' table
CREATE TABLE brands (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    country_of_origin VARCHAR(100) NOT NULL,
    website           VARCHAR(255),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create 'products' table
CREATE TABLE products (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    sku            VARCHAR(50)  NOT NULL UNIQUE,
    name           VARCHAR(150) NOT NULL,
    brand_id       BIGINT NOT NULL,
    category       VARCHAR(50)  NOT NULL,                     -- FLAGSHIP, MID_RANGE, BUDGET, FOLDABLE, STANDARD
    price          DECIMAL(10,2) NOT NULL,
    ram_gb         INT NOT NULL,
    storage_gb     INT NOT NULL,
    color          VARCHAR(50) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    status         VARCHAR(30)  NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, OUT_OF_STOCK, DISCONTINUED
    release_date   DATE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes (เหมือนไฟล์จริง)
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_status ON products(status);

-- 5. Seed brands
INSERT INTO brands (id, name, country_of_origin, website, is_active, created_at) VALUES
(1, 'Apple',   'United States', 'https://www.apple.com',   TRUE,  '2024-01-01 00:00:00'),
(2, 'Samsung', 'South Korea',   'https://www.samsung.com', TRUE,  '2024-01-01 00:00:00'),
(3, 'Xiaomi',  'China',         'https://www.mi.com',      TRUE,  '2024-01-02 00:00:00'),
(4, 'OPPO',    'China',         'https://www.oppo.com',    TRUE,  '2024-01-02 00:00:00'),
(5, 'vivo',    'China',         'https://www.vivo.com',    TRUE,  '2024-01-03 00:00:00'),
(6, 'Google',  'United States', 'https://store.google.com',TRUE,  '2024-01-03 00:00:00'),
(7, 'Nokia',   'Finland',       'https://www.nokia.com',   FALSE, '2024-01-04 00:00:00'),
(8, 'Realme',  'China',         'https://www.realme.com',  TRUE,  '2024-01-04 00:00:00');

-- 6. Seed products
INSERT INTO products (id, sku, name, brand_id, category, price, ram_gb, storage_gb, color, stock_quantity, status, release_date) VALUES
(1,  'APL-IP15PM-256-NT', 'iPhone 15 Pro Max',  1, 'FLAGSHIP',  48900.00, 8,  256, 'Natural Titanium', 15, 'AVAILABLE',    '2023-09-22'),
(2,  'APL-IP15P-128-BLU', 'iPhone 15 Pro',      1, 'FLAGSHIP',  41900.00, 8,  128, 'Blue Titanium',    12, 'AVAILABLE',    '2023-09-22'),
(3,  'APL-IP15-128-PNK',  'iPhone 15',          1, 'STANDARD',  32900.00, 6,  128, 'Pink',             22, 'AVAILABLE',    '2023-09-22'),
(4,  'APL-IP15PL-256-BLK','iPhone 15 Plus',     1, 'STANDARD',  37900.00, 6,  256, 'Black',            8,  'AVAILABLE',    '2023-09-22'),
(5,  'APL-IP13-128-MID',  'iPhone 13',          1, 'BUDGET',    19900.00, 4,  128, 'Midnight',         0,  'DISCONTINUED', '2021-09-24'),
(6,  'SAM-S24U-512-TI',   'Galaxy S24 Ultra',   2, 'FLAGSHIP',  52900.00, 12, 512, 'Titanium Gray',    10, 'AVAILABLE',    '2024-01-31'),
(7,  'SAM-S24P-256-VIO',  'Galaxy S24+',        2, 'FLAGSHIP',  38900.00, 12, 256, 'Cobalt Violet',    9,  'AVAILABLE',    '2024-01-31'),
(8,  'SAM-S24-256-BLK',   'Galaxy S24',         2, 'FLAGSHIP',  33900.00, 8,  256, 'Onyx Black',       14, 'AVAILABLE',    '2024-01-31'),
(9,  'SAM-ZFL5-256-MNT',  'Galaxy Z Flip 5',    2, 'FOLDABLE',  39900.00, 8,  256, 'Mint',             6,  'AVAILABLE',    '2023-08-11'),
(10, 'SAM-ZFD5-512-ICY',  'Galaxy Z Fold 5',    2, 'FOLDABLE',  65900.00, 12, 512, 'Icy Blue',         3,  'AVAILABLE',    '2023-08-11'),
(11, 'SAM-A55-128-LIL',   'Galaxy A55 5G',      2, 'MID_RANGE', 13999.00, 8,  128, 'Awesome Lilac',    30, 'AVAILABLE',    '2024-03-15'),
(12, 'SAM-A35-128-NAV',   'Galaxy A35 5G',      2, 'MID_RANGE', 10999.00, 8,  128, 'Awesome Navy',     0,  'OUT_OF_STOCK', '2024-03-15'),
(13, 'XMI-14U-512-BLK',   'Xiaomi 14 Ultra',    3, 'FLAGSHIP',  39990.00, 16, 512, 'Black',            5,  'AVAILABLE',    '2024-02-25'),
(14, 'XMI-RN13P-256-PUR', 'Redmi Note 13 Pro',  3, 'MID_RANGE', 10990.00, 8,  256, 'Aurora Purple',    40, 'AVAILABLE',    '2024-01-15'),
(15, 'XMI-RD13C-128-GRN', 'Redmi 13C',          3, 'BUDGET',     3490.00, 4,  128, 'Clover Green',     50, 'AVAILABLE',    '2023-11-06'),
(16, 'OPP-FX7U-512-BRN',  'OPPO Find X7 Ultra', 4, 'FLAGSHIP',  44990.00, 16, 512, 'Sepia Brown',      0,  'OUT_OF_STOCK', '2024-01-08'),
(17, 'OPP-RN11-256-GRN',  'OPPO Reno11 5G',     4, 'MID_RANGE', 15990.00, 12, 256, 'Wave Green',       18, 'AVAILABLE',    '2024-01-11'),
(18, 'OPP-A79-128-BLK',   'OPPO A79 5G',        4, 'BUDGET',     7999.00, 8,  128, 'Mystery Black',    25, 'AVAILABLE',    '2023-10-23'),
(19, 'VIV-X100P-512-BLU', 'vivo X100 Pro',      5, 'FLAGSHIP',  39999.00, 16, 512, 'Asteroid Black',   7,  'AVAILABLE',    '2023-11-13'),
(20, 'VIV-V30-256-WHT',   'vivo V30 5G',        5, 'MID_RANGE', 14999.00, 12, 256, 'Peacock Green',    16, 'AVAILABLE',    '2024-02-28'),
(21, 'GGL-P8P-256-OBS',   'Pixel 8 Pro',        6, 'FLAGSHIP',  36990.00, 12, 256, 'Obsidian',         4,  'AVAILABLE',    '2023-10-12'),
(22, 'GGL-P8A-128-ALO',   'Pixel 8a',           6, 'MID_RANGE', 17990.00, 8,  128, 'Aloe',             11, 'AVAILABLE',    '2024-05-14'),
(23, 'NOK-G42-128-GRY',   'Nokia G42 5G',       7, 'BUDGET',     5990.00, 6,  128, 'So Grey',          0,  'DISCONTINUED', '2023-06-28'),
(24, 'RLM-12P-256-BLU',   'realme 12 Pro+',     8, 'MID_RANGE', 14999.00, 12, 256, 'Submarine Blue',   20, 'AVAILABLE',    '2024-01-29'),
(25, 'RLM-C67-128-GRN',   'realme C67',         8, 'BUDGET',     5499.00, 8,  128, 'Sunny Oasis',      35, 'AVAILABLE',    '2023-12-14');
