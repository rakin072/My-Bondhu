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

const MINING_CONFIG_PATH =
  process.env.MINING_CONFIG_PATH ?? path.join(__dirname, "data", "mining-config.json");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

const clampInt = (value, { min, max, fallback }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  return Math.min(max, Math.max(min, t));
};

const loadMiningConfig = () => {
  const defaults = {
    duration_sec: 60,
    reward_points: 10,
    updated_at_unix: 0,
  };

  try {
    if (!fs.existsSync(MINING_CONFIG_PATH)) {
      fs.mkdirSync(path.dirname(MINING_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(MINING_CONFIG_PATH, JSON.stringify(defaults, null, 2), "utf8");
      return defaults;
    }

    const raw = fs.readFileSync(MINING_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      duration_sec: clampInt(parsed?.duration_sec, { min: 1, max: 86400, fallback: defaults.duration_sec }),
      reward_points: clampInt(parsed?.reward_points, { min: 0, max: 1_000_000, fallback: defaults.reward_points }),
      updated_at_unix: clampInt(parsed?.updated_at_unix, { min: 0, max: 4_102_444_800, fallback: defaults.updated_at_unix }),
    };
  } catch {
    return defaults;
  }
};

const saveMiningConfig = (next) => {
  fs.mkdirSync(path.dirname(MINING_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(MINING_CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
};

const toUnixSec = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return Math.trunc(asNumber);

  const parsedMs = Date.parse(String(value));
  if (Number.isFinite(parsedMs)) return Math.trunc(parsedMs / 1000);

  return null;
};

const ensureUserMiningCompletion = async (userid) => {
  const user = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);
  if (!user) return null;

  if (user.mining_status !== "active" || !user.mining_end_time) {
    return user;
  }

  const endSec = toUnixSec(user.mining_end_time);
  if (!Number.isFinite(Number(endSec))) {
    return user;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= endSec) {
    await db.run(
      "UPDATE users SET mining_status = 'completed' WHERE userid = ? AND mining_status = 'active'",
      [String(userid)],
    );
    return await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);
  }

  return user;
};

const migrateUsersTable = async () => {
  const columns = await db.all("PRAGMA table_info(users)");
  const existing = new Set(columns.map((col) => String(col.name)));

  if (!existing.has("mining_start_time")) {
    await db.exec("ALTER TABLE users ADD COLUMN mining_start_time INTEGER");
  }

  if (!existing.has("mining_end_time")) {
    await db.exec("ALTER TABLE users ADD COLUMN mining_end_time INTEGER");
  }

  if (!existing.has("mining_status")) {
    await db.exec(
      "ALTER TABLE users ADD COLUMN mining_status TEXT NOT NULL DEFAULT 'idle' CHECK (mining_status IN ('idle','active','completed'))",
    );
  }

  // Backfill any older ISO-string timestamps to unix seconds.
  const legacy = await db.all(
    `
    SELECT userid, mining_start_time, mining_end_time
    FROM users
    WHERE
      (mining_start_time IS NOT NULL AND typeof(mining_start_time) = 'text')
      OR (mining_end_time IS NOT NULL AND typeof(mining_end_time) = 'text')
    `,
  );

  for (const row of legacy) {
    const startSec = toUnixSec(row.mining_start_time);
    const endSec = toUnixSec(row.mining_end_time);
    await db.run(
      `
      UPDATE users
      SET mining_start_time = COALESCE(?, mining_start_time),
          mining_end_time = COALESCE(?, mining_end_time)
      WHERE userid = ?
      `,
      [startSec, endSec, String(row.userid)],
    );
  }
};

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
      verification_status TEXT NOT NULL DEFAULT 'inactive',
      mining_start_time INTEGER,
      mining_end_time INTEGER,
      mining_status TEXT NOT NULL DEFAULT 'idle' CHECK (mining_status IN ('idle','active','completed'))
    );
  `);

  await migrateUsersTable();
};

const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));

// Avoid cached API responses (prevents 304s in clients).
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const requireAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: "Admin token not configured" });
  }
  const auth = String(req.headers.authorization ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
};

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
      ) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, COALESCE(?, 'inactive'))
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
    const user = await ensureUserMiningCompletion(userid);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/users/:userid/mining", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const user = await ensureUserMiningCompletion(userid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const config = loadMiningConfig();
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = toUnixSec(user.mining_start_time);
    const endSec = toUnixSec(user.mining_end_time);
    const remainingSec =
      user.mining_status === "active" && Number.isFinite(endSec)
        ? Math.max(0, Math.trunc(endSec - nowSec))
        : 0;

    return res.json({
      mining: {
        mining_start_time: startSec,
        mining_end_time: endSec,
        mining_status: user.mining_status ?? "idle",
        remaining_sec: remainingSec,
        reward_points: config.reward_points,
        duration_sec: config.duration_sec,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/users/:userid/mine", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const user = await ensureUserMiningCompletion(userid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.mining_status === "active") {
      return res.status(409).json({ error: "Already mining" });
    }

    if (user.mining_status === "completed") {
      return res.status(409).json({ error: "Please claim first" });
    }

    const config = loadMiningConfig();
    const startSec = Math.floor(Date.now() / 1000);
    const endSec = startSec + Math.max(1, Math.trunc(config.duration_sec));

    await db.run(
      `
      UPDATE users
      SET
        mining_start_time = ?,
        mining_end_time = ?,
        mining_status = 'active'
      WHERE userid = ?
      `,
      [startSec, endSec, String(userid)],
    );

    return res.status(201).json({
      mining: {
        mining_start_time: startSec,
        mining_end_time: endSec,
        mining_status: "active",
        remaining_sec: Math.max(1, Math.trunc(config.duration_sec)),
        reward_points: config.reward_points,
        duration_sec: config.duration_sec,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/users/:userid/claim", async (req, res, next) => {
  try {
    const { userid } = req.params;
    const user = await ensureUserMiningCompletion(userid);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.mining_status !== "completed") {
      return res.status(409).json({ error: "Reward is not ready yet" });
    }

    const config = loadMiningConfig();
    const nextPoints = Math.trunc(Number(user.points ?? 0) + config.reward_points);

    await db.run(
      `
      UPDATE users
      SET
        points = ?,
        mining_status = 'idle',
        mining_start_time = NULL,
        mining_end_time = NULL
      WHERE userid = ? AND mining_status = 'completed'
      `,
      [nextPoints, String(userid)],
    );

    const updated = await db.get("SELECT * FROM users WHERE userid = ?", [String(userid)]);
    return res.json({
      reward: config.reward_points,
      user: updated,
      mining: {
        mining_start_time: null,
        mining_end_time: null,
        mining_status: "idle",
        remaining_sec: 0,
        reward_points: config.reward_points,
        duration_sec: config.duration_sec,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/mining-config", requireAdmin, (_req, res) => {
  return res.json({ config: loadMiningConfig() });
});

app.put("/api/admin/mining-config", requireAdmin, (req, res) => {
  const current = loadMiningConfig();
  const body = req.body ?? {};
  const next = {
    duration_sec: clampInt(body?.duration_sec ?? current.duration_sec, { min: 1, max: 86400, fallback: current.duration_sec }),
    reward_points: clampInt(body?.reward_points ?? current.reward_points, { min: 0, max: 1_000_000, fallback: current.reward_points }),
    updated_at_unix: Math.floor(Date.now() / 1000),
  };
  saveMiningConfig(next);
  return res.json({ config: next });
});

app.get("/api/leaderboard", async (req, res, next) => {
  try {
    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 20;
    const { userid } = req.query;

    const players = await db.all(
      `
      SELECT
        userid,
        username,
        user_photo,
        points,
        ROW_NUMBER() OVER (ORDER BY points DESC, account_creation_time ASC, userid ASC) AS rank
      FROM users
      ORDER BY points DESC, account_creation_time ASC, userid ASC
      LIMIT ?
      `,
      [limit],
    );

    let me = null;
    if (userid) {
      me = await db.get(
        `
        SELECT
          userid,
          username,
          user_photo,
          points,
          rank
        FROM (
          SELECT
            userid,
            username,
            user_photo,
            points,
            ROW_NUMBER() OVER (ORDER BY points DESC, account_creation_time ASC, userid ASC) AS rank
          FROM users
        ) ranked
        WHERE userid = ?
        `,
        [String(userid)],
      );
    }

    return res.json({
      players,
      me,
      total: players.length,
    });
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
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Uploaded image is too large. Please use a smaller photo." });
  }
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