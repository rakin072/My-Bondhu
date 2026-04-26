import { Users2, Gamepad, Home as HomeIcon, Trophy as TrophyIcon, User as UserIcon, Wallet as WalletIcon, Share2 as ReferIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export const Navigation = (): JSX.Element => {
    const location = useLocation();
    const navigate = useNavigate();

    const navigationItems = [
        { icon: HomeIcon, label: "Home", path: "/home" },
        { icon: WalletIcon, label: "Wallet", path: "/wallet" },
        { icon: Users2, label: "Friends", path: "/rank" },
        { icon: UserIcon, label: "Profile", path: "/profile" },
        { icon: Gamepad, label: "Games", path: "/games" },
    ];

    return (
        <div className="absolute bottom-6 left-4 right-4 z-50">
            <nav className="flex items-center justify-around bg-white py-3 px-2 rounded-[36px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100">
                {navigationItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);
                    // Setting specific stroke and fill settings for icons to match design
                    const isRefer = item.label === "Refer";
                    const isFilled = isActive && !isRefer;
                    return (
                        <button
                            key={index}
                            onClick={() => navigate(item.path)}
                            className="flex flex-col items-center justify-center gap-[2px] min-w-0 flex-1"
                        >
                            <Icon
                                fill={isFilled ? "currentColor" : "none"}
                                strokeWidth={isRefer ? 2.5 : (isActive ? 2.5 : 2)}
                                className={`w-[22px] h-[22px] mb-0.5 transition-colors ${isActive ? "text-[#2C5FF6]" : "text-[#A1A1AA]"}`}
                            />
                            <span
                                className={`text-[11px] transition-colors ${isActive ? "text-[#2C5FF6] font-bold" : "text-[#A1A1AA] font-semibold"}`}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};
