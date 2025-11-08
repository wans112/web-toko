import { init, get, run } from "@/lib/db";
import { convertToWebp } from "@/lib/module/ConvertToWebp";
import fs from "fs";
import path from "path";

// Dummy: get user id from query param (replace with session/cookie in production)
export async function GET(req) {
	await init();
	try {
		const url = new URL(req.url);
		const id = url.searchParams.get("id") || 1; // default user id 1
		// join avatar
		const row = await get(
			`SELECT u.id, u.name, u.username, u.role, u.no_hp, a.image_path as avatar FROM users u LEFT JOIN avatar a ON u.id = a.user_id WHERE u.id = ?`,
			[id]
		);
				if (!row) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

				// Verify avatar file exists and normalize via path.join
				if (row.avatar) {
					const avatarPath = path.join(process.cwd(), "database", "images", "avatar", path.basename(row.avatar));
					try {
						if (!fs.existsSync(avatarPath)) {
							// avatar file missing on disk -> hide avatar field
							row.avatar = null;
						}
					} catch (e) {
						// If any fs error, hide avatar to avoid broken references
						row.avatar = null;
					}
				}

				return new Response(JSON.stringify(row), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
}

export async function PUT(req) {
	await init();
	try {
		const body = await req.json();
		const { id, name, username, password, no_hp, avatar_base64 } = body || {};
		if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400 });

			// Cek username unik jika ingin update username
			if (username !== undefined) {
				const existing = await get("SELECT id FROM users WHERE username = ? AND id != ?", [username, id]);
				if (existing) {
					return new Response(JSON.stringify({ error: "Username sudah digunakan" }), { status: 400 });
				}
			}

			// Update user fields
			const fields = [];
			const params = [];
			if (name !== undefined) { fields.push("name = ?"); params.push(name); }
			if (username !== undefined) { fields.push("username = ?"); params.push(username); }
			if (password !== undefined) { fields.push("password = ?"); params.push(password); }
			if (no_hp !== undefined) { fields.push("no_hp = ?"); params.push(no_hp); }
			if (fields.length) {
				params.push(id);
				await run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
			}

		// Handle avatar upload (base64)
		if (avatar_base64) {
			// Convert base64 to Buffer
			const buffer = Buffer.from(avatar_base64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, ""), "base64");
			const pathModule = require("path");
			const imgDir = pathModule.join(process.cwd(), "database", "images", "avatar");
			const filenameBase = `avatar_${id}`;
			// Convert to webp
			const webpPath = await convertToWebp(buffer, imgDir, filenameBase);
			// update avatar table (store only filename)
			await run(`INSERT OR REPLACE INTO avatar (user_id, image_path) VALUES (?, ?)`, [id, pathModule.basename(webpPath)]);
		}

		// Return updated profile
		const updated = await get(
			`SELECT u.id, u.name, u.username, u.role, u.no_hp, a.image_path as avatar FROM users u LEFT JOIN avatar a ON u.id = a.user_id WHERE u.id = ?`,
			[id]
		);
		return new Response(JSON.stringify(updated), { status: 200 });
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
}
