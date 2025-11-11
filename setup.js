import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

// Load environment variables from .env then .env.local (local overrides default)
const projectRoot = process.cwd();
for (const envFile of [".env", ".env.local"]) {
  const candidate = path.join(projectRoot, envFile);
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

function resolveAbsolute(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}

const envDbDir = process.env.DATABASE_DIR || "./database";
const envDbFile = process.env.DATABASE_FILE || "database.db";
const dbDir = resolveAbsolute(envDbDir);
const dbPath = path.join(dbDir, envDbFile);

// ensure database folder exists
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// ensure images directories inside database exist
const imagesRoot = path.join(dbDir, 'images');
const imagesDirs = [
  imagesRoot,
  path.join(imagesRoot, 'avatar'),
  path.join(imagesRoot, 'product'),
  path.join(imagesRoot, 'proof'),
  path.join(imagesRoot, 'brand'),
  path.join(imagesRoot, 'payment_methods')
];
for (const dir of imagesDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

sqlite3.verbose();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open/create database:", err);
    process.exit(1);
  }
  console.log("Database ready at:", dbPath);
});

function runCreate(sql, desc) {
  db.run(sql, (err) => {
    if (err) console.error(`Failed to create ${desc}:`, err);
    else console.log(`${desc} ready.`);
  });
}

db.serialize(() => {
  // users table
  runCreate(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      no_hp TEXT,
      is_online INTEGER NOT NULL DEFAULT 0 CHECK (is_online IN (0,1)),
      last_active DATETIME
    );`,
    "users table"
  );

  // avatar table
  runCreate(
    `CREATE TABLE IF NOT EXISTS avatar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    "avatar table"
  );

  // categories table
  runCreate(
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );`,
    "categories table"
  );

  // products table
  runCreate(
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );`,
    "products table"
  );

  // product_units table
  runCreate(
    `CREATE TABLE IF NOT EXISTS product_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      unit_name TEXT NOT NULL,
      qty_per_unit REAL NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    );`,
    "product_units table"
  );

  // discount table
  runCreate(
    `CREATE TABLE IF NOT EXISTS discount (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'percentage',
      value REAL NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      type TEXT NOT NULL DEFAULT 'product',
      start_at DATETIME,
      end_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    "discount table"
  );

  // app_settings table for global configuration
  runCreate(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    "app_settings table"
  );

  // discount_products table (many-to-many relasi diskon ke produk)
  runCreate(
    `CREATE TABLE IF NOT EXISTS discount_products (
      discount_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );`,
    "discount_products table"
  );

  // discount_units table (many-to-many relasi diskon ke unit)
  runCreate(
    `CREATE TABLE IF NOT EXISTS discount_units (
      discount_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE CASCADE
    );`,
    "discount_units table"
  );

  // discount_tiers table (tiered discount thresholds)
  runCreate(
    `CREATE TABLE IF NOT EXISTS discount_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discount_id INTEGER NOT NULL,
      label TEXT,
      min_quantity INTEGER,
      max_quantity INTEGER,
      min_amount REAL,
      max_amount REAL,
      value_type TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (discount_id) REFERENCES discount(id) ON DELETE CASCADE
    );`,
    "discount_tiers table"
  );

  runCreate(
    `CREATE INDEX IF NOT EXISTS idx_discount_tiers_discount_id_priority
     ON discount_tiers (discount_id, priority);`,
    "discount_tiers index"
  );

  // cart table (shopping cart for users)
  runCreate(
    `CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE CASCADE
    );`,
    "cart table"
  );
  // payment_methods table
  runCreate(
    `CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment TEXT NOT NULL,
      no_payment TEXT,
      image_path TEXT
    );`,
    "payment_methods table"
  );

  // orders table (completed orders)
  runCreate(
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_number TEXT NOT NULL UNIQUE,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'menunggu',
      payment_id INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'belum_bayar',
      proof_payment_path TEXT,
      shipping_type TEXT NOT NULL DEFAULT 'delivery',
      shipping_address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (payment_id) REFERENCES payment_methods(id) ON DELETE CASCADE
    );`,
    "orders table"
  );

  // order_items table (items in each order)
  runCreate(
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES product_units(id) ON DELETE SET NULL
    );`,
    "order_items table"
  );

  // chat table for internal messaging
  runCreate(
    `CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    "chat table"
  );

  // helpful index to speed up chat queries
  runCreate(
    `CREATE INDEX IF NOT EXISTS idx_chat_users_created_at 
     ON chat (from_user_id, to_user_id, created_at);`,
    "chat indexes"
  );

  // brand table
  runCreate(
    `CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo TEXT
    );`,
    "brands table"
  );

  // seed brand (INSERT OR IGNORE)
  db.run(
    `INSERT OR IGNORE INTO brands (name, logo) VALUES
      (?, ?);`,
    [
      "Brand A", ""
    ],
    (err) => {
      if (err) console.error("Failed inserting seed brands:", err);
      else console.log("Seed brands applied (or already present).");
    }
  );

  // seed users (INSERT OR IGNORE by username unique)
  db.run(
    `INSERT OR IGNORE INTO users (name, username, password, role, no_hp) VALUES
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?);`,
    [
      "Super Admin", "superadmin", "superadmin123", "superadmin", "081234567890",
      "Administrator", "admin", "admin123", "admin", "081234567890",
      "Demo User", "user", "user123", "user", "081234567891"
    ],
    (err) => {
      if (err) console.error("Failed inserting seed users:", err);
      else console.log("Seed users applied (or already present).");
    }
  );

  // seed payment_method
  db.run(
    `INSERT OR IGNORE INTO payment_methods (payment, no_payment) VALUES
      (?, ?);
    `,
    [
      ["Cash", ""]
    ],
    (err) => {
      if (err) console.error("Failed inserting seed payment_methods:", err);
      else console.log("Seed payment_methods applied (or already present).");
    }
  );

  // seed default theme setting
  db.run(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?);`,
    [
      "theme_settings",
      JSON.stringify({ primaryColor: "#73d13d" })
    ],
    (err) => {
      if (err) console.error("Failed inserting default theme setting:", err);
      else console.log("Default theme setting applied (or already present).");
    }
  );
});

// close connection when done
db.close((err) => {
  if (err) console.error("Failed to close database:", err);
  else console.log("Database connection closed.");
});