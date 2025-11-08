import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { init, get } from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";

const JWT_SECRET = getJwtSecret();

/**
 * POST /api/auth
 * Body: { username, password }
 *
 * - Inisialisasi DB
 * - Verifikasi username/password (saat ini plain text)
 * - Kembalikan JWT melalui HttpOnly cookie jika berhasil
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return NextResponse.json({ error: "Username atau password belum diisi" }, { status: 400 });
    }

    await init();

    const user = await get(
      "SELECT id, name, username, password, role, no_hp FROM users WHERE username = ?",
      [username]
    );

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
    }

    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, no_hp: user.no_hp },
    });

    const url = new URL(request.url);
    const xfProto = request.headers.get('x-forwarded-proto');
    const isHttps = (xfProto || url.protocol.replace(':','')) === 'https';

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Kesalahan server" }, { status: 500 });
  }
}

/**
 * DELETE /api/auth
 * - Hapus cookie token (logout)
 */
export async function DELETE(request) {
  try {
    const res = NextResponse.json({ success: true, message: "Logged out" });
    const url = new URL(request.url);
    const xfProto = request.headers.get('x-forwarded-proto');
    const isHttps = (xfProto || url.protocol.replace(':','')) === 'https';
    res.cookies.set("token", "", {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Gagal logout" }, { status: 500 });
  }
}