import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

sqlite3.verbose();

const projectRoot = process.cwd();

function resolveAbsolute(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}

const envDbDir = process.env.DATABASE_DIR || "./database";
const envDbFile = process.env.DATABASE_FILE || "database.db";
const DEFAULT_DB_PATH = path.join(resolveAbsolute(envDbDir), envDbFile);
let db = null;

/**
 * Inisialisasi koneksi SQLite.
 * - Membuat folder jika belum ada
 * - Membuka file DB
 * - Menjalankan PRAGMA optimasi (WAL, foreign_keys, busy_timeout, dll)
 * @param {string} [dbPath]
 * @returns {Promise<sqlite3.Database>}
 */
export function init(dbPath = DEFAULT_DB_PATH) {
  const targetDbPath = resolveAbsolute(dbPath ?? DEFAULT_DB_PATH);
  if (db) return Promise.resolve(db);

  const dir = path.dirname(targetDbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(targetDbPath, (err) => {
      if (err) {
        db = null;
        return reject(err);
      }

      // PRAGMA yang direkomendasikan untuk performa dan konsistensi
      const pragmas = [
        "PRAGMA foreign_keys = ON",         // aktifkan foreign key
        "PRAGMA journal_mode = WAL",        // WAL memperbaiki concurrency
        "PRAGMA wal_autocheckpoint = 1000", // checkpoint period
        "PRAGMA synchronous = NORMAL",      // performa yg baik untuk WAL
        "PRAGMA temp_store = MEMORY",       // simpan temp di memory
        "PRAGMA cache_size = -2000",        // cache ~2MB (negatif = KB)
        "PRAGMA busy_timeout = 5000"        // tunggu 5s saat DB busy
      ].join("; ");

      db.exec(pragmas, (pErr) => {
        if (pErr) {
          // jangan gagal total jika PRAGMA bermasalah, hanya log
          console.warn("PRAGMA setup warning:", pErr);
        }
        resolve(db);
      });
    });
  });
}

/**
 * Jalankan pernyataan (INSERT/UPDATE/DELETE)
 */
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Ambil satu baris
 */
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Ambil semua baris
 */
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Eksekusi beberapa statement (no result)
 */
export function exec(sql) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Optimasi database:
 * - PRAGMA optimize (jika tersedia)
 * - ANALYZE untuk update statistik query planner
 * - VACUUM untuk defragmentasi (opsional, bisa mahal => gunakan secara terjadwal)
 */
export function optimize({ vacuum = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized. Call init() first."));
    const steps = ["PRAGMA optimize", "ANALYZE"];
    if (vacuum) steps.push("VACUUM");
    const sql = steps.join("; ");
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Tutup koneksi DB
 */
export function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => {
      if (err) return reject(err);
      db = null;
      resolve();
    });
  });
}