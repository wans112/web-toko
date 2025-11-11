import { NextResponse } from "next/server";
import { init, all, get, run } from "@/lib/db";

// Helper functions for consistent responses
function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function successResponse(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

// Helper function to validate discount data
function validateDiscountData(body, isUpdate = false, existingDiscount = null) {
  const {
    name,
    type,
    value_type,
    value,
    product_ids,
    unit_ids,
    start_at,
    end_at,
    tiers
  } = body || {};

  const rawValueType = value_type || existingDiscount?.value_type || null;
  const effectiveValueType = typeof rawValueType === 'string' ? rawValueType.toLowerCase() : rawValueType;

  if (!isUpdate && !name?.trim()) {
    return "Nama diskon wajib diisi";
  }

  if (!isUpdate && !type) {
    return "Tipe diskon wajib diisi";
  }

  if (!effectiveValueType) {
    return "Tipe nilai diskon wajib diisi";
  }

  const allowedValueTypes = ['percentage', 'nominal', 'tiered'];
  if (effectiveValueType && !allowedValueTypes.includes(effectiveValueType)) {
    return "Tipe nilai diskon tidak didukung";
  }

  if (
    type === 'product' &&
    (!isUpdate || product_ids !== undefined) &&
    (!Array.isArray(product_ids) || product_ids.length === 0)
  ) {
    return "Minimal satu produk harus dipilih untuk diskon produk";
  }

  if (
    type === 'unit' &&
    (!isUpdate || unit_ids !== undefined) &&
    (!Array.isArray(unit_ids) || unit_ids.length === 0)
  ) {
    return "Minimal satu unit harus dipilih untuk diskon unit";
  }

  if (effectiveValueType === 'percentage') {
    const numericValue = value !== undefined ? Number(value) : Number(existingDiscount?.value ?? 0);
    if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
      return "Persentase diskon harus antara 0-100";
    }
  }

  if (effectiveValueType === 'nominal') {
    const numericValue = value !== undefined ? Number(value) : Number(existingDiscount?.value ?? 0);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      return "Nominal diskon tidak boleh negatif";
    }
  }

  if (effectiveValueType === 'tiered') {
    let tiersToValidate = null;
    if (tiers !== undefined) {
      tiersToValidate = tiers;
    } else if (!isUpdate) {
      tiersToValidate = [];
    }

    if (tiersToValidate !== null) {
      if (!Array.isArray(tiersToValidate) || tiersToValidate.length === 0) {
        return "Minimal satu tingkat diskon harus ditentukan";
      }

      for (let i = 0; i < tiersToValidate.length; i += 1) {
        const tier = tiersToValidate[i] || {};
        const tierValueTypeRaw = tier.value_type;
        const tierValueType = typeof tierValueTypeRaw === 'string' ? tierValueTypeRaw.toLowerCase() : tierValueTypeRaw;
        const tierValue = tier.value;
        const minQty = tier.min_quantity;
        const maxQty = tier.max_quantity;
        const minAmount = tier.min_amount;
        const maxAmount = tier.max_amount;

        if (!['percentage', 'nominal'].includes(tierValueType)) {
          return `Tipe nilai diskon pada tingkat ke-${i + 1} tidak valid`;
        }

        const numericTierValue = Number(tierValue);
        if (Number.isNaN(numericTierValue) || numericTierValue <= 0) {
          return `Nilai diskon pada tingkat ke-${i + 1} harus lebih besar dari 0`;
        }

        if (tierValueType === 'percentage' && (numericTierValue < 0 || numericTierValue > 100)) {
          return `Persentase diskon pada tingkat ke-${i + 1} harus 0-100`;
        }

        const normalizedMinQty = minQty === null || minQty === undefined || minQty === '' ? null : Number(minQty);
        const normalizedMaxQty = maxQty === null || maxQty === undefined || maxQty === '' ? null : Number(maxQty);
        const normalizedMinAmount = minAmount === null || minAmount === undefined || minAmount === '' ? null : Number(minAmount);
        const normalizedMaxAmount = maxAmount === null || maxAmount === undefined || maxAmount === '' ? null : Number(maxAmount);

        const hasQuantityRule = normalizedMinQty !== null || normalizedMaxQty !== null;
        const hasAmountRule = normalizedMinAmount !== null || normalizedMaxAmount !== null;

        if (!hasQuantityRule && !hasAmountRule) {
          return `Tingkat diskon ke-${i + 1} harus memiliki minimal satu syarat jumlah unit atau nominal belanja`;
        }

        if (
          normalizedMinQty !== null &&
          (Number.isNaN(normalizedMinQty) || normalizedMinQty < 0 || !Number.isInteger(normalizedMinQty))
        ) {
          return `Jumlah unit minimum pada tingkat ke-${i + 1} tidak valid`;
        }
        if (
          normalizedMaxQty !== null &&
          (Number.isNaN(normalizedMaxQty) || normalizedMaxQty < 0 || !Number.isInteger(normalizedMaxQty))
        ) {
          return `Jumlah unit maksimum pada tingkat ke-${i + 1} tidak valid`;
        }
        if (
          normalizedMinQty !== null &&
          normalizedMaxQty !== null &&
          normalizedMinQty > normalizedMaxQty
        ) {
          return `Jumlah unit minimum harus lebih kecil atau sama dengan maksimum pada tingkat ke-${i + 1}`;
        }

        if (normalizedMinAmount !== null && (Number.isNaN(normalizedMinAmount) || normalizedMinAmount < 0)) {
          return `Nominal belanja minimum pada tingkat ke-${i + 1} tidak valid`;
        }
        if (normalizedMaxAmount !== null && (Number.isNaN(normalizedMaxAmount) || normalizedMaxAmount < 0)) {
          return `Nominal belanja maksimum pada tingkat ke-${i + 1} tidak valid`;
        }
        if (
          normalizedMinAmount !== null &&
          normalizedMaxAmount !== null &&
          normalizedMinAmount > normalizedMaxAmount
        ) {
          return `Nominal belanja minimum harus lebih kecil atau sama dengan maksimum pada tingkat ke-${i + 1}`;
        }
      }
    }
  }

  const normalizedStart = normalizeDateValue(start_at);
  if (start_at && !normalizedStart) {
    return "Tanggal mulai diskon tidak valid";
  }

  const normalizedEnd = normalizeDateValue(end_at);
  if (end_at && !normalizedEnd) {
    return "Tanggal berakhir diskon tidak valid";
  }

  if (normalizedStart && normalizedEnd) {
    if (Date.parse(normalizedStart) > Date.parse(normalizedEnd)) {
      return "Tanggal mulai harus sebelum atau sama dengan tanggal berakhir";
    }
  }

  return null;
}

