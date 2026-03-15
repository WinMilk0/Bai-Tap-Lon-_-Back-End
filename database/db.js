const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Lỗi khi kết nối CSDL SQLite:', err.message);
    } else {
        console.log('Đã kết nối thành công với SQLite (data.db).');
        db.run('PRAGMA foreign_keys = ON'); // Enable foreign key constraints
    }
});

// Setup tables
const setupSchema = () => {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'staff',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Farmers table
        db.run(`CREATE TABLE IF NOT EXISTS farmers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            village TEXT,
            commune TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Advances table (Ghi nợ vật tư)
        db.run(`CREATE TABLE IF NOT EXISTS advances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            total_debt REAL NOT NULL,
            interest_rate REAL DEFAULT 0,
            debt_date DATE NOT NULL,
            status TEXT DEFAULT 'Unpaid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
        )`);

        // Harvest settlements table (Quyết toán)
        db.run(`CREATE TABLE IF NOT EXISTS harvest_settlements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_id INTEGER NOT NULL,
            product_type TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_purchase_price REAL NOT NULL,
            total_purchase_amount REAL NOT NULL,
            total_debt_deducted REAL NOT NULL,
            final_payout REAL NOT NULL,
            settlement_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
        )`);

        // Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);
    });
};

setupSchema();

module.exports = db;
