import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";

const JWT_SECRET = getJwtSecret();

/**
 * GET /api/auth/me
 * Get current user from JWT token
 */
export async function GET(request) {
  try {
    const token = request.cookies.get("token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: "No token found" }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    return NextResponse.json({
      success: true,
      user: { id: decoded.id, username: decoded.username, role: decoded.role }
    });
  } catch (err) {
    console.error("JWT verification error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
