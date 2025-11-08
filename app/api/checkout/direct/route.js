import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getCurrentUser, getJwtSecret } from "@/lib/auth.js";
import { init, all } from "@/lib/db.js";

const JWT_SECRET = getJwtSecret();
const TOKEN_TTL_SECONDS = 10 * 60; // 10 minutes

function errorResponse(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function successResponse(data, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

// Issue a short-lived token for direct checkout
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];

    const cleanItems = items
      .map((i) => ({
        unit_id: Number(i?.unit_id) || 0,
        quantity: Math.max(1, parseInt(i?.quantity || 0, 10) || 0),
      }))
      .filter((i) => i.unit_id > 0 && i.quantity > 0);

    if (cleanItems.length === 0) {
      return errorResponse("Items tidak valid", 400);
    }

    const token = jwt.sign(
      { sub: user.id, items: cleanItems },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL_SECONDS }
    );

    return successResponse({ token, expires_in: TOKEN_TTL_SECONDS });
  } catch (err) {
    console.error("POST /api/checkout/direct error:", err);
    return errorResponse("Kesalahan server", 500);
  }
}

// Resolve token to concrete item details (price, names, image)
export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) return errorResponse("Token diperlukan", 400);

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return errorResponse("Token tidak valid atau kadaluarsa", 401);
    }

    if (!payload || payload.sub !== user.id) {
      return errorResponse("Token tidak cocok dengan pengguna", 403);
    }

    await init();

    const unitIds = (payload.items || []).map((i) => i.unit_id);
    if (unitIds.length === 0) return successResponse({ items: [] });

    const placeholders = unitIds.map(() => "?").join(", ");
    const units = await all(
      `SELECT pu.*, p.name AS product_name, p.id AS product_id, p.image_path
       FROM product_units pu
       LEFT JOIN products p ON pu.product_id = p.id
       WHERE pu.id IN (${placeholders})`,
      unitIds
    );

    const byId = {};
    for (const u of units) byId[u.id] = u;

    const items = (payload.items || [])
      .map((i) => {
        const u = byId[i.unit_id];
        if (!u) return null;
        return {
          unit_id: u.id,
          product_id: u.product_id,
          product_name: u.product_name,
          unit_name: u.unit_name,
          quantity: i.quantity,
          price: u.price,
          image_path: u.image_path,
        };
      })
      .filter(Boolean);

    return successResponse({ items });
  } catch (err) {
    console.error("GET /api/checkout/direct error:", err);
    return errorResponse("Kesalahan server", 500);
  }
}
