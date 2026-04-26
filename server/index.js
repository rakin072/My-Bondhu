import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.API_PORT ?? 3001);
const DB_PATH =
  process.env.SQLITE_DB_PATH ?? path.join(__dirname, "data", "mybondhu.db");
let db;

const initDatabase = async () => {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      userid TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      user_photo TEXT,
      wallet_address TEXT,
      account_creation_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      referenced_by TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      passport_photo TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

};

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mybondhu-server",
    db: DB_PATH,
    time: new Date().toISOString(),
  });
});

app.get("/api", (_req, res) => {
  res.json({ message: "Backend is running. Add your endpoints under /api." });
});

app.post("/api/users", async (req, res, next) => {
  try {
    const {
      userid,
      username,
      user_photo,
      wallet_address,
      account_creation_time,
      referenced_by,
      points,
      passport_photo,
      verification_status,
    } = req.body ?? {};

    if (!userid || !username) {
      return res.status(400).json({ error: "userid and username are required" });
    }

    const parsedPoints = points === undefined ? 0 : Number(points);
    if (!Number.isFinite(parsedPoints)) {
      return res.status(400).json({ error: "points must be a valid number" });
    }

    await db.run(
      `
      INSERT INTO users (
        userid,
        username,
        user_photo,
        wallet_address,
        account_creation_time,
        referenced_by,
        points,
        passport_photo,
        verification_status
      ) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, COALESCE(?, 'pending'))
      `,
      [
        String(userid),
        String(username),
        user_photo ?? null,
        wallet_address ?? null,
        account_creation_time ?? null,
        referenced_by ?? null,
        Math.trunc(parsedPoints),
        passport_photo ?? null,
        verification_status ?? null,
      ],
    );

    const user = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);
    return res.status(201).json({ user });
  } catch (error) {
    if (String(error?.message ?? "").includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "userid already exists" });
    }
    return next(error);
  }
});

app.get("/api/users/:userid", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const user = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/users/:userid", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const existing = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      username,
      user_photo,
      wallet_address,
      referenced_by,
      points,
      passport_photo,
      verification_status,
    } = req.body ?? {};

    const nextUsername = username ?? existing.username;
    if (!nextUsername) {
      return res.status(400).json({ error: "username cannot be empty" });
    }

    let nextPoints = existing.points;
    if (points !== undefined) {
      const parsedPoints = Number(points);
      if (!Number.isFinite(parsedPoints)) {
        return res.status(400).json({ error: "points must be a valid number" });
      }
      nextPoints = Math.trunc(parsedPoints);
    }

    await db.run(
      `
      UPDATE users
      SET
        username = ?,
        user_photo = ?,
        wallet_address = ?,
        referenced_by = ?,
        points = ?,
        passport_photo = ?,
        verification_status = ?
      WHERE userid = ?
      `,
      [
        nextUsername,
        user_photo ?? existing.user_photo,
        wallet_address ?? existing.wallet_address,
        referenced_by ?? existing.referenced_by,
        nextPoints,
        passport_photo ?? existing.passport_photo,
        verification_status ?? existing.verification_status,
        String(userid),
      ],
    );

    const user = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/users/:userid", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const result = await db.run("DELETE FROM users WHERE userid = ?", [String(userid)]);

    if ((result?.changes ?? 0) === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ success: true, userid: String(userid) });
  } catch (error) {
    return next(error);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const startServer = async () => {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`API listening on http://127.0.0.1:${PORT}`);
    console.log(`SQLite DB: ${DB_PATH}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});