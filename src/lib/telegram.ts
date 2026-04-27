type TelegramInitResult = {
  isTelegram: boolean;
  initData: string;
  userId: number | null;
};

export type AppUser = {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type MiningStatus = {
  active: boolean;
  canClaim: boolean;
  remainingMin: number;
  session?: {
    id: number;
    startedAt: string;
    claimedAt: string | null;
    status: string;
  };
};

export type AppTransaction = {
  id: number;
  type: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

export type AppProfile = AppUser & {
  avatarUrl: string | null;
  language: "Bangla" | "English";
  passportStatus: string;
  verificationStatus: string;
  canWithdraw: number;
};

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
};

export type LeaderboardPlayer = {
  userid: string;
  username: string;
  user_photo: string | null;
  points: number;
  rank: number;
};

const DEV_TELEGRAM_ID_KEY = "mybondhu-dev-telegram-id";
const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://performs-united-highways-conference.trycloudflare.com"
).replace(/\/$/, "");
const LOCAL_STATE_KEY_PREFIX = "mybondhu-local-state";
const LOCAL_MINING_COOLDOWN_MIN = 1;
const LOCAL_MINING_REWARD = 10;
const DOCUMENT_NOTIFICATION_ID = 1;
const SYNC_COOLDOWN_MS = 15000;
let syncInFlight: Promise<void> | null = null;
let lastSyncAt = 0;
let lastSyncedTelegramId: string | null = null;

type ApiUser = {
  userid: string;
  username: string;
  user_photo: string | null;
  wallet_address: string | null;
  account_creation_time: string;
  referenced_by: string | null;
  points: number;
  passport_photo: string | null;
  verification_status: string;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type LocalState = {
  user: AppUser;
  profile: AppProfile;
  notifications: AppNotification[];
  transactions: AppTransaction[];
  mining: {
    sessionId: number;
    startedAtMs: number | null;
  };
};

const syncDocumentNotification = (state: LocalState): void => {
  const needsDocumentUpload = state.profile.passportStatus !== "uploaded";
  const existingIndex = state.notifications.findIndex((item) => item.id === DOCUMENT_NOTIFICATION_ID);

  if (!needsDocumentUpload) {
    if (existingIndex >= 0) {
      state.notifications.splice(existingIndex, 1);
    }
    return;
  }

  if (existingIndex >= 0) {
    state.notifications[existingIndex] = {
      ...state.notifications[existingIndex],
      isRead: false,
    };
    return;
  }

  state.notifications.unshift({
    id: DOCUMENT_NOTIFICATION_ID,
    type: "pin",
    title: "Upload Your Documents",
    description: "You need to upload your passport and selfie to withdraw money",
    isRead: false,
    createdAt: nowIso(),
  });
};

const getTelegramUser = (): TelegramWebAppUser | null => {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
};

const apiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
};

const parseTimestamp = (value: string | undefined): string => {
  if (!value) {
    return nowIso();
  }

  return String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
};

const splitName = (username: string | null | undefined): { firstName: string | null; lastName: string | null } => {
  if (!username) {
    return { firstName: null, lastName: null };
  }

  const [firstName, ...rest] = username.trim().split(/\s+/);
  const lastName = rest.length > 0 ? rest.join(" ") : null;
  return { firstName: firstName || null, lastName };
};

const mapApiUserToAppUser = (apiUser: ApiUser): AppUser => {
  const names = splitName(apiUser.username);
  const createdAt = parseTimestamp(apiUser.account_creation_time);

  return {
    id: Number(apiUser.userid) || 1,
    telegramId: apiUser.userid,
    username: apiUser.username,
    firstName: names.firstName,
    lastName: names.lastName,
    balance: Number(apiUser.points) || 0,
    createdAt,
    updatedAt: createdAt,
  };
};

