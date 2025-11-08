import { init, all, get, run } from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { nowWIBForSQL, formatDateToSQL } from '@/lib/module/TimestampIndonesia.js';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = getJwtSecret();

function getUserFromToken(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // { id, username, role }
  } catch (e) {
    return null;
  }
}

// Simple users route for app router API
export async function GET(req) {
  await init();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const role = url.searchParams.get("role");
    const online = url.searchParams.get("online");
    const onlyIds = url.searchParams.get("onlyIds");

    if (id) {
      const row = await get(
        "SELECT id, name, username, role, no_hp, is_online, last_active FROM users WHERE id = ?",
        [id]
      );
      return NextResponse.json(row || null, { status: 200 });
    }

    const conditions = [];
    const params = [];
    if (role) {
      conditions.push("role = ?");
      params.push(role);
    }
    if (online === "true") {
      // Use WIB-based threshold without SQLite time functions to avoid UTC mismatch
      const fiveMinAgoWIB = formatDateToSQL(new Date(Date.now() - 5 * 60 * 1000), 'Asia/Jakarta');
      conditions.push("(is_online = 1 OR (last_active IS NOT NULL AND last_active >= ?)) ");
      params.push(fiveMinAgoWIB);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const selectCols = onlyIds === "true" ? "id" : "id, name, username, role, no_hp, is_online, last_active";
    const rows = await all(`SELECT ${selectCols} FROM users ${where} ORDER BY id DESC`, params);
    return NextResponse.json(rows, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req) {
  await init();
  try {
    const body = await req.json();
    const { name, username, password, role, no_hp } = body || {};
    if (!username || !password || !role || !no_hp) {
      return new Response(JSON.stringify({ error: "username, password, role and no_hp are required" }), { status: 400 });
    }

    const res = await run(
      `INSERT INTO users (name, username, password, role, no_hp) VALUES (?, ?, ?, ?, ?)`,
      [name || null, username, password, role, no_hp]
    );
    const created = await get("SELECT id, name, username, role, no_hp FROM users WHERE id = ?", [res.lastID]);
    return new Response(JSON.stringify(created), { status: 201 });
  } catch (err) {
    console.error(err);
    // unique constraint on username
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

export async function PUT(req) {
  await init();
  try {
    const body = await req.json();
    const { id, name, username, password, role, no_hp, is_online } = body || {};
    if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400 });

    // build update
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (username !== undefined) { fields.push("username = ?"); params.push(username); }
    if (password !== undefined) { fields.push("password = ?"); params.push(password); }
    if (role !== undefined) { fields.push("role = ?"); params.push(role); }
    if (no_hp !== undefined) { fields.push("no_hp = ?"); params.push(no_hp); }
    if (is_online !== undefined) { fields.push("is_online = ?"); params.push(is_online ? 1 : 0); }

    if (!fields.length) return new Response(JSON.stringify({ error: "no fields to update" }), { status: 400 });

    params.push(id);
    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    await run(sql, params);
    const updated = await get("SELECT id, name, username, role, no_hp, is_online, last_active FROM users WHERE id = ?", [id]);
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

// PATCH /api/users/presence - set online/offline, requires auth
export async function PATCH(req) {
  await init();
  try {
    const user = getUserFromToken(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { is_online } = body || {};
  const now = nowWIBForSQL();
  await run("UPDATE users SET is_online = ?, last_active = ? WHERE id = ?", [is_online ? 1 : 0, now, user.id]);
    const updated = await get("SELECT id, is_online, last_active FROM users WHERE id = ?", [user.id]);
    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  await init();
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400 });
    await run("DELETE FROM users WHERE id = ?", [id]);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
