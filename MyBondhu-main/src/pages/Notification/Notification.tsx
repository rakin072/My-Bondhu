import { ArrowLeft, Pin, Plus } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoldCoin } from "../../components/GoldCoin";
import { useNotifications } from "../../context/NotificationContext";

export const Notification = (): JSX.Element => {
    const navigate = useNavigate();
    const { notifications, markAsRead, refreshNotifications } = useNotifications();

    useEffect(() => {
        void refreshNotifications();
    }, [refreshNotifications]);


    return (
        <div className="flex justify-center min-h-[100dvh] w-full bg-gray-100">
            <div className="w-full max-w-[500px] h-[100dvh] mx-auto flex flex-col bg-white shadow-sm overflow-hidden relative">
                <header className="flex items-center gap-3 px-5 py-5 bg-white shrink-0 z-10 border-b border-gray-100">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-900" />
                    </button>
                    <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Notification</h1>
                </header>

                <main className="flex-1 flex flex-col overflow-y-auto w-full">
                    {notifications.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-gray-500 font-medium">
                            No notifications yet
                        </div>
                    )}
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => {
                                void markAsRead(notif.id);
                            }}
                            className={`flex px-5 py-4 border-b border-white relative items-start gap-4 cursor-pointer transition-colors ${notif.isRead ? "bg-white" : "bg-[#DFECFF]"}`}
                        >
                            <div className="flex-shrink-0 relative">
                                {notif.type === "pin" ? (
                                    <div className="w-10 h-10 rounded-full bg-[#B8D3FF] flex items-center justify-center text-[#2C5FF6]">
                                        <Pin className="w-5 h-5 fill-current" />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 flex items-center justify-center relative">
                                        <GoldCoin className="w-[30px] h-[30px]" />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#2C5FF6] rounded-full flex items-center justify-center border-2 border-[#DFECFF]">
                                            <Plus className="w-2.5 h-2.5 text-white stroke-[4px]" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col pt-0.5">
                                <h3 className="text-[13px] font-extrabold text-[#111827] leading-[1.2] mb-1">
                                    {notif.title}
                                </h3>
                                <p className="text-[12px] font-semibold text-[#6690FF] leading-[1.3] pr-2">
                                    {notif.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </main>
            </div>
        </div>
    );
};
