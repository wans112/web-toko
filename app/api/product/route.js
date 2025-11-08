import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { convertToWebp } from "@/lib/module/ConvertToWebp.js";
import { nowWIBForSQL } from '@/lib/module/TimestampIndonesia.js';
import { init, run, get, all } from "@/lib/db.js";

const imagesRoot = path.join(process.cwd(), "database", "images");

// Helper functions
function safeBase(name, id) {
  return `${id}_${String(name || "image").replace(/[^a-z0-9_\-]/gi, "_")}`;
}

function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function successResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

// Helper function to format product with category
function formatProduct(product, categoryName = null) {
  if (!product) return null;
  
  const formatted = { ...product };
  formatted.category = categoryName || product.category_name || product.category || null;
  delete formatted.category_name;
  return formatted;
}

// Helper function to get products with units
async function getProductsWithUnits(productIds = []) {
  let units = [];
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(", ");
    units = await all(`SELECT * FROM product_units WHERE product_id IN (${placeholders}) ORDER BY id`, productIds);
  }
  
  const unitsByProduct = {};
  units.forEach((u) => {
    (unitsByProduct[u.product_id] = unitsByProduct[u.product_id] || []).push(u);
  });
  
  return unitsByProduct;
}

async function saveImageFromBase64(base64, baseName) {
  if (!base64?.trim()) return null;
  
  const match = String(base64).match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
  const mime = match ? match[1] : null;
  const b64 = match ? match[2] : base64;
  
  let buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch (e) {
    console.error("Invalid base64 data:", e);
    return null;
  }

  if (!fs.existsSync(imagesRoot)) {
    fs.mkdirSync(imagesRoot, { recursive: true });
  }

  // ensure product subfolder exists
  const productDir = path.join(imagesRoot, 'product');
  if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });

  // Try WebP conversion first and save under product/ subfolder
  try {
    const out = await convertToWebp(buffer, productDir, baseName);
    if (out && typeof out === "string" && fs.existsSync(out)) {
      return `product/${path.basename(out)}`;
    }
  } catch (e) {
    console.warn("convertToWebp failed, using fallback:", e);
  }

  // Fallback to original format
  const ext = mime === "image/png" ? ".png" : mime === "image/jpeg" ? ".jpg" : ".webp";
  const filename = `${baseName}${ext}`;
  const filePath = path.join(productDir, filename);
  
  try {
    fs.writeFileSync(filePath, buffer);
    return `product/${filename}`;
  } catch (e) {
    console.error("Failed to write image file:", e);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const id = searchParams.get("id");

    // Handle image serving
    if (filename) {
      // filename may include subfolder like 'product/xxx.webp'
      const filePath = path.join(imagesRoot, filename);
      if (!fs.existsSync(filePath)) {
        return errorResponse("Gambar tidak ditemukan", 404);
      }
      
      const file = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes = {
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
      };
      const mime = mimeTypes[ext] || 'application/octet-stream';
      
      return new Response(file, { 
        headers: { 
          "Content-Type": mime,
          "Cache-Control": "public, max-age=31536000"
        } 
      });
    }

    await init();

    // Handle single product request
    if (id) {
      const prod = await get(
        `SELECT p.*, c.name AS category_name FROM products p 
         LEFT JOIN categories c ON p.category_id = c.id 
         WHERE p.id = ?`,
        [id]
      );
      
      if (!prod) {
        return successResponse(null);
      }
      
      const units = await all(
        "SELECT * FROM product_units WHERE product_id = ? ORDER BY id", 
        [prod.id]
      );
      
      const result = formatProduct(prod);
      result.units = units || [];
      
      return successResponse(result);
    }

    // Handle all products request
    const products = await all(
      `SELECT p.*, c.name AS category_name FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       ORDER BY p.created_at DESC, p.id DESC`
    );
    
    if (!products.length) {
      return successResponse([]);
    }
    
    const productIds = products.map(p => p.id);
    const unitsByProduct = await getProductsWithUnits(productIds);
    
    const result = products.map(p => {
      const formatted = formatProduct(p);
      formatted.units = unitsByProduct[p.id] || [];
      return formatted;
    });
    
    return successResponse(result);
  } catch (err) {
    console.error("GET /api/product error:", err);
    return errorResponse("Kesalahan server");
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description = null, category = null, base64 = null, units = [] } = body || {};
    
    if (!name?.trim()) {
      return errorResponse("Nama produk diperlukan", 400);
    }

    await init();

    // Insert product with proper error handling for both schema versions
    let res;
    const productData = [name.trim(), description?.trim() || null, null, category];
    
    try {
      const now = nowWIBForSQL();
      res = await run(
        `INSERT INTO products (name, description, image_path, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [...productData, now, now]
      );
    } catch (e) {
      // Fallback for legacy schema
      const now = nowWIBForSQL();
      res = await run(
        `INSERT INTO products (name, description, image_path, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, 
        [...productData, now, now]
      );
    }

    const newId = res.lastID;

    // Insert units if provided
    if (Array.isArray(units) && units.length > 0) {
      const insertUnitSQL = `INSERT INTO product_units (product_id, unit_name, qty_per_unit, price, stock) VALUES (?, ?, ?, ?, ?)`;
      
      for (const u of units) {
        const unitData = [
          newId,
          (u.unit_name || "unit").trim(),
          Math.max(1, Number(u.qty_per_unit) || 1),
          Math.max(0, Number(u.price) || 0),
          Math.max(0, Number(u.stock) || 0)
        ];
        await run(insertUnitSQL, unitData);
      }
    }

    // Handle image upload
    if (base64?.trim()) {
      const base = safeBase(name, newId);
      const savedFilename = await saveImageFromBase64(base64, base);
      if (savedFilename) {
        await run(`UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?`, [savedFilename, nowWIBForSQL(), newId]);
      }
    }

    // Fetch and return created product
    const created = await get(
      `SELECT p.*, c.name AS category_name FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [newId]
    );
    
    const createdUnits = await all(
      "SELECT * FROM product_units WHERE product_id = ? ORDER BY id", 
      [newId]
    );
    
    const result = formatProduct(created);
    result.units = createdUnits || [];

    return successResponse({ success: true, product: result }, 201);
  } catch (err) {
    console.error("POST /api/product error:", err);
    return errorResponse("Kesalahan server");
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, description, category, base64, units } = body || {};

    if (!id) {
      return errorResponse("ID produk diperlukan", 400);
    }

    await init();

    // Check if product exists
    const prod = await get("SELECT * FROM products WHERE id = ?", [id]);
    if (!prod) {
      return errorResponse("Produk tidak ditemukan", 404);
    }

    // Update product fields
    const updateFields = [];
    const updateParams = [];
    
    if (name !== undefined) {
      updateFields.push("name = ?");
      updateParams.push(name.trim());
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      updateParams.push(description?.trim() || null);
    }
    if (category !== undefined) {
      updateFields.push("category_id = ?");
      updateParams.push(category);
    }

    if (updateFields.length > 0) {
      updateParams.push(id);
      const sql = `UPDATE products SET ${updateFields.join(", ")} WHERE id = ?`;
      
      try {
        await run(sql, updateParams);
      } catch (e) {
        // Fallback for legacy schema
        const legacyFields = updateFields.map(f => f.replace("category_id", "category"));
        const legacySql = `UPDATE products SET ${legacyFields.join(", ")} WHERE id = ?`;
        await run(legacySql, updateParams);
      }
    }

    // Update units
    if (Array.isArray(units)) {
      const existingUnits = await all("SELECT * FROM product_units WHERE product_id = ?", [id]);
      const existingUnitIds = new Set(existingUnits.map(u => u.id));
      const incomingUnitIds = new Set(units.map(u => u.id).filter(Boolean));

      // Delete removed units
      for (const u of existingUnits) {
        if (!incomingUnitIds.has(u.id)) {
          await run("DELETE FROM product_units WHERE id = ?", [u.id]);
        }
      }

      // Update or insert units
      for (const u of units) {
        const unitData = [
          (u.unit_name || "unit").trim(),
          Math.max(1, Number(u.qty_per_unit) || 1),
          Math.max(0, Number(u.price) || 0),
          Math.max(0, Number(u.stock) || 0)
        ];
        
        if (u.id && existingUnitIds.has(u.id)) {
          // Update existing unit
          await run(
            "UPDATE product_units SET unit_name = ?, qty_per_unit = ?, price = ?, stock = ? WHERE id = ?",
            [...unitData, u.id]
          );
        } else {
          // Insert new unit
          await run(
            "INSERT INTO product_units (product_id, unit_name, qty_per_unit, price, stock) VALUES (?, ?, ?, ?, ?)",
            [id, ...unitData]
          );
        }
      }
    }

    // Handle image update
    if (base64?.trim()) {
      const base = safeBase(name || prod.name, id);
      const savedFilename = await saveImageFromBase64(base64, base);
      
      if (savedFilename) {
        // Clean up old image
        if (prod.image_path && prod.image_path !== savedFilename) {
          try {
            const oldPath = path.join(imagesRoot, prod.image_path);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          } catch (e) {
            console.warn("Failed to delete old image:", e);
          }
        }
        
        await run("UPDATE products SET image_path = ?, updated_at = ? WHERE id = ?", [savedFilename, nowWIBForSQL(), id]);
      }
    }

    // Fetch and return updated product
    const updated = await get(
      `SELECT p.*, c.name AS category_name FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [id]
    );
    
    const updatedUnits = await all(
      "SELECT * FROM product_units WHERE product_id = ? ORDER BY id", 
      [id]
    );
    
    const result = formatProduct(updated);
    result.units = updatedUnits || [];
    
    return successResponse({ success: true, product: result });
  } catch (err) {
    console.error("PUT /api/product error:", err);
    return errorResponse("Kesalahan server");
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { id } = body || {};
    
    if (!id) {
      return errorResponse("ID produk diperlukan", 400);
    }

    await init();

    // Check if product exists
    const prod = await get("SELECT * FROM products WHERE id = ?", [id]);
    if (!prod) {
      return errorResponse("Produk tidak ditemukan", 404);
    }

    // Clean up image file
  if (prod.image_path) {
      try {
        const filePath = path.join(imagesRoot, prod.image_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn("Failed to delete image file:", e);
      }
    }

    // Delete product (units will be deleted by foreign key constraints if set up)
    await run("DELETE FROM product_units WHERE product_id = ?", [id]);
    await run("DELETE FROM products WHERE id = ?", [id]);
    
    return successResponse({ success: true });
  } catch (err) {
    console.error("DELETE /api/product error:", err);
    return errorResponse("Kesalahan server");
  }
}