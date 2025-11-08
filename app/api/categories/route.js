import { init, all, get, run } from "@/lib/db";

// Helper function for consistent error responses
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), { 
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper function for consistent success responses
function successResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { 
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET(req) {
  try {
    await init();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (id) {
      const row = await get("SELECT * FROM categories WHERE id = ?", [id]);
      return successResponse(row || null);
    }
    
    const rows = await all("SELECT * FROM categories ORDER BY name ASC");
    return successResponse(rows);
  } catch (err) {
    console.error("GET /api/categories error:", err);
    return errorResponse(String(err));
  }
}

export async function POST(req) {
  try {
    await init();
    const body = await req.json();
    const { name } = body || {};
    
    if (!name?.trim()) {
      return errorResponse('Nama kategori diperlukan', 400);
    }
    
    const res = await run("INSERT INTO categories (name) VALUES (?)", [name.trim()]);
    const created = await get("SELECT * FROM categories WHERE id = ?", [res.lastID]);
    return successResponse(created, 201);
  } catch (err) {
    console.error("POST /api/categories error:", err);
    return errorResponse(String(err));
  }
}

export async function PUT(req) {
  try {
    await init();
    const body = await req.json();
    const { id, name } = body || {};
    
    if (!id) {
      return errorResponse('ID kategori diperlukan', 400);
    }
    
    if (name === undefined || !name?.trim()) {
      return errorResponse('Nama kategori diperlukan', 400);
    }
    
    const existingCategory = await get("SELECT id FROM categories WHERE id = ?", [id]);
    if (!existingCategory) {
      return errorResponse('Kategori tidak ditemukan', 404);
    }
    
    await run("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id]);
    const updated = await get("SELECT * FROM categories WHERE id = ?", [id]);
    return successResponse(updated);
  } catch (err) {
    console.error("PUT /api/categories error:", err);
    return errorResponse(String(err));
  }
}

export async function DELETE(req) {
  try {
    await init();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return errorResponse('ID kategori diperlukan', 400);
    }
    
    const existingCategory = await get("SELECT id FROM categories WHERE id = ?", [id]);
    if (!existingCategory) {
      return errorResponse('Kategori tidak ditemukan', 404);
    }
    
    await run("DELETE FROM categories WHERE id = ?", [id]);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("DELETE /api/categories error:", err);
    return errorResponse(String(err));
  }
}
