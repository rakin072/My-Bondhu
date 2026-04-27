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

const DEV_TELEGRAM_ID_KEY = "mybondhu-dev-telegram-id";
const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://performs-united-highways-conference.trycloudflare.com"
).replace(/\/$/, "");
const LOCAL_STATE_KEY_PREFIX = "mybondhu-local-state";
const LOCAL_MINING_COOLDOWN_MIN = 1;
const LOCAL_MINING_REWARD = 10;

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

const apiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
};

const getTelegramUser = (): TelegramWebAppUser | null => {
  return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
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
    verificationStatus: "pending",
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

const postJson = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const patchJson = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const getJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export const syncTelegramUser = async (): Promise<void> => {
  const user = getTelegramUser();
  const telegramId = getActiveTelegramId();

  try {
    await postJson<{ user: AppUser }>(apiUrl("/api/auth/telegram"), {
      telegramId,
      username: user?.username ?? `guest_${telegramId}`,
      firstName: user?.first_name ?? "Guest",
      lastName: user?.last_name ?? "User",
    });
  } catch {
    const state = getLocalState(telegramId);
    state.user.username = user?.username ?? state.user.username;
    state.user.firstName = user?.first_name ?? state.user.firstName;
    state.user.lastName = user?.last_name ?? state.user.lastName;
    state.user.updatedAt = nowIso();
    state.profile = { ...state.profile, ...state.user };
    saveLocalState(telegramId, state);
  }
};

export const getUserProfile = async (): Promise<AppUser> => {
  const telegramId = getActiveTelegramId();
  try {
    const { user } = await getJson<{ user: AppUser }>(apiUrl(`/api/users/${telegramId}`));
    return user;
  } catch {
    return getLocalState(telegramId).user;
  }
};

export const startMiningSession = async (): Promise<MiningStatus> => {
  const telegramId = getActiveTelegramId();
  try {
    await postJson<{ session: unknown }>(apiUrl("/api/mining/start"), { telegramId });
    return getMiningStatus();
  } catch {
    const state = getLocalState(telegramId);
    const status = getLocalMiningStatus(state);
    if (!status.active) {
      state.mining.sessionId += 1;
      state.mining.startedAtMs = Date.now();
      saveLocalState(telegramId, state);
    }

    return getLocalMiningStatus(getLocalState(telegramId));
  }
};

export const getMiningStatus = async (): Promise<MiningStatus> => {
  const telegramId = getActiveTelegramId();
  try {
    return await getJson<MiningStatus>(apiUrl(`/api/mining/status/${telegramId}`));
  } catch {
    return getLocalMiningStatus(getLocalState(telegramId));
  }
};

export const claimMiningReward = async (): Promise<{ reward: number; user: AppUser }> => {
  const telegramId = getActiveTelegramId();
  try {
    return await postJson<{ reward: number; user: AppUser }>(apiUrl("/api/mining/claim/reward"), { telegramId });
  } catch {
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
    saveLocalState(telegramId, state);

    return { reward: LOCAL_MINING_REWARD, user: state.user };
  }
};

export const getTransactions = async (): Promise<AppTransaction[]> => {
  const telegramId = getActiveTelegramId();
  try {
    const { items } = await getJson<{ items: AppTransaction[] }>(apiUrl(`/api/transactions/${telegramId}`));
    return items;
  } catch {
    return getLocalState(telegramId).transactions;
  }
};

export const getProfile = async (): Promise<AppProfile> => {
  const telegramId = getActiveTelegramId();
  try {
    const { profile } = await getJson<{ profile: AppProfile }>(apiUrl(`/api/profile/${telegramId}`));
    return profile;
  } catch {
    return getLocalState(telegramId).profile;
  }
};

export const updateProfile = async (
  payload: Partial<Pick<AppProfile, "avatarUrl" | "language" | "passportStatus" | "verificationStatus">> & {
    canWithdraw?: boolean;
  },
): Promise<AppProfile> => {
  const telegramId = getActiveTelegramId();
  try {
    const { profile } = await patchJson<{ profile: AppProfile }>(apiUrl(`/api/profile/${telegramId}`), payload);
    return profile;
  } catch {
    const state = getLocalState(telegramId);
    state.profile = {
      ...state.profile,
      ...payload,
      canWithdraw: typeof payload.canWithdraw === "boolean" ? (payload.canWithdraw ? 1 : 0) : state.profile.canWithdraw,
      updatedAt: nowIso(),
    };
    saveLocalState(telegramId, state);
    return state.profile;
  }
};

export const getNotifications = async (): Promise<AppNotification[]> => {
  const telegramId = getActiveTelegramId();
  try {
    const { items } = await getJson<{ items: AppNotification[] }>(apiUrl(`/api/notifications/${telegramId}`));
    return items;
  } catch {
    return getLocalState(telegramId).notifications;
  }
};

export const markNotificationAsRead = async (notificationId: number): Promise<void> => {
  const telegramId = getActiveTelegramId();
  try {
    await patchJson<{ success: boolean }>(apiUrl(`/api/notifications/${telegramId}/${notificationId}/read`), {});
  } catch {
    const state = getLocalState(telegramId);
    state.notifications = state.notifications.map((item) =>
      item.id === notificationId ? { ...item, isRead: true } : item,
    );
    saveLocalState(telegramId, state);
  }
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
