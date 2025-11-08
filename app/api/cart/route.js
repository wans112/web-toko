import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { init, all, run, get } from "@/lib/db";
import { nowWIBForSQL } from '@/lib/module/TimestampIndonesia.js';
import { getJwtSecret } from "@/lib/auth";

const JWT_SECRET = getJwtSecret();

// Helper function to get user from token
async function getUserFromToken(request) {
  const tokenCookie = request.cookies.get("token");
  if (!tokenCookie) return null;
  
  try {
    const decoded = jwt.verify(tokenCookie.value, JWT_SECRET);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * GET /api/cart
 * - Get all cart items for current user
 */
export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await init();

    const cartItems = await all(`
      SELECT 
        c.id,
        c.user_id,
        c.unit_id,
        c.quantity,
        c.created_at,
        c.updated_at,
        p.id as product_id,
        p.name as product_name,
        p.image_path,
        pu.unit_name,
        pu.price,
        pu.stock,
        pu.qty_per_unit
      FROM cart c
      JOIN product_units pu ON c.unit_id = pu.id
      JOIN products p ON pu.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `, [user.id]);

    return NextResponse.json({ success: true, data: cartItems });
  } catch (err) {
    console.error("Error fetching cart:", err);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

/**
 * POST /api/cart
 * Body: { unit_id, quantity }
 * - Add item to cart or update quantity if exists
 */
export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { unit_id, quantity } = body;

    if (!unit_id || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid unit_id or quantity" }, { status: 400 });
    }

    await init();

    // Check if item already exists in cart
    const existingItem = await get(
      "SELECT id, quantity FROM cart WHERE user_id = ? AND unit_id = ?",
      [user.id, unit_id]
    );

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      await run(
        "UPDATE cart SET quantity = ?, updated_at = ? WHERE id = ?",
        [newQuantity, nowWIBForSQL(), existingItem.id]
      );
    } else {
      // Insert new item
      await run(
        "INSERT INTO cart (user_id, unit_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [user.id, unit_id, quantity, nowWIBForSQL(), nowWIBForSQL()]
      );
    }

    return NextResponse.json({ success: true, message: "Item added to cart" });
  } catch (err) {
    console.error("Error adding to cart:", err);
    return NextResponse.json({ error: "Failed to add to cart" }, { status: 500 });
  }
}

/**
 * PUT /api/cart
 * Body: { cart_id, quantity }
 * - Update cart item quantity
 */
export async function PUT(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { cart_id, quantity } = body;

    if (!cart_id || quantity < 0) {
      return NextResponse.json({ error: "Invalid cart_id or quantity" }, { status: 400 });
    }

    await init();

    if (quantity === 0) {
      // Remove item if quantity is 0
  await run("DELETE FROM cart WHERE id = ? AND user_id = ?", [cart_id, user.id]);
    } else {
      // Update quantity
      await run(
        "UPDATE cart SET quantity = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [quantity, nowWIBForSQL(), cart_id, user.id]
      );
    }

    return NextResponse.json({ success: true, message: "Cart updated" });
  } catch (err) {
    console.error("Error updating cart:", err);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

/**
 * DELETE /api/cart
 * Query: ?cart_id=123 or no query to clear all
 * - Remove item from cart or clear entire cart
 */
export async function DELETE(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cart_id = searchParams.get("cart_id");

    await init();

    if (cart_id) {
      // Remove specific item
      await run("DELETE FROM cart WHERE id = ? AND user_id = ?", [cart_id, user.id]);
      return NextResponse.json({ success: true, message: "Item removed from cart" });
    } else {
      // Clear entire cart
      await run("DELETE FROM cart WHERE user_id = ?", [user.id]);
      return NextResponse.json({ success: true, message: "Cart cleared" });
    }
  } catch (err) {
    console.error("Error deleting from cart:", err);
    return NextResponse.json({ error: "Failed to delete from cart" }, { status: 500 });
  }
}
