import { init, get, all, run } from "@/lib/db";
import { convertToWebp } from "@/lib/module/ConvertToWebp";
import fs from "fs";
import path from "path";

// GET: list brands or get by ?id=
export async function GET(req) {
	await init();
	try {
		const url = new URL(req.url);
		const id = url.searchParams.get("id");
		if (id) {
			const row = await get("SELECT id, name, logo FROM brands WHERE id = ?", [id]);
			if (!row) return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404 });

			// verify logo exists
			if (row.logo) {
				const logoPath = path.join(process.cwd(), "database", "images", "brand", path.basename(row.logo));
				try {
					if (!fs.existsSync(logoPath)) row.logo = null;
				} catch (e) {
					row.logo = null;
				}
			}

			return new Response(JSON.stringify(row), { status: 200 });
		}

		const rows = await all("SELECT id, name, logo FROM brands ORDER BY id ASC");
		// sanitize logos
		const sanitized = rows.map(r => {
			if (r.logo) {
				const logoPath = path.join(process.cwd(), "database", "images", "brand", path.basename(r.logo));
				try {
					if (!fs.existsSync(logoPath)) r.logo = null;
				} catch (e) {
					r.logo = null;
				}
			}
			return r;
		});
		return new Response(JSON.stringify(sanitized), { status: 200 });
	} catch (err) {
		console.error("brands GET error:", err);
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
}

// PUT: update brand (name and/or logo_base64)
export async function PUT(req) {
	await init();
	try {
		const body = await req.json();
		const { id, name, logo_base64 } = body || {};
		if (!id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400 });

		// Ensure brand exists
		const existing = await get("SELECT id FROM brands WHERE id = ?", [id]);
		if (!existing) return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404 });

		const fields = [];
		const params = [];
		if (name !== undefined) {
			fields.push("name = ?");
			params.push(name);
		}

		// If there are fields to update, run update
		if (fields.length) {
			params.push(id);
			await run(`UPDATE brands SET ${fields.join(", ")} WHERE id = ?`, params);
		}

		// Handle logo upload (base64)
			if (logo_base64) {
				// Delete previous logo file if present
				try {
					const row = await get("SELECT logo FROM brands WHERE id = ?", [id]);
					if (row && row.logo) {
						const prevPath = path.join(process.cwd(), "database", "images", "brand", path.basename(row.logo));
						try {
							if (fs.existsSync(prevPath)) {
								fs.unlinkSync(prevPath);
							}
						} catch (e) {
							console.warn('Failed to delete previous brand logo', prevPath, e);
						}
					}
				} catch (e) {
					// ignore
				}

				const buffer = Buffer.from(logo_base64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, ""), "base64");
				const imgDir = path.join(process.cwd(), "database", "images", "brand");
				const filenameBase = `brand_${id}`;
				const webpPath = await convertToWebp(buffer, imgDir, filenameBase);
				const logoFilename = path.basename(webpPath);
				await run(`UPDATE brands SET logo = ? WHERE id = ?`, [logoFilename, id]);
			}

		const updated = await get("SELECT id, name, logo FROM brands WHERE id = ?", [id]);
		return new Response(JSON.stringify({ success: true, data: updated }), { status: 200 });
	} catch (err) {
		console.error("brands PUT error:", err);
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
}

