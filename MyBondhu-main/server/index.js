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
const DB_PATH = process.env.SQLITE_DB_PATH ?? path.join(__dirname, "data", "mybondhu.db");
const MINING_COOLDOWN_MIN = Number(process.env.MINING_COOLDOWN_MIN ?? 1);
const MINING_REWARD = Number(process.env.MINING_REWARD ?? 10);

const app = express();
app.use(cors());
app.use(express.json());

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const db = await open({
  filename: DB_PATH,
  driver: sqlite3.Database,
});

await db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS mining_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'mining',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mining_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    avatar_url TEXT,
    language TEXT NOT NULL DEFAULT 'English',
    passport_status TEXT NOT NULL DEFAULT 'pending',
    verification_status TEXT NOT NULL DEFAULT 'pending',
    can_withdraw INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);
  CREATE INDEX IF NOT EXISTS idx_claims_user_id ON mining_claims (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON mining_sessions (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON mining_sessions (user_id, status);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
`);

const toTimestampMs = (value) => {
  if (!value) {
    return null;
  }

  const ts = new Date(String(value).replace(" ", "T").replace("Z", "") + "Z").getTime();
  return isNaN(ts) ? Date.now() : ts;
};

const getUserByTelegramId = async (telegramId) => {
  return db.get(
    "SELECT id, telegram_id AS telegramId, username, first_name AS firstName, last_name AS lastName, balance, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE telegram_id = ?",
    [String(telegramId)],
  );
};

const ensureUserProfile = async (userId) => {
  await db.run(
    "INSERT INTO user_profiles (user_id, updated_at) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING",
    [userId],
  );
};

const ensureDefaultNotifications = async (userId) => {
  const row = await db.get("SELECT COUNT(1) AS total FROM notifications WHERE user_id = ?", [userId]);
  if ((row?.total ?? 0) > 0) {
    return;
  }

  const defaults = [
    {
      type: "pin",
      title: "Upload Your Documents",
      description: "You need to upload your passport and selfie to withdraw money",
    },
    {
      type: "coin",
      title: "Welcome Bonus Added",
      description: "Start mining to earn your first gold coins",
    },
  ];

  for (const item of defaults) {
    await db.run(
      "INSERT INTO notifications (user_id, type, title, description, is_read) VALUES (?, ?, ?, ?, 0)",
      [userId, item.type, item.title, item.description],
    );
  }
};

app.get("/api/health", async (_req, res) => {
  const row = await db.get("SELECT datetime('now') AS now");
  res.json({ status: "ok", db: "sqlite", time: row?.now ?? null });
});

app.post("/api/auth/telegram", async (req, res) => {
  const { telegramId, username, firstName, lastName } = req.body ?? {};

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  await db.run(
    `
    INSERT INTO users (telegram_id, username, first_name, last_name, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(telegram_id)
    DO UPDATE SET
      username = COALESCE(excluded.username, users.username),
      first_name = COALESCE(excluded.first_name, users.first_name),
      last_name = COALESCE(excluded.last_name, users.last_name),
      updated_at = CURRENT_TIMESTAMP
    `,
    [String(telegramId), username ?? null, firstName ?? null, lastName ?? null],
  );

  const user = await db.get(
    "SELECT id, telegram_id AS telegramId, username, first_name AS firstName, last_name AS lastName, balance, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE telegram_id = ?",
    [String(telegramId)],
  );

  await ensureUserProfile(user.id);
  await ensureDefaultNotifications(user.id);

  return res.json({ user });
});

app.get("/api/profile/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await ensureUserProfile(user.id);

  const profile = await db.get(
    `
    SELECT
      u.id,
      u.telegram_id AS telegramId,
      u.username,
      u.first_name AS firstName,
      u.last_name AS lastName,
      u.balance,
      p.avatar_url AS avatarUrl,
      p.language,
      p.passport_status AS passportStatus,
      p.verification_status AS verificationStatus,
      p.can_withdraw AS canWithdraw,
      u.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    `,
    [user.id],
  );

  return res.json({ profile });
});

app.patch("/api/profile/:telegramId", async (req, res) => {
  const { telegramId } = req.params;
  const { avatarUrl, language, passportStatus, verificationStatus, canWithdraw } = req.body ?? {};

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await ensureUserProfile(user.id);

  await db.run(
    `
    UPDATE user_profiles
    SET
      avatar_url = COALESCE(?, avatar_url),
      language = COALESCE(?, language),
      passport_status = COALESCE(?, passport_status),
      verification_status = COALESCE(?, verification_status),
      can_withdraw = COALESCE(?, can_withdraw),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
    `,
    [
      avatarUrl ?? null,
      language ?? null,
      passportStatus ?? null,
      verificationStatus ?? null,
      typeof canWithdraw === "boolean" ? Number(canWithdraw) : null,
      user.id,
    ],
  );

  const profile = await db.get(
    `
    SELECT
      u.id,
      u.telegram_id AS telegramId,
      u.username,
      u.first_name AS firstName,
      u.last_name AS lastName,
      u.balance,
      p.avatar_url AS avatarUrl,
      p.language,
      p.passport_status AS passportStatus,
      p.verification_status AS verificationStatus,
      p.can_withdraw AS canWithdraw,
      u.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM users u
    INNER JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ?
    `,
    [user.id],
  );

  return res.json({ profile });
});

app.get("/api/notifications/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await ensureDefaultNotifications(user.id);

  const items = await db.all(
    `
    SELECT
      id,
      type,
      title,
      description,
      is_read AS isRead,
      created_at AS createdAt
    FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 100
    `,
    [user.id],
  );

  return res.json({ items: items.map((item) => ({ ...item, isRead: Boolean(item.isRead) })) });
});

app.patch("/api/notifications/:telegramId/:notificationId/read", async (req, res) => {
  const { telegramId, notificationId } = req.params;

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await db.run(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
    [Number(notificationId), user.id],
  );

  return res.json({ success: true });
});

app.get("/api/users/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user });
});

app.post("/api/mining/start", async (req, res) => {
  const { telegramId } = req.body ?? {};

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found. Authenticate first." });
  }

  const activeSession = await db.get(
    "SELECT id FROM mining_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [user.id],
  );

  if (activeSession) {
    return res.status(409).json({ error: "Mining is already active" });
  }

  await db.run("INSERT INTO mining_sessions (user_id, status) VALUES (?, 'active')", [user.id]);

  const session = await db.get(
    "SELECT id, started_at AS startedAt, claimed_at AS claimedAt, status FROM mining_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [user.id],
  );

  return res.json({ session });
});

app.post("/api/testing/reset-mining", async (req, res) => {
  const { telegramId } = req.body ?? {};

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const result = await db.run(
    "UPDATE mining_sessions SET status = 'reset', claimed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'active'",
    [user.id],
  );

  return res.json({
    success: true,
    resetCount: result?.changes ?? 0,
    message: "Active mining sessions cleared",
  });
});

app.get("/api/mining/status/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const session = await db.get(
    "SELECT id, started_at AS startedAt, claimed_at AS claimedAt, status FROM mining_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [user.id],
  );

  if (!session) {
    return res.json({ active: false, canClaim: false, remainingMin: 0 });
  }

  const startedAtMs = toTimestampMs(session.startedAt);
  const elapsedMin = Math.floor((Date.now() - startedAtMs) / 60000);
  const remainingMin = Math.max(0, MINING_COOLDOWN_MIN - elapsedMin);

  return res.json({
    active: true,
    canClaim: remainingMin === 0,
    remainingMin,
    session,
  });
});

app.post("/api/mining/claim/reward", async (req, res) => {
  const { telegramId } = req.body ?? {};

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  const user = await getUserByTelegramId(telegramId);
  if (!user) {
    return res.status(404).json({ error: "User not found. Authenticate first." });
  }

  const session = await db.get(
    "SELECT id, started_at AS startedAt FROM mining_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",
    [user.id],
  );

  if (!session) {
    return res.status(404).json({ error: "No active mining session" });
  }

  const startedAtMs = toTimestampMs(session.startedAt);
  const elapsedMin = Math.floor((Date.now() - startedAtMs) / 60000);

  if (elapsedMin < MINING_COOLDOWN_MIN) {
    return res.status(400).json({
      error: "Too early to claim",
      remainingMin: MINING_COOLDOWN_MIN - elapsedMin,
    });
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run(
      "UPDATE mining_sessions SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [session.id],
    );
    await db.run(
      "INSERT INTO mining_claims (user_id, amount, source) VALUES (?, ?, 'mining-reward')",
      [user.id, MINING_REWARD],
    );
    await db.run(
      "INSERT INTO transactions (user_id, type, amount, note) VALUES (?, 'mining_reward', ?, 'Mining reward claim')",
      [user.id, MINING_REWARD],
    );
    await db.run("UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      MINING_REWARD,
      user.id,
    ]);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  const updatedUser = await getUserByTelegramId(telegramId);
  return res.json({ reward: MINING_REWARD, user: updatedUser });
});

app.post("/api/mining/claim", async (req, res) => {
  const { telegramId, amount } = req.body ?? {};
  const claimAmount = Number(amount ?? 0);

  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }

  if (!Number.isFinite(claimAmount) || claimAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const user = await db.get("SELECT id, balance FROM users WHERE telegram_id = ?", [String(telegramId)]);

  if (!user) {
    return res.status(404).json({ error: "User not found. Authenticate first." });
  }

  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run("INSERT INTO mining_claims (user_id, amount, source) VALUES (?, ?, 'mining')", [user.id, claimAmount]);
    await db.run(
      "INSERT INTO transactions (user_id, type, amount, note) VALUES (?, 'manual_claim', ?, 'Manual mining claim')",
      [user.id, claimAmount],
    );
    await db.run("UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [claimAmount, user.id]);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  const updated = await db.get(
    "SELECT id, telegram_id AS telegramId, username, first_name AS firstName, last_name AS lastName, balance, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?",
    [user.id],
  );

  return res.json({ user: updated });
});

app.get("/api/transactions/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [telegramId]);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const items = await db.all(
    "SELECT id, type, amount, note, created_at AS createdAt FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100",
    [user.id],
  );

  return res.json({ items });
});

app.get("/api/mining/history/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [telegramId]);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const items = await db.all(
    "SELECT id, amount, source, created_at AS createdAt FROM mining_claims WHERE user_id = ? ORDER BY id DESC LIMIT 100",
    [user.id],
  );

  return res.json({ items });
});

app.use((err, _req, res, _next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`API listening on http://127.0.0.1:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});