let discountScheduleColumnsEnsured = false;
let ensureColumnsPromise = null;

async function ensureDiscountScheduleColumns() {
  if (discountScheduleColumnsEnsured) return;
  if (!ensureColumnsPromise) {
    ensureColumnsPromise = (async () => {
      const columns = await all("PRAGMA table_info(discount)");
      const columnNames = columns.map((col) => col.name);
      const statements = [];

      if (!columnNames.includes("start_at")) {
        statements.push(run("ALTER TABLE discount ADD COLUMN start_at DATETIME"));
      }
      if (!columnNames.includes("end_at")) {
        statements.push(run("ALTER TABLE discount ADD COLUMN end_at DATETIME"));
      }

      if (statements.length) {
        await statements.reduce((promise, stmt) => promise.then(() => stmt), Promise.resolve());
      }

      discountScheduleColumnsEnsured = true;
    })().catch((err) => {
      ensureColumnsPromise = null;
      throw err;
    });
  }

  return ensureColumnsPromise;
}

let discountTierTableEnsured = false;
let ensureTierTablePromise = null;

async function ensureDiscountTierTable() {
  if (discountTierTableEnsured) return;
  if (!ensureTierTablePromise) {
    ensureTierTablePromise = (async () => {
      const tableExists = await all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'discount_tiers'"
      );

      if (!tableExists.length) {
        await run(`
          CREATE TABLE IF NOT EXISTS discount_tiers (
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
          )
        `);
        await run(`
          CREATE INDEX IF NOT EXISTS idx_discount_tiers_discount_id_priority
          ON discount_tiers (discount_id, priority)
        `);
      } else {
        const columns = await all("PRAGMA table_info(discount_tiers)");
        const columnNames = columns.map((col) => col.name);
        const statements = [];

        if (!columnNames.includes("label")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN label TEXT"));
        }
        if (!columnNames.includes("min_quantity")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN min_quantity INTEGER"));
        }
        if (!columnNames.includes("max_quantity")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN max_quantity INTEGER"));
        }
        if (!columnNames.includes("min_amount")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN min_amount REAL"));
        }
        if (!columnNames.includes("max_amount")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN max_amount REAL"));
        }
        if (!columnNames.includes("value_type")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN value_type TEXT NOT NULL DEFAULT 'percentage'"));
        }
        if (!columnNames.includes("value")) {
          statements.push(run("ALTER TABLE discount_tiers ADD COLUMN value REAL NOT NULL DEFAULT 0"));
        }
        if (!columnNames.includes("priority")) {
          statements.push(
            run("ALTER TABLE discount_tiers ADD COLUMN priority INTEGER NOT NULL DEFAULT 0")
          );
        }
        if (statements.length) {
          await statements.reduce((promise, stmt) => promise.then(() => stmt), Promise.resolve());
        }

        await run(`
          CREATE INDEX IF NOT EXISTS idx_discount_tiers_discount_id_priority
          ON discount_tiers (discount_id, priority)
        `);
      }

      discountTierTableEnsured = true;
    })().catch((err) => {
      ensureTierTablePromise = null;
      throw err;
    });
  }

  return ensureTierTablePromise;
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toISOString === "function") {
    try {
      return value.toISOString();
    } catch (err) {
      // fall back to parsing below
    }
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function computeIsActiveNow(discount) {
  const now = Date.now();

  if (discount.start_at) {
    const startTime = Date.parse(discount.start_at);
    if (Number.isNaN(startTime) || startTime > now) {
      return 0;
    }
  }

  if (discount.end_at) {
    const endTime = Date.parse(discount.end_at);
    if (Number.isNaN(endTime) || endTime < now) {
      return 0;
    }
  }

  return 1;
}

function parseNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeTierForStorage(tier, index) {
  return {
    label: tier?.label ? String(tier.label).trim() || null : null,
    min_quantity: parseNullableInteger(tier?.min_quantity),
    max_quantity: parseNullableInteger(tier?.max_quantity),
    min_amount: parseNullableNumber(tier?.min_amount),
    max_amount: parseNullableNumber(tier?.max_amount),
    value_type:
      tier && typeof tier.value_type === "string"
        ? tier.value_type.toLowerCase()
        : tier?.value_type,
    value: Number(tier?.value ?? 0),
    priority: Number.isFinite(Number(tier?.priority)) ? Number(tier.priority) : index
  };
}

// GET /api/product/discount
export async function GET(request) {
  try {
    await init();
    await ensureDiscountScheduleColumns();
    await ensureDiscountTierTable();
    
    // Get discounts with related products/units using optimized query
    const discounts = await all(`
      SELECT d.*,
        GROUP_CONCAT(DISTINCT dp.product_id) AS product_ids,
        GROUP_CONCAT(DISTINCT du.unit_id) AS unit_ids
      FROM discount d
      LEFT JOIN discount_products dp ON d.id = dp.discount_id
      LEFT JOIN discount_units du ON d.id = du.discount_id
      GROUP BY d.id
      ORDER BY d.created_at DESC, d.id DESC
    `);
    
    if (!discounts.length) {
      return successResponse([]);
    }

    const discountIds = discounts.map((discount) => discount.id);
    const tiersByDiscount = new Map();

    if (discountIds.length) {
      const tierRows = await all(
        `SELECT id, discount_id, label, min_quantity, max_quantity, min_amount, max_amount, value_type, value, priority
         FROM discount_tiers
         WHERE discount_id IN (${discountIds.map(() => '?').join(',')})
         ORDER BY discount_id, priority, id`,
        discountIds
      );

      tierRows.forEach((row) => {
        if (!tiersByDiscount.has(row.discount_id)) {
          tiersByDiscount.set(row.discount_id, []);
        }
        tiersByDiscount.get(row.discount_id).push({
          id: row.id,
          label: row.label,
          min_quantity: row.min_quantity,
          max_quantity: row.max_quantity,
          min_amount: row.min_amount,
          max_amount: row.max_amount,
          value_type: row.value_type,
          value: row.value,
          priority: row.priority
        });
      });
    }
    
  // Enhanced discount data with product/unit details
    const enhancedDiscounts = await Promise.all(
      discounts.map(async (discount) => {
        const productIds = discount.product_ids ? discount.product_ids.split(",").map(Number) : [];
        const unitIds = discount.unit_ids ? discount.unit_ids.split(",").map(Number) : [];
        
        let products = [];
        let units = [];
        let names = [];
        const tiers = tiersByDiscount.get(discount.id) || [];
        
        if (discount.type === 'product' && productIds.length > 0) {
          // Get detailed product information
          const productDetails = await all(
            `SELECT p.id, p.name, p.image_path FROM products p WHERE p.id IN (${productIds.map(() => '?').join(',')})`,
            productIds
          );
          products = productDetails;
          names = productDetails.map(p => p.name);
        } else if (discount.type === 'unit' && unitIds.length > 0) {
          // Get detailed unit information with product context
          const unitDetails = await all(
            `SELECT pu.id, pu.unit_name, pu.price, p.id as product_id, p.name as product_name 
             FROM product_units pu 
             LEFT JOIN products p ON pu.product_id = p.id 
             WHERE pu.id IN (${unitIds.map(() => '?').join(',')})`,
            unitIds
          );
          units = unitDetails;
          names = unitDetails.map(u => `${u.product_name} - ${u.unit_name}`);
        }
        
        const isActiveNow = computeIsActiveNow(discount);
        if (discount.active !== isActiveNow) {
          await run(`UPDATE discount SET active = ? WHERE id = ?`, [isActiveNow, discount.id]);
          discount.active = isActiveNow;
        }

        return {
          ...discount,
          product_ids: productIds,
          unit_ids: unitIds,
          products,
          units,
          names,
          tiers,
          is_active_now: isActiveNow
        };
      })
    );
    
    return successResponse(enhancedDiscounts);
  } catch (err) {
    console.error("GET /api/product/discount error:", err);
    return errorResponse("Gagal mengambil data diskon");
  }
}

// POST /api/product/discount
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      type = 'product',
      value_type = 'percentage',
      value = 0,
      product_ids = [],
      unit_ids = [],
      start_at = null,
      end_at = null,
      tiers = []
    } = body || {};

  const normalizedValueType = typeof value_type === 'string' ? value_type.toLowerCase() : value_type;
    
    // Validate input data
    const validationError = validateDiscountData(body);
    if (validationError) {
      return errorResponse(validationError, 400);
    }
    
    await init();
    await ensureDiscountScheduleColumns();
    await ensureDiscountTierTable();
    
    // Check for duplicate discount names
    const existingDiscount = await get("SELECT id FROM discount WHERE name = ?", [name.trim()]);
    if (existingDiscount) {
      return errorResponse("Nama diskon sudah digunakan", 400);
    }
    
    // Validate product/unit existence
    if (type === 'product' && product_ids.length > 0) {
      const existingProducts = await all(
        `SELECT id FROM products WHERE id IN (${product_ids.map(() => '?').join(',')})`,
        product_ids
      );
      if (existingProducts.length !== product_ids.length) {
        return errorResponse("Beberapa produk yang dipilih tidak ditemukan", 400);
      }
    }
    
    if (type === 'unit' && unit_ids.length > 0) {
      const existingUnits = await all(
        `SELECT id FROM product_units WHERE id IN (${unit_ids.map(() => '?').join(',')})`,
        unit_ids
      );
      if (existingUnits.length !== unit_ids.length) {
        return errorResponse("Beberapa unit yang dipilih tidak ditemukan", 400);
      }
    }
    
    // Insert discount
    const normalizedStart = normalizeDateValue(start_at);
    const normalizedEnd = normalizeDateValue(end_at);
    const computedActive = computeIsActiveNow({ start_at: normalizedStart, end_at: normalizedEnd });
    const sanitizedValue = normalizedValueType === 'tiered' ? 0 : Number(value ?? 0);

    const discountResult = await run(
      `INSERT INTO discount (name, value_type, value, active, type, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        normalizedValueType,
        sanitizedValue,
        computedActive,
        type,
        normalizedStart,
        normalizedEnd
      ]
    );
    
    const discountId = discountResult.lastID;
    
    // Insert relations
    if (type === 'product' && product_ids.length > 0) {
      const insertPromises = product_ids.map(pid =>
        run(`INSERT INTO discount_products (discount_id, product_id) VALUES (?, ?)`, [discountId, pid])
      );
      await Promise.all(insertPromises);
    } else if (type === 'unit' && unit_ids.length > 0) {
      const insertPromises = unit_ids.map(uid =>
        run(`INSERT INTO discount_units (discount_id, unit_id) VALUES (?, ?)`, [discountId, uid])
      );
      await Promise.all(insertPromises);
    }

  if (normalizedValueType === 'tiered') {
      const normalizedTiers = Array.isArray(tiers)
        ? tiers.map((tier, index) => {
            const normalized = normalizeTierForStorage(tier, index);
            return { ...normalized, priority: index };
          })
        : [];

      if (normalizedTiers.length > 0) {
        const insertTierPromises = normalizedTiers.map((tier) =>
          run(
            `INSERT INTO discount_tiers (discount_id, label, min_quantity, max_quantity, min_amount, max_amount, value_type, value, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              discountId,
              tier.label,
              tier.min_quantity,
              tier.max_quantity,
              tier.min_amount,
              tier.max_amount,
              tier.value_type,
              tier.value,
              tier.priority
            ]
          )
        );
        await Promise.all(insertTierPromises);
      }
    }
    
    return successResponse({ id: discountId }, 201);
  } catch (err) {
    console.error("POST /api/product/discount error:", err);
    return errorResponse("Gagal membuat diskon");
  }
}

