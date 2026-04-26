import { Bell, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";

export const Header = (): JSX.Element => {
    const navigate = useNavigate();
    const location = useLocation();
    const { hasUnreadNotifications } = useNotifications();

    const isProfile = location.pathname.startsWith("/profile");

    return (
        <header className={`flex items-center justify-between px-5 pt-6 pb-2 shrink-0 z-10 ${isProfile ? "bg-[#F3F4F6]" : "bg-white"}`}>
            <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight">MYbondhu</h1>
            {isProfile ? (
                <button
                    onClick={() => console.log("Settings clicked")}
                    className="flex items-center gap-1.5 text-[#0F172A] hover:opacity-80 transition-opacity"
                >
                    <Settings className="w-5 h-5" strokeWidth={2.5} />
                    <span className="text-[11px] font-semibold">Settings</span>
                </button>
            ) : (
                <button
                    onClick={() => navigate("/notifications")}
                    className={`w-[34px] h-[34px] rounded-full transition-colors flex items-center justify-center shadow-sm ${hasUnreadNotifications ? "bg-[#FF0000] hover:bg-red-600" : "bg-[#9CA3AF] hover:bg-[#8ca3af]"}`}
                >
                    <Bell className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
                </button>
            )}
        </header>
    );
};
