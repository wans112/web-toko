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

sqlite3.verbose();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open/create database:", err);
    process.exit(1);
  }
  console.log("Database ready at:", dbPath);
});

// SQL statements
const dropDiscount = `DROP TABLE IF EXISTS discount;`;

const createDiscount = `CREATE TABLE IF NOT EXISTS discount (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'percentage',
      value REAL NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      type TEXT NOT NULL DEFAULT 'product',
      start_at DATETIME,
      end_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

const createAppSettings = `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;

db.serialize(() => {
  db.run(dropDiscount, (err) => {
    if (err) console.error("Failed to drop discount table:", err);
    else console.log("Dropped discount table (if existed).");
  });

  db.run(createDiscount, (err) => {
    if (err) console.error("Failed to create discount table:", err);
    else console.log("Discount table created.");
  });

  db.run(createAppSettings, (err) => {
    if (err) console.error("Failed to create app_settings table:", err);
    else console.log("app_settings table ready.");
  });

  // Seed default theme_settings into app_settings. Using INSERT OR REPLACE so it overwrites if present.
  const themeSettingsValue = JSON.stringify({ primaryColor: "#73d13d" });
  db.run(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP);`,
    ["theme_settings", themeSettingsValue],
    (err) => {
      if (err) console.error("Failed to seed app_settings:", err);
      else console.log("Seeded app_settings: theme_settings.");
    }
  );
});

// close connection when done
db.close((err) => {
  if (err) console.error("Failed to close database:", err);
  else console.log("Database connection closed.");
});