// PATCH /api/product/discount
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, name, type, value_type, value, product_ids, unit_ids, start_at, end_at, tiers } = body || {};
    const normalizedValueType =
      value_type === undefined
        ? undefined
        : typeof value_type === "string"
          ? value_type.toLowerCase()
          : value_type;
    
    if (!id) {
      return errorResponse("ID diskon wajib diisi", 400);
    }
    
    await init();
    await ensureDiscountScheduleColumns();
    await ensureDiscountTierTable();
    
    // Check if discount exists
    const existingDiscount = await get("SELECT * FROM discount WHERE id = ?", [id]);
    if (!existingDiscount) {
      return errorResponse("Diskon tidak ditemukan", 404);
    }
    
    // Validate input data if provided
    if (Object.keys(body).length > 1) { // More than just id
      const validationError = validateDiscountData(body, true, existingDiscount);
      if (validationError) {
        return errorResponse(validationError, 400);
      }
    }

    if (type === 'product' && product_ids === undefined) {
      return errorResponse("Pilih produk untuk diskon tipe produk", 400);
    }

    if (type === 'unit' && unit_ids === undefined) {
      return errorResponse("Pilih unit untuk diskon tipe unit", 400);
    }

    const finalStart = start_at !== undefined ? normalizeDateValue(start_at) : existingDiscount.start_at;
    const finalEnd = end_at !== undefined ? normalizeDateValue(end_at) : existingDiscount.end_at;
    if (finalStart && finalEnd && Date.parse(finalStart) > Date.parse(finalEnd)) {
      return errorResponse("Tanggal mulai harus sebelum atau sama dengan tanggal berakhir", 400);
    }
    
    // Check for duplicate names (excluding current discount)
    if (name && name.trim() !== existingDiscount.name) {
      const duplicateDiscount = await get("SELECT id FROM discount WHERE name = ? AND id != ?", [name.trim(), id]);
      if (duplicateDiscount) {
        return errorResponse("Nama diskon sudah digunakan", 400);
      }
    }
    
    // Update discount fields
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      updateValues.push(name.trim());
    }
    if (value_type !== undefined) {
      updateFields.push("value_type = ?");
      updateValues.push(normalizedValueType);
    }
    const existingValueTypeNormalized =
      typeof existingDiscount.value_type === "string"
        ? existingDiscount.value_type.toLowerCase()
        : existingDiscount.value_type;
    const targetValueType =
      normalizedValueType !== undefined ? normalizedValueType : existingValueTypeNormalized;

    if (value !== undefined) {
      const sanitized = targetValueType === 'tiered' ? 0 : Number(value);
      updateFields.push("value = ?");
      updateValues.push(sanitized);
    } else if (normalizedValueType !== undefined && normalizedValueType === 'tiered') {
      updateFields.push("value = ?");
      updateValues.push(0);
    }

    if (type !== undefined) {
      updateFields.push("type = ?");
      updateValues.push(type);
    }
    if (start_at !== undefined) {
      updateFields.push("start_at = ?");
      updateValues.push(finalStart);
    }
    if (end_at !== undefined) {
      updateFields.push("end_at = ?");
      updateValues.push(finalEnd);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await run(`UPDATE discount SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);
    }
    
    // Update product/unit relations
  const finalType = type || existingDiscount.type;
  const finalValueType = targetValueType;
    
    if (finalType === 'product' && Array.isArray(product_ids)) {
      // Validate product existence
      if (product_ids.length > 0) {
        const existingProducts = await all(
          `SELECT id FROM products WHERE id IN (${product_ids.map(() => '?').join(',')})`,
          product_ids
        );
        if (existingProducts.length !== product_ids.length) {
          return errorResponse("Beberapa produk yang dipilih tidak ditemukan", 400);
        }
      }
      
      // Clear existing relations and insert new ones
      await run(`DELETE FROM discount_products WHERE discount_id = ?`, [id]);
      await run(`DELETE FROM discount_units WHERE discount_id = ?`, [id]);
      
      if (product_ids.length > 0) {
        const insertPromises = product_ids.map(pid =>
          run(`INSERT INTO discount_products (discount_id, product_id) VALUES (?, ?)`, [id, pid])
        );
        await Promise.all(insertPromises);
      }
    } else if (finalType === 'unit' && Array.isArray(unit_ids)) {
      // Validate unit existence
      if (unit_ids.length > 0) {
        const existingUnits = await all(
          `SELECT id FROM product_units WHERE id IN (${unit_ids.map(() => '?').join(',')})`,
          unit_ids
        );
        if (existingUnits.length !== unit_ids.length) {
          return errorResponse("Beberapa unit yang dipilih tidak ditemukan", 400);
        }
      }
      
      // Clear existing relations and insert new ones
      await run(`DELETE FROM discount_units WHERE discount_id = ?`, [id]);
      await run(`DELETE FROM discount_products WHERE discount_id = ?`, [id]);
      
      if (unit_ids.length > 0) {
        const insertPromises = unit_ids.map(uid =>
          run(`INSERT INTO discount_units (discount_id, unit_id) VALUES (?, ?)`, [id, uid])
        );
        await Promise.all(insertPromises);
      }
    }

    if (finalValueType === 'tiered') {
      if (tiers !== undefined) {
        await run(`DELETE FROM discount_tiers WHERE discount_id = ?`, [id]);

        if (Array.isArray(tiers) && tiers.length > 0) {
          const normalizedTiers = tiers.map((tierItem, index) => {
            const normalized = normalizeTierForStorage(tierItem, index);
            return { ...normalized, priority: index };
          });

          const insertTierPromises = normalizedTiers.map((tierItem) =>
            run(
              `INSERT INTO discount_tiers (discount_id, label, min_quantity, max_quantity, min_amount, max_amount, value_type, value, priority)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                tierItem.label,
                tierItem.min_quantity,
                tierItem.max_quantity,
                tierItem.min_amount,
                tierItem.max_amount,
                tierItem.value_type,
                tierItem.value,
                tierItem.priority
              ]
            )
          );
          await Promise.all(insertTierPromises);
        }
      }
    } else {
      await run(`DELETE FROM discount_tiers WHERE discount_id = ?`, [id]);
    }

    const recalculatedActive = computeIsActiveNow({ start_at: finalStart, end_at: finalEnd });
    await run(`UPDATE discount SET active = ? WHERE id = ?`, [recalculatedActive, id]);

    return successResponse({ message: "Diskon berhasil diperbarui" });
  } catch (err) {
    console.error("PATCH /api/product/discount error:", err);
    return errorResponse("Gagal memperbarui diskon");
  }
}

// DELETE /api/product/discount
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return errorResponse("ID diskon wajib diisi", 400);
    }
    
    await init();
    await ensureDiscountTierTable();
    
    // Check if discount exists
    const existingDiscount = await get("SELECT id FROM discount WHERE id = ?", [id]);
    if (!existingDiscount) {
      return errorResponse("Diskon tidak ditemukan", 404);
    }
    
    // Delete discount and related data (foreign key constraints will handle relations)
    await Promise.all([
      run(`DELETE FROM discount_products WHERE discount_id = ?`, [id]),
      run(`DELETE FROM discount_units WHERE discount_id = ?`, [id]),
      run(`DELETE FROM discount_tiers WHERE discount_id = ?`, [id])
    ]);
    
    await run(`DELETE FROM discount WHERE id = ?`, [id]);
    
    return successResponse({ message: "Diskon berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /api/product/discount error:", err);
    return errorResponse("Gagal menghapus diskon");
  }
}
