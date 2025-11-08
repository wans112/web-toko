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
function validateDiscountData(body, isUpdate = false) {
  const { name, type, value_type, value, product_ids, unit_ids, start_at, end_at } = body || {};
  
  if (!isUpdate && !name?.trim()) {
    return "Nama diskon wajib diisi";
  }
  
  if (!isUpdate && !type) {
    return "Tipe diskon wajib diisi";
  }
  
  if (!isUpdate && !value_type) {
    return "Tipe nilai diskon wajib diisi";
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
  
  if (value_type === 'percentage' && (value < 0 || value > 100)) {
    return "Persentase diskon harus antara 0-100";
  }
  
  if (value_type === 'nominal' && value < 0) {
    return "Nominal diskon tidak boleh negatif";
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

// Helper function to get product and unit mappings
async function getProductUnitMappings() {
  const [products, units] = await Promise.all([
    all("SELECT id, name FROM products ORDER BY name"),
    all("SELECT pu.id, pu.unit_name, pu.product_id, p.name as product_name FROM product_units pu LEFT JOIN products p ON pu.product_id = p.id ORDER BY p.name, pu.unit_name")
  ]);
  
  const productMap = {};
  products.forEach(p => { productMap[p.id] = p.name; });
  
  const unitMap = {};
  units.forEach(u => { 
    unitMap[u.id] = u.product_name ? `${u.product_name} - ${u.unit_name}` : u.unit_name; 
  });
  
  return { productMap, unitMap, products, units };
}

// GET /api/product/discount
export async function GET(request) {
  try {
    await init();
    await ensureDiscountScheduleColumns();
    
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
    
    // Get product and unit mappings
    const { productMap, unitMap } = await getProductUnitMappings();
    
    // Enhanced discount data with product/unit details
    const enhancedDiscounts = await Promise.all(
      discounts.map(async (discount) => {
        const productIds = discount.product_ids ? discount.product_ids.split(",").map(Number) : [];
        const unitIds = discount.unit_ids ? discount.unit_ids.split(",").map(Number) : [];
        
        let products = [];
        let units = [];
        let names = [];
        
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
    const { name, type = 'product', value_type = 'percentage', value = 0, product_ids = [], unit_ids = [], start_at = null, end_at = null } = body || {};
    
    // Validate input data
    const validationError = validateDiscountData(body);
    if (validationError) {
      return errorResponse(validationError, 400);
    }
    
    await init();
    await ensureDiscountScheduleColumns();
    
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

    const discountResult = await run(
      `INSERT INTO discount (name, value_type, value, active, type, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        value_type,
        Number(value),
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
    const { id, name, type, value_type, value, product_ids, unit_ids, start_at, end_at } = body || {};
    
    if (!id) {
      return errorResponse("ID diskon wajib diisi", 400);
    }
    
    await init();
    await ensureDiscountScheduleColumns();
    
    // Check if discount exists
    const existingDiscount = await get("SELECT * FROM discount WHERE id = ?", [id]);
    if (!existingDiscount) {
      return errorResponse("Diskon tidak ditemukan", 404);
    }
    
    // Validate input data if provided
    if (Object.keys(body).length > 1) { // More than just id
      const validationError = validateDiscountData(body, true);
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
      updateValues.push(value_type);
    }
    if (value !== undefined) {
      updateFields.push("value = ?");
      updateValues.push(Number(value));
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
    
    // Check if discount exists
    const existingDiscount = await get("SELECT id FROM discount WHERE id = ?", [id]);
    if (!existingDiscount) {
      return errorResponse("Diskon tidak ditemukan", 404);
    }
    
    // Delete discount and related data (foreign key constraints will handle relations)
    await Promise.all([
      run(`DELETE FROM discount_products WHERE discount_id = ?`, [id]),
      run(`DELETE FROM discount_units WHERE discount_id = ?`, [id])
    ]);
    
    await run(`DELETE FROM discount WHERE id = ?`, [id]);
    
    return successResponse({ message: "Diskon berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /api/product/discount error:", err);
    return errorResponse("Gagal menghapus diskon");
  }
}
