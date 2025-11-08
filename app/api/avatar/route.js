import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");
    if (!filename) return new Response("filename required", { status: 400 });

    const imgDir = path.join(process.cwd(), "database", "images", "avatar");
    const filePath = path.join(imgDir, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "application/octet-stream";

    const file = await fs.promises.readFile(filePath);
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("avatar GET error:", err);
    return new Response(String(err), { status: 500 });
  }
}
