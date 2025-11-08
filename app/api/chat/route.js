import { NextResponse } from "next/server";
import { init, all, get, run, exec } from "@/lib/db";
import { nowWIBForSQL } from '@/lib/module/TimestampIndonesia.js';
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";

const JWT_SECRET = getJwtSecret();

// Ensure chat table exists (safety net if setup hasn't been run)
async function ensureChatTable() {
  await init();
  await exec(`
    CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_users_created_at 
      ON chat (from_user_id, to_user_id, created_at);
  `);
}

// Helper function to get user from JWT token
function getUserFromToken(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

// Helper functions for consistent responses
function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function successResponse(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

// GET /api/chat - Get chat messages
export async function GET(request) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

  await ensureChatTable();
    
    const { searchParams } = new URL(request.url);
    const withUserId = searchParams.get("with_user_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    if (withUserId) {
      // Get conversation with specific user
      const messages = await all(`
        SELECT 
          c.*,
          u1.name as from_user_name,
          u1.username as from_username,
          u2.name as to_user_name,
          u2.username as to_username,
          a1.image_path as from_user_avatar,
          a2.image_path as to_user_avatar
        FROM chat c
        LEFT JOIN users u1 ON c.from_user_id = u1.id
        LEFT JOIN users u2 ON c.to_user_id = u2.id
        LEFT JOIN avatar a1 ON u1.id = a1.user_id
        LEFT JOIN avatar a2 ON u2.id = a2.user_id
        WHERE (c.from_user_id = ? AND c.to_user_id = ?) 
           OR (c.from_user_id = ? AND c.to_user_id = ?)
        ORDER BY c.created_at ASC
        LIMIT ? OFFSET ?
      `, [user.id, withUserId, withUserId, user.id, limit, offset]);
      
      return successResponse(messages);
    } else {
      // Get all conversations (latest message from each user)
      const conversations = await all(`
        SELECT 
          c.*,
          u1.name as from_user_name,
          u1.username as from_username,
          u2.name as to_user_name,
          u2.username as to_username,
          a1.image_path as from_user_avatar,
          a2.image_path as to_user_avatar,
          CASE 
            WHEN c.from_user_id = ? THEN c.to_user_id 
            ELSE c.from_user_id 
          END as other_user_id,
          CASE 
            WHEN c.from_user_id = ? THEN u2.name 
            ELSE u1.name 
          END as other_user_name,
          CASE 
            WHEN c.from_user_id = ? THEN a2.image_path 
            ELSE a1.image_path 
          END as other_user_avatar
        FROM chat c
        LEFT JOIN users u1 ON c.from_user_id = u1.id
        LEFT JOIN users u2 ON c.to_user_id = u2.id
        LEFT JOIN avatar a1 ON u1.id = a1.user_id
        LEFT JOIN avatar a2 ON u2.id = a2.user_id
        WHERE c.from_user_id = ? OR c.to_user_id = ?
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [user.id, user.id, user.id, user.id, user.id, limit, offset]);
      
      // Group by other user and get latest message
      const uniqueConversations = [];
      const seenUsers = new Set();
      
      for (const conv of conversations) {
        if (!seenUsers.has(conv.other_user_id)) {
          uniqueConversations.push(conv);
          seenUsers.add(conv.other_user_id);
        }
      }
      
      return successResponse(uniqueConversations);
    }
  } catch (err) {
    console.error("GET /api/chat error:", err);
    return errorResponse("Gagal mengambil pesan chat");
  }
}

// POST /api/chat - Send new message
export async function POST(request) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const { to_user_id, message } = body || {};
    
    if (!to_user_id) {
      return errorResponse("to_user_id wajib diisi", 400);
    }
    
    if (!message?.trim()) {
      return errorResponse("Pesan tidak boleh kosong", 400);
    }
    
  await ensureChatTable();
    
    // Check if target user exists
    const targetUser = await get("SELECT id FROM users WHERE id = ?", [to_user_id]);
    if (!targetUser) {
      return errorResponse("User tujuan tidak ditemukan", 404);
    }
    
    // Insert new message
    const result = await run(
      `INSERT INTO chat (from_user_id, to_user_id, message, created_at) VALUES (?, ?, ?, ?)`
      , [user.id, to_user_id, message.trim(), nowWIBForSQL()]
    );
    
    // Get the created message with user details
    const newMessage = await get(`
      SELECT 
        c.*,
        u1.name as from_user_name,
        u1.username as from_username,
        u2.name as to_user_name,
        u2.username as to_username
      FROM chat c
      LEFT JOIN users u1 ON c.from_user_id = u1.id
      LEFT JOIN users u2 ON c.to_user_id = u2.id
      WHERE c.id = ?
    `, [result.lastID]);
    
    return successResponse(newMessage, 201);
  } catch (err) {
    console.error("POST /api/chat error:", err);
    return errorResponse("Gagal mengirim pesan");
  }
}

// DELETE /api/chat - Delete message (optional)
export async function DELETE(request) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("id");
    
    if (!messageId) {
      return errorResponse("ID pesan wajib diisi", 400);
    }
    
  await ensureChatTable();
    
    // Check if message exists and user owns it
    const message = await get("SELECT * FROM chat WHERE id = ? AND from_user_id = ?", [messageId, user.id]);
    if (!message) {
      return errorResponse("Pesan tidak ditemukan atau Anda tidak memiliki akses", 404);
    }
    
    // Delete message
    await run("DELETE FROM chat WHERE id = ?", [messageId]);
    
    return successResponse({ message: "Pesan berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /api/chat error:", err);
    return errorResponse("Gagal menghapus pesan");
  }
}