const mapApiUserToProfile = (apiUser: ApiUser, language: "Bangla" | "English"): AppProfile => {
  const user = mapApiUserToAppUser(apiUser);
  return {
    ...user,
    avatarUrl: apiUser.user_photo,
    language,
    passportStatus: apiUser.passport_photo ? "uploaded" : "pending",
    verificationStatus: apiUser.verification_status ?? "inactive",
    canWithdraw: apiUser.verification_status === "verified" ? 1 : 0,
  };
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, data?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const fetchBackendUser = async (telegramId: string): Promise<ApiUser> => {
  const result = await requestJson<{ user: ApiUser }>(apiUrl(`/api/users/${telegramId}`));
  return result.user;
};

const createBackendUser = async (telegramId: string, user: TelegramWebAppUser | null): Promise<ApiUser> => {
  const username = user?.username ?? `${user?.first_name ?? "guest"}_${telegramId}`;
  const result = await requestJson<{ user: ApiUser }>(apiUrl("/api/users"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userid: telegramId,
      username,
      user_photo: user?.photo_url ?? null,
      verification_status: "inactive",
      points: 0,
    }),
  });
  return result.user;
};

const updateBackendUser = async (
  telegramId: string,
  payload: Partial<{
    username: string;
    user_photo: string | null;
    wallet_address: string | null;
    referenced_by: string | null;
    points: number;
    passport_photo: string | null;
    verification_status: string;
  }>,
): Promise<ApiUser> => {
  const result = await requestJson<{ user: ApiUser }>(apiUrl(`/api/users/${telegramId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return result.user;
};

const getDevTelegramId = (): string => {
  const stored = window.localStorage.getItem(DEV_TELEGRAM_ID_KEY);
  if (stored) {
    return stored;
  }

  const generated = "9990001";
  window.localStorage.setItem(DEV_TELEGRAM_ID_KEY, generated);
  return generated;
};

export const getActiveTelegramId = (): string => {
  const user = getTelegramUser();
  if (user?.id) {
    return String(user.id);
  }

  return getDevTelegramId();
};

const localStateKey = (telegramId: string): string => `${LOCAL_STATE_KEY_PREFIX}:${telegramId}`;

const nowIso = (): string => new Date().toISOString();

const createDefaultLocalState = (telegramId: string): LocalState => {
  const createdAt = nowIso();
  const fallbackName = `guest_${telegramId}`;

  const user: AppUser = {
    id: Number(telegramId) || 1,
    telegramId,
    username: fallbackName,
    firstName: "Guest",
    lastName: "User",
    balance: 0,
    createdAt,
    updatedAt: createdAt,
  };

  const profile: AppProfile = {
    ...user,
    avatarUrl: null,
    language: "English",
    passportStatus: "pending",
    verificationStatus: "inactive",
    canWithdraw: 0,
  };

  return {
    user,
    profile,
    notifications: [
      {
        id: 1,
        type: "pin",
        title: "Upload Your Documents",
        description: "You need to upload your passport and selfie to withdraw money",
        isRead: false,
        createdAt,
      },
      {
        id: 2,
        type: "coin",
        title: "Welcome Bonus Added",
        description: "Start mining to earn your first gold coins",
        isRead: false,
        createdAt,
      },
    ],
    transactions: [],
    mining: {
      sessionId: 0,
      startedAtMs: null,
    },
  };
};

const getLocalState = (telegramId: string): LocalState => {
  const key = localStateKey(telegramId);
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    const initial = createDefaultLocalState(telegramId);
    window.localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(raw) as LocalState;
  } catch {
    const reset = createDefaultLocalState(telegramId);
    window.localStorage.setItem(key, JSON.stringify(reset));
    return reset;
  }
};

const saveLocalState = (telegramId: string, state: LocalState): void => {
  window.localStorage.setItem(localStateKey(telegramId), JSON.stringify(state));
};

const getLocalMiningStatus = (state: LocalState): MiningStatus => {
  const startedAtMs = state.mining.startedAtMs;
  if (!startedAtMs) {
    return { active: false, canClaim: false, remainingMin: 0 };
  }

  const cooldownSec = LOCAL_MINING_COOLDOWN_MIN * 60;
  const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
  const remainingSec = Math.max(0, cooldownSec - elapsedSec);
  const canClaim = remainingSec === 0;

  return {
    active: true,
    canClaim,
    remainingMin: Math.ceil(remainingSec / 60),
    session: {
      id: state.mining.sessionId,
      startedAt: new Date(startedAtMs).toISOString(),
      claimedAt: null,
      status: canClaim ? "completed" : "active",
    },
  };
};

const performSyncTelegramUser = async (telegramId: string): Promise<void> => {
  const user = getTelegramUser();
  const state = getLocalState(telegramId);

  try {
    let backendUser: ApiUser;

    try {
      backendUser = await fetchBackendUser(telegramId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        backendUser = await createBackendUser(telegramId, user);
      } else {
        throw error;
      }
    }

    if (user?.username && user.username !== backendUser.username) {
      backendUser = await updateBackendUser(telegramId, { username: user.username });
    }

    const language = state.profile.language ?? "English";
    state.user = mapApiUserToAppUser(backendUser);
    state.profile = {
      ...mapApiUserToProfile(backendUser, language),
      language,
    };
    syncDocumentNotification(state);
    saveLocalState(telegramId, state);
    return;
  } catch {
    state.user.username = user?.username ?? state.user.username;
    state.user.firstName = user?.first_name ?? state.user.firstName;
    state.user.lastName = user?.last_name ?? state.user.lastName;
    state.user.updatedAt = nowIso();
    state.profile = { ...state.profile, ...state.user };
    syncDocumentNotification(state);
    saveLocalState(telegramId, state);
  }
};

export const syncTelegramUser = async (): Promise<void> => {
  const telegramId = getActiveTelegramId();
  const now = Date.now();

  if (
    !syncInFlight &&
    lastSyncedTelegramId === telegramId &&
    now - lastSyncAt < SYNC_COOLDOWN_MS
  ) {
    return;
  }

  if (!syncInFlight) {
    syncInFlight = (async () => {
      try {
        await performSyncTelegramUser(telegramId);
        lastSyncAt = Date.now();
        lastSyncedTelegramId = telegramId;
      } finally {
        syncInFlight = null;
      }
    })();
  }

  await syncInFlight;
};

export const getUserProfile = async (): Promise<AppUser> => {
  const telegramId = getActiveTelegramId();
  const state = getLocalState(telegramId);

  try {
    const backendUser = await fetchBackendUser(telegramId);
    const mapped = mapApiUserToAppUser(backendUser);
    state.user = mapped;
    saveLocalState(telegramId, state);
    return mapped;
  } catch {
    return state.user;
  }
};

export const startMiningSession = async (): Promise<MiningStatus> => {
  const telegramId = getActiveTelegramId();

  const state = getLocalState(telegramId);
  const status = getLocalMiningStatus(state);
  if (!status.active) {
    state.mining.sessionId += 1;
    state.mining.startedAtMs = Date.now();
    saveLocalState(telegramId, state);
  }

  return getLocalMiningStatus(getLocalState(telegramId));
};

export const getMiningStatus = async (): Promise<MiningStatus> => {
  return getLocalMiningStatus(getLocalState(getActiveTelegramId()));
};

export const claimMiningReward = async (): Promise<{ reward: number; user: AppUser }> => {
  const telegramId = getActiveTelegramId();

  const state = getLocalState(telegramId);
  const status = getLocalMiningStatus(state);
  if (!status.active || !status.canClaim) {
    throw new Error("Reward is not ready yet");
  }

  state.user.balance += LOCAL_MINING_REWARD;
  state.user.updatedAt = nowIso();
  state.profile.balance = state.user.balance;
  state.profile.updatedAt = state.user.updatedAt;

  state.transactions = [
    {
      id: state.transactions.length + 1,
      type: "mining",
      amount: LOCAL_MINING_REWARD,
      note: "Mining reward",
      createdAt: nowIso(),
    },
    ...state.transactions,
  ];

  state.mining.startedAtMs = null;
  try {
    const backendUser = await updateBackendUser(telegramId, { points: state.user.balance });
    state.user = mapApiUserToAppUser(backendUser);
    state.profile = {
      ...state.profile,
      ...mapApiUserToProfile(backendUser, state.profile.language),
      language: state.profile.language,
    };
  } catch {
    // Keep local-only update when backend is unavailable.
  }

  saveLocalState(telegramId, state);

  return { reward: LOCAL_MINING_REWARD, user: state.user };
};

export const getTransactions = async (): Promise<AppTransaction[]> => {
  return getLocalState(getActiveTelegramId()).transactions;
};

export const getProfile = async (): Promise<AppProfile> => {
  const telegramId = getActiveTelegramId();
  const state = getLocalState(telegramId);

  try {
    const backendUser = await fetchBackendUser(telegramId);
    const profile = {
      ...mapApiUserToProfile(backendUser, state.profile.language),
      language: state.profile.language,
    };
    state.profile = profile;
    state.user = mapApiUserToAppUser(backendUser);
    syncDocumentNotification(state);
    saveLocalState(telegramId, state);
    return profile;
  } catch {
    syncDocumentNotification(state);
    saveLocalState(telegramId, state);
    return state.profile;
  }
};

export const updateProfile = async (
  payload: Partial<Pick<AppProfile, "avatarUrl" | "language" | "passportStatus" | "verificationStatus">> & {
    passportPhoto?: string | null;
    canWithdraw?: boolean;
  },
): Promise<AppProfile> => {
  const telegramId = getActiveTelegramId();
  const state = getLocalState(telegramId);
  state.profile = {
    ...state.profile,
    ...payload,
    canWithdraw: typeof payload.canWithdraw === "boolean" ? (payload.canWithdraw ? 1 : 0) : state.profile.canWithdraw,
    updatedAt: nowIso(),
  };

  try {
    const backendPayload: Parameters<typeof updateBackendUser>[1] = {
      user_photo: payload.avatarUrl ?? state.profile.avatarUrl,
      passport_photo: payload.passportPhoto,
      verification_status: payload.verificationStatus ?? state.profile.verificationStatus,
    };

    const backendUser = await updateBackendUser(telegramId, backendPayload);
    state.user = mapApiUserToAppUser(backendUser);
    state.profile = {
      ...state.profile,
      ...mapApiUserToProfile(backendUser, state.profile.language),
      language: state.profile.language,
    };
  } catch {
    // Keep local-only profile update when backend is unavailable.
  }

  syncDocumentNotification(state);
  saveLocalState(telegramId, state);
  return state.profile;
};

export const getNotifications = async (): Promise<AppNotification[]> => {
  return getLocalState(getActiveTelegramId()).notifications;
};

export const getLeaderboard = async (limit = 20): Promise<{ players: LeaderboardPlayer[]; me: LeaderboardPlayer | null }> => {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const telegramId = getActiveTelegramId();
  const params = new URLSearchParams({
    limit: String(safeLimit),
    userid: telegramId,
  });
  const result = await requestJson<{ players: LeaderboardPlayer[]; me: LeaderboardPlayer | null }>(
    apiUrl(`/api/leaderboard?${params.toString()}`),
  );
  return {
    players: result.players ?? [],
    me: result.me ?? null,
  };
};

export const markNotificationAsRead = async (notificationId: number): Promise<void> => {
  const telegramId = getActiveTelegramId();
  const state = getLocalState(telegramId);
  state.notifications = state.notifications.map((item) =>
    item.id === notificationId ? { ...item, isRead: true } : item,
  );
  saveLocalState(telegramId, state);
};

const applyTelegramTheme = (themeParams: TelegramThemeParams): void => {
  const root = document.documentElement;

  if (themeParams.bg_color) {
    root.style.setProperty("--tg-theme-bg-color", themeParams.bg_color);
  }

  if (themeParams.text_color) {
    root.style.setProperty("--tg-theme-text-color", themeParams.text_color);
  }

  if (themeParams.button_color) {
    root.style.setProperty("--tg-theme-button-color", themeParams.button_color);
  }

  if (themeParams.button_text_color) {
    root.style.setProperty("--tg-theme-button-text-color", themeParams.button_text_color);
  }
};

export const initTelegramWebApp = (): TelegramInitResult => {
  const webApp = window.Telegram?.WebApp;

  if (!webApp) {
    void syncTelegramUser();
    return {
      isTelegram: false,
      initData: "",
      userId: null,
    };
  }

  webApp.ready();

  if (!webApp.isExpanded) {
    webApp.expand();
  }

  applyTelegramTheme(webApp.themeParams);

  if (webApp.themeParams.bg_color) {
    webApp.setBackgroundColor?.(webApp.themeParams.bg_color);
  }

  if (webApp.themeParams.secondary_bg_color) {
    webApp.setHeaderColor?.(webApp.themeParams.secondary_bg_color);
  }

  document.documentElement.setAttribute("data-telegram-platform", webApp.platform);
  void syncTelegramUser();

  return {
    isTelegram: true,
    initData: webApp.initData,
    userId: webApp.initDataUnsafe?.user?.id ?? null,
  };
};
