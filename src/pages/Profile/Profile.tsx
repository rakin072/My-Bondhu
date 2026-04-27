import { useEffect, useState } from "react";
import { Camera, Settings, Check } from "lucide-react";
import { getProfile, updateProfile, type AppProfile } from "../../lib/telegram";
import { useNotifications } from "../../context/NotificationContext";

export const Profile = (): JSX.Element => {
    const { refreshNotifications } = useNotifications();
    const [profile, setProfile] = useState<AppProfile | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const showInfoToast = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
    };

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const currentProfile = await getProfile();
                setProfile(currentProfile);
                setAvatarUrl(currentProfile.avatarUrl);
                setLanguage(currentProfile.language ?? "English");
            } catch {
                showInfoToast("Failed to load profile");
            }
        };

        void bootstrap();
    }, []);

    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const dataUrl = await fileToDataUrl(file);
                const updated = await updateProfile({ avatarUrl: dataUrl });
                setProfile(updated);
                setAvatarUrl(updated.avatarUrl);
                setShowActionSheet(false);
                showInfoToast("Profile photo updated");
            } catch {
                showInfoToast("Failed to upload photo");
            }
        }
    };

    const handlePassportUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            const updated = await updateProfile({
                passportPhoto: dataUrl,
                passportStatus: "uploaded",
                verificationStatus: "pending",
            });
            setProfile(updated);
            await refreshNotifications();
            showInfoToast("Passport uploaded. Verification set to pending");
        } catch {
            showInfoToast("Failed to upload passport");
        }
    };

    // Settings Modals State
    const [activeModal, setActiveModal] = useState<"settings" | "language" | "logout" | null>(null);
    const [language, setLanguage] = useState<"Bangla" | "English">("English");

    const handleLanguageChange = async (nextLanguage: "Bangla" | "English") => {
        try {
            const updated = await updateProfile({ language: nextLanguage });
            setProfile(updated);
            setLanguage(updated.language);
            setActiveModal("settings");
        } catch {
            showInfoToast("Failed to update language");
        }
    };

    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.username || "Guest User";
    const telegramDisplay = profile?.telegramId ? `+${profile.telegramId}` : "-";
    const verificationLabel = profile?.verificationStatus ?? "pending";
    const canWithdraw = Boolean(profile?.canWithdraw);
    const passportLabel = profile?.passportStatus ?? "pending";
    const createdDate = profile?.createdAt
        ? new Date(profile.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "-";


    return (
        <div className="flex-1 flex flex-col bg-[#F3F4F6] relative h-full w-full overflow-hidden">
            {/* Custom Profile Header */}
            <header className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0 z-20 bg-[#F3F4F6]">
                <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight">MYbondhu</h1>
                <button
                    onClick={() => setActiveModal("settings")}
                    className="flex items-center gap-1 text-[#0F172A] hover:opacity-80 transition-opacity"
                >
                    <Settings className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    <span className="text-[12px] font-semibold">Settings</span>
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center pt-2 px-5 pb-[100px] overflow-y-auto w-full">
                {/* Avatar section */}
                <div className="relative mb-4 mt-2">
                    <button
                        onClick={() => setShowActionSheet(true)}
                        className="w-[104px] h-[104px] rounded-full bg-[#CBCBCC] flex items-center justify-center relative border border-gray-200"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Nasir stell" className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <Camera className="w-[26px] h-[26px] text-[#242426]" strokeWidth={2.5} />
                        )}
                    </button>
                    {/* Small camera badge if image exists */}
                    {avatarUrl && (
                        <button
                            onClick={() => setShowActionSheet(true)}
                            className="absolute bottom-0 right-1 w-[32px] h-[32px] bg-[#E5E7EB] rounded-full flex items-center justify-center shadow-sm border-[2px] border-[#F3F4F6]"
                        >
                            <Camera className="w-[15px] h-[15px] text-[#242426]" strokeWidth={3} />
                        </button>
                    )}
                </div>

                <h2 className="text-[20px] font-medium text-[#0F172A] tracking-tight mb-2">{fullName}</h2>
                <div className="text-[12px] text-[#6B7280] mb-7">@{profile?.username ?? "guest"}</div>

                {/* Info Card */}
                <div className="w-full bg-white rounded flex flex-col shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-gray-100 px-5 pt-4 pb-5">
                    {/* Current Balance */}
                    <div className="mb-4">
                        <label className="block text-[11px] font-bold text-[#4B5563] mb-1">Current Balance</label>
                        <div className="text-[#2C5FF6] text-[15px] font-medium">{profile?.balance ?? 0} Gold Coins</div>
                    </div>

                    <div className="w-[110%] -ml-[5%] h-[1px] bg-gray-100 mb-4" />

                    {/* Telegram ID */}
                    <div className="mb-4">
                        <label className="block text-[11px] font-bold text-[#4B5563] mb-1">Telegram ID</label>
                        <div className="text-[#2C5FF6] text-[15px] font-medium">{telegramDisplay}</div>
                    </div>

                    <div className="w-[110%] -ml-[5%] h-[1px] bg-gray-100 mb-4" />

                    {/* Passport */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between gap-3 mb-1">
                            <label className="block text-[11px] font-bold text-[#4B5563]">Passport</label>
                            <label className="text-[#2C5FF6] text-[12px] font-semibold cursor-pointer hover:opacity-80 transition-opacity">
                                Upload Document
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handlePassportUpload}
                                />
                            </label>
                        </div>
                        <div className="text-[#2C5FF6] text-[15px] font-medium capitalize">{passportLabel}</div>
                    </div>

                    <div className="w-[110%] -ml-[5%] h-[1px] bg-gray-100 mb-4" />

                    {/* Member Since */}
                    <div className="mb-4">
                        <label className="block text-[11px] font-bold text-[#4B5563] mb-1">Member Since</label>
                        <div className="text-[#2C5FF6] text-[15px] font-medium">{createdDate}</div>
                    </div>

                    <div className="w-[110%] -ml-[5%] h-[1px] bg-gray-100 mb-4" />

                    {/* Verification Status */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <label className="text-[11px] font-bold text-[#4B5563]">Verification Status</label>
                            <span className="bg-[#EAB308] text-white text-[10px] font-bold px-[5px] py-[2px] rounded border border-[#D97706]/20">{verificationLabel}</span>
                        </div>
                        <div className="text-[#0F172A] text-[13px] font-medium mt-0.5">{canWithdraw ? "You can withdraw Taka" : "Unable to withdraw Taka"}</div>
                    </div>
                </div>

                {/* iOS Style Action Sheet inside relative container */}
                {showActionSheet && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 z-40 bg-black/40"
                            onClick={() => setShowActionSheet(false)}
                        />

                        {/* Bottom Modal Area */}
                        <div className="absolute bottom-[104px] left-4 right-4 z-50 animate-in slide-in-from-bottom flex flex-col">
                            <div className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col">
                                {/* Title bar */}
                                <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 bg-white">
                                    <span className="text-[13px] text-gray-500 font-medium">Selfie</span>
                                </div>

                                <label className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[17px] bg-white border-b border-gray-100 active:bg-gray-100 transition-colors block cursor-pointer">
                                    File Manager
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </label>

                                <label className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[17px] bg-white active:bg-gray-100 transition-colors block cursor-pointer">
                                    Camera
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="user"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </label>
                            </div>

                            {/* Cancel button separated for standard iOS look, though missing in user screenshot we handle cancel via backdrop */}
                        </div>
                    </>
                )}
            </main>

            {/* Settings Main Modal */}
            {activeModal === "settings" && (
                <>
                    <div className="absolute inset-0 z-40 bg-black/40" onClick={() => setActiveModal(null)} />
                    <div className="absolute bottom-[104px] left-4 right-4 z-50 animate-in slide-in-from-bottom">
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-4 pt-3 pb-2.5 bg-white border-b border-gray-100">
                                <span className="text-[10px] text-gray-500 font-medium tracking-wide">Settings</span>
                            </div>

                            <button
                                onClick={() => setActiveModal("language")}
                                className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                Language
                            </button>
                            <div className="mx-4 h-[1px] bg-gray-100" />

                            <button
                                onClick={() => setActiveModal(null)}
                                className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                Help & Support
                            </button>
                            <div className="mx-4 h-[1px] bg-gray-100" />

                            <button
                                onClick={() => setActiveModal(null)}
                                className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                Terms & Privacy
                            </button>
                            <div className="mx-4 h-[1px] bg-gray-100" />

                            <button
                                onClick={() => setActiveModal("logout")}
                                className="w-full text-left px-4 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Language Selection Modal */}
            {activeModal === "language" && (
                <>
                    <div className="absolute inset-0 z-40 bg-black/40" onClick={() => setActiveModal(null)} />
                    <div className="absolute bottom-[104px] left-4 right-4 z-50 animate-in slide-in-from-bottom">
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-100">
                                <span className="text-[10px] text-gray-500 font-medium tracking-wide">Language</span>
                            </div>

                            <button
                                onClick={() => {
                                    void handleLanguageChange("Bangla");
                                }}
                                className="w-full px-4 py-[14px] flex items-center justify-between text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                <span>Bangla</span>
                                {language === "Bangla" && <Check className="w-[18px] h-[18px] text-[#000000]" strokeWidth={2.5} />}
                            </button>
                            <div className="mx-4 h-[1px] bg-gray-100" />

                            <button
                                onClick={() => {
                                    void handleLanguageChange("English");
                                }}
                                className="w-full px-4 py-[14px] flex items-center justify-between text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                <span>English</span>
                                {language === "English" && <Check className="w-[18px] h-[18px] text-[#000000]" strokeWidth={2.5} />}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Logout Confirm Modal */}
            {activeModal === "logout" && (
                <>
                    <div className="absolute inset-0 z-40 bg-black/40" onClick={() => setActiveModal(null)} />
                    <div className="absolute bottom-[104px] left-4 right-4 z-50 animate-in slide-in-from-bottom">
                        <div className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-5 pt-5 pb-3 bg-white border-b border-gray-100">
                                <span className="text-[12px] text-gray-600 font-medium tracking-wide">Do You Want to Logout ?</span>
                            </div>

                            <button
                                onClick={() => setActiveModal(null)}
                                className="w-full text-left px-5 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                Yes
                            </button>
                            <div className="mx-4 h-[1px] bg-gray-100" />

                            <button
                                onClick={() => setActiveModal("settings")}
                                className="w-full text-left px-5 py-[14px] text-[#2C5FF6] text-[15px] font-medium bg-white active:bg-gray-50 transition-colors"
                            >
                                No
                            </button>
                        </div>
                    </div>
                </>
            )}

            {showToast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-[#2C5FF6] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 border border-white/20 backdrop-blur-sm">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span className="text-[14px] font-bold tracking-wide">{toastMessage}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
