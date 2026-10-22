-- =====================================================================
-- INT161 Mock Exam #2 (ฝึกเอง): SIT Library Book Service
-- Entity: authors (1) ---< books (N)
-- รัน: mysql -u root -p < database/init-database.sql
-- =====================================================================
CREATE DATABASE IF NOT EXISTS sit_library
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE sit_library;

DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS authors;

CREATE TABLE authors (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    nationality VARCHAR(80)  NOT NULL,
    birth_year  INT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE books (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    isbn           VARCHAR(20)  NOT NULL UNIQUE,
    title          VARCHAR(200) NOT NULL,
    author_id      BIGINT NOT NULL,
    genre          VARCHAR(30)  NOT NULL,          -- FANTASY, SCI_FI, MYSTERY, PROGRAMMING, NOVEL
    price          DECIMAL(8,2) NOT NULL,
    pages          INT,
    language       VARCHAR(30)  DEFAULT 'English',
    stock_quantity INT NOT NULL DEFAULT 0,
    status         VARCHAR(20)  NOT NULL DEFAULT 'IN_STOCK', -- IN_STOCK, OUT_OF_STOCK, ARCHIVED
    published_date DATE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_books_author FOREIGN KEY (author_id) REFERENCES authors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO authors (id, name, nationality, birth_year, is_active, created_at) VALUES
(1, 'J.K. Rowling',      'British',  1965, TRUE,  '2024-02-01 00:00:00'),
(2, 'Haruki Murakami',   'Japanese', 1949, TRUE,  '2024-02-01 00:00:00'),
(3, 'Agatha Christie',   'British',  1890, FALSE, '2024-02-02 00:00:00'),
(4, 'Isaac Asimov',      'American', 1920, FALSE, '2024-02-02 00:00:00'),
(5, 'Robert C. Martin',  'American', 1952, TRUE,  '2024-02-03 00:00:00'),
(6, 'Kyle Simpson',      'American', 1980, TRUE,  '2024-02-03 00:00:00');

INSERT INTO books (id, isbn, title, author_id, genre, price, pages, language, stock_quantity, status, published_date) VALUES
(1,  '978-0747532699', 'Harry Potter and the Philosopher''s Stone', 1, 'FANTASY',     395.00, 223, 'English',  12, 'IN_STOCK',     '1997-06-26'),
(2,  '978-0747538493', 'Harry Potter and the Chamber of Secrets',   1, 'FANTASY',     395.00, 251, 'English',  8,  'IN_STOCK',     '1998-07-02'),
(3,  '978-0747542155', 'Harry Potter and the Prisoner of Azkaban',  1, 'FANTASY',     425.00, 317, 'English',  0,  'OUT_OF_STOCK', '1999-07-08'),
(4,  '978-0747546245', 'Harry Potter and the Goblet of Fire',       1, 'FANTASY',     495.00, 636, 'English',  5,  'IN_STOCK',     '2000-07-08'),
(5,  '978-0099448822', 'Norwegian Wood',                            2, 'NOVEL',       350.00, 389, 'English',  9,  'IN_STOCK',     '1987-09-04'),
(6,  '978-0099458326', 'Kafka on the Shore',                        2, 'NOVEL',       420.00, 505, 'English',  4,  'IN_STOCK',     '2002-09-12'),
(7,  '978-0307593313', '1Q84',                                      2, 'NOVEL',       690.00, 925, 'English',  2,  'IN_STOCK',     '2009-05-29'),
(8,  '978-0062073488', 'And Then There Were None',                  3, 'MYSTERY',     290.00, 272, 'English',  15, 'IN_STOCK',     '1939-11-06'),
(9,  '978-0062693662', 'Murder on the Orient Express',              3, 'MYSTERY',     310.00, 256, 'English',  0,  'ARCHIVED',     '1934-01-01'),
(10, '978-0553293357', 'Foundation',                                4, 'SCI_FI',      330.00, 255, 'English',  7,  'IN_STOCK',     '1951-06-01'),
(11, '978-0553382563', 'I, Robot',                                  4, 'SCI_FI',      300.00, 224, 'English',  6,  'IN_STOCK',     '1950-12-02'),
(12, '978-0132350884', 'Clean Code',                                5, 'PROGRAMMING', 1450.00, 464, 'English', 10, 'IN_STOCK',     '2008-08-01'),
(13, '978-0134494166', 'Clean Architecture',                        5, 'PROGRAMMING', 1390.00, 432, 'English', 3,  'IN_STOCK',     '2017-09-10'),
(14, '978-1491924464', 'You Don''t Know JS: Up & Going',            6, 'PROGRAMMING', 590.00,  88,  'English', 0,  'OUT_OF_STOCK', '2015-03-27'),
(15, '978-1098124045', 'You Don''t Know JS Yet: Get Started',       6, 'PROGRAMMING', 690.00,  143, 'English', 11, 'IN_STOCK',     '2020-01-28'),
(16, '978-6160000001', 'Harry Potter (Thai Edition)',               1, 'FANTASY',     345.00,  304, 'Thai',    20, 'IN_STOCK',     '2000-01-01'),
(17, '978-6160000002', 'Norwegian Wood (Thai Edition)',             2, 'NOVEL',       320.00,  420, 'Thai',    6,  'IN_STOCK',     '2003-01-01'),
(18, '978-0553803709', 'I, Robot (Illustrated)',                    4, 'SCI_FI',      890.00,  300, 'English', 1,  'IN_STOCK',     '2004-06-01');
