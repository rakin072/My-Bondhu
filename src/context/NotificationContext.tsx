import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getNotifications, markNotificationAsRead, syncTelegramUser, type AppNotification } from "../lib/telegram";

export interface NotificationItem {
    id: number;
    type: string;
    title: string;
    description: string;
    isRead: boolean;
    createdAt?: string;
}

interface NotificationContextProps {
    notifications: NotificationItem[];
    markAsRead: (id: number) => Promise<void>;
    refreshNotifications: () => Promise<void>;
    hasUnreadNotifications: boolean;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

const mapNotification = (item: AppNotification): NotificationItem => ({
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    isRead: item.isRead,
    createdAt: item.createdAt,
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const refreshNotifications = useCallback(async () => {
        try {
            await syncTelegramUser();
            const items = await getNotifications();
            setNotifications(items.map(mapNotification));
        } catch {
            // keep previous state
        }
    }, []);

    useEffect(() => {
        void refreshNotifications();
    }, []);

    const markAsRead = async (id: number) => {
        setNotifications((prev) =>
            prev.map((notif) => (notif.id === id ? { ...notif, isRead: true } : notif))
        );

        try {
            await markNotificationAsRead(id);
        } catch {
            // no-op
        }
    };

    const hasUnreadNotifications = useMemo(
        () => notifications.some((notif) => !notif.isRead),
        [notifications],
    );

    return (
        <NotificationContext.Provider value={{ notifications, markAsRead, refreshNotifications, hasUnreadNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};
