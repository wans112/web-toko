import { NextResponse } from "next/server";
import { init, get, run } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const THEME_KEY = "theme_settings";
const DEFAULT_THEME = {
  primaryColor: "#73d13d"
};

async function ensureSettingsTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  ).catch((err) => {
    console.error("Failed ensuring app_settings table:", err);
    throw err;
  });
}

function normalizeTheme(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_THEME };
  }
  const normalized = normalizeHexColor(value.primaryColor);
  return {
    primaryColor: normalized || DEFAULT_THEME.primaryColor,
  };
}

function normalizeHexColor(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("#")) return null;
  const hex = value.toLowerCase();
  // Allow #rgb, #rrggbb, or #rrggbbaa; strip alpha if present
  if (/^#([0-9a-f]{3})$/.test(hex)) {
    return hex;
  }
  if (/^#([0-9a-f]{6})$/.test(hex)) {
    return hex;
  }
  if (/^#([0-9a-f]{8})$/.test(hex)) {
    return hex.slice(0, 7);
  }
  return null;
}

export async function GET() {
  try {
    await init();
    await ensureSettingsTable();

    const row = await get("SELECT value FROM app_settings WHERE key = ?", [THEME_KEY]);
    if (!row?.value) {
      return NextResponse.json({ success: true, data: { ...DEFAULT_THEME } });
    }

    try {
      const parsed = JSON.parse(row.value);
      return NextResponse.json({ success: true, data: normalizeTheme(parsed) });
    } catch (err) {
      console.warn("Failed to parse theme_settings JSON, returning default", err);
      return NextResponse.json({ success: true, data: { ...DEFAULT_THEME } });
    }
  } catch (error) {
    console.error("GET /api/theme error:", error);
    return NextResponse.json({ error: "Gagal mengambil tema" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    await init();
    await ensureSettingsTable();

    const user = await getCurrentUser();
    if (!user || user.role !== "superadmin") {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const normalizedColor = normalizeHexColor(body?.primaryColor);

    if (!normalizedColor) {
      return NextResponse.json({ error: "Warna tidak valid" }, { status: 400 });
    }

    const themePayload = { primaryColor: normalizedColor };
    const value = JSON.stringify(themePayload);

    await run(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [THEME_KEY, value]
    );

    return NextResponse.json({ success: true, data: themePayload });
  } catch (error) {
    console.error("PATCH /api/theme error:", error);
    return NextResponse.json({ error: "Gagal memperbarui tema" }, { status: 500 });
  }
}
