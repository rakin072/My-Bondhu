import { useEffect, useMemo, useState } from "react";
import { Trophy, ChevronDown } from "lucide-react";
import { GoldCoin } from "../../components/GoldCoin";
import { getTransactions, getUserProfile, type AppTransaction, type AppUser } from "../../lib/telegram";

type Transaction = {
    id: number;
    title: string;
    subtitle: string;
    amount: number;
    createdAt: string;
    dateKey: "Today" | "1 Week" | "1 Month" | "All Time";
};

const mapDateKey = (dateValue: string): Transaction["dateKey"] => {
    const createdDate = new Date(String(dateValue).replace(" ", "T") + "Z");
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) return "Today";
    if (diffDays <= 7) return "1 Week";
    if (diffDays <= 30) return "1 Month";
    return "All Time";
};

const mapTransaction = (item: AppTransaction): Transaction => {
    const createdDate = new Date(String(item.createdAt).replace(" ", "T") + "Z");
    const title = createdDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    return {
        id: item.id,
        title,
        subtitle: item.note ?? item.type.replace(/_/g, " "),
        amount: item.amount,
        createdAt: item.createdAt,
        dateKey: mapDateKey(item.createdAt),
    };
};

export const Wallet = (): JSX.Element => {
    const [filter, setFilter] = useState<"Today" | "1 Week" | "1 Month" | "All Time">("Today");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("Coming Soon!");
    const [user, setUser] = useState<AppUser | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const handleWithdrawClick = () => {
        setToastMessage("Coming Soon!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const [profile, items] = await Promise.all([getUserProfile(), getTransactions()]);
                setUser(profile);
                setTransactions(items.map(mapTransaction));
            } catch {
                setToastMessage("Failed to load wallet data");
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }
        };

        void bootstrap();
    }, []);

    // Derive filtered items based on standard cumulative logic
    const filteredTransactions = useMemo(() => transactions.filter((tx) => {
        if (filter === "Today") return tx.dateKey === "Today";
        if (filter === "1 Week") return tx.dateKey === "Today" || tx.dateKey === "1 Week";
        if (filter === "1 Month") return tx.dateKey === "Today" || tx.dateKey === "1 Week" || tx.dateKey === "1 Month";
        return true; // All Time
    }), [transactions, filter]);

    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Guest User";
    const balance = user?.balance ?? 0;

    return (
        <main className="flex-1 flex flex-col px-4 pt-1 pb-[100px] overflow-y-auto relative bg-white">
            {/* Top Banner */}
            <div className="bg-[#2C5FF6] rounded-xl flex flex-col items-center pt-5 pb-4 px-4 shadow-sm mb-4 relative z-0 mt-2">
                {/* Avatar */}
                <div className="w-[84px] h-[84px] rounded-full border-[2px] border-[#A8BFF8] overflow-hidden mb-2">
                    {/* Default user face from pravatar that looks close enough or just a general static image */}
                    <img src="https://i.pravatar.cc/150?u=nasir" alt="Nasir stell" className="w-full h-full object-cover" />
                </div>

                {/* Rank & Name */}
                <div className="flex flex-col items-center text-white mb-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium opacity-90 mb-0.5">
                        <Trophy className="w-3 h-3" />
                        <span>44th</span>
                    </div>
                    <h2 className="text-[20px] font-bold tracking-tight leading-none">{displayName}</h2>
                </div>

                {/* Coin Balance */}
                <div className="flex items-center justify-center gap-3 mb-4">
                    <GoldCoin className="w-9 h-9" />
                    <span className="text-[#FFC224] text-[48px] font-bold leading-none drop-shadow-sm">{balance}</span>
                </div>

                {/* Action Button: Showing yellow Withdraw button as in the 2nd image */}
                <button
                    onClick={handleWithdrawClick}
                    className="bg-[#FBC335] hover:bg-[#F2B908] text-white text-[15px] font-bold py-[9px] px-8 rounded-lg mb-4 shadow-sm transition-colors w-1/2 min-w-[140px]"
                >
                    Withdraw
                </button>

                {/* Taka Info */}
                <p className="text-white text-[13px] font-medium tracking-wide">
                    1 Gold coin = 1 Taka
                </p>
            </div>

            {/* Transactions Section */}
            <div className="border border-gray-100 rounded-lg overflow-hidden flex flex-col mt-0 shadow-[0_2px_10px_rgba(0,0,0,0.03)] pb-2 min-h-[300px]">
                {/* Header */}
                <div className="bg-[#B9D2FD] px-4 py-[10px] flex items-center justify-between">
                    <h3 className="text-[#000000] text-[13px] font-bold tracking-wide">TRANSECTIONS</h3>

                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="bg-[#2C5FF6] hover:bg-[#254ED3] text-white px-3 py-1.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                        >
                            {filter}
                            <ChevronDown className="w-3.5 h-3.5" strokeWidth={3} />
                        </button>

                        {dropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                                <div className="absolute right-0 top-[110%] mt-1 bg-white border border-blue-100 rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-20 w-[110px] py-1 overflow-hidden">
                                    {(["Today", "1 Week", "1 Month", "All Time"] as const).map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => {
                                                setFilter(f);
                                                setDropdownOpen(false);
                                            }}
                                            className={`block w-full text-left px-3 py-2 text-[12px] transition-colors ${filter === f ? "bg-blue-50 text-[#2C5FF6] font-bold" : "text-gray-700 hover:bg-gray-50"
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* List */}
                <div className="bg-white flex flex-col px-4 pt-1">
                    {filteredTransactions.map((tx, index) => (
                        <div key={tx.id} className={`flex items-center justify-between py-3 ${index !== filteredTransactions.length - 1 ? "border-b border-gray-100" : ""}`}>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[#000000] text-[13px] font-semibold">{tx.title}</span>
                                <span className="text-[#64748B] text-[11px] font-medium">{tx.subtitle}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <GoldCoin className="w-4 h-4" />
                                <span className="text-[#000000] text-[13px] font-bold">{tx.amount} Gold Coins</span>
                            </div>
                        </div>
                    ))}

                    {filteredTransactions.length === 0 && (
                        <div className="py-8 text-center text-gray-500 text-[13px] font-medium">
                            No transactions found
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Toast Notification */}
            {showToast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-[#2C5FF6] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 border border-white/20 backdrop-blur-sm">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span className="text-[14px] font-bold tracking-wide">{toastMessage}</span>
                    </div>
                </div>
            )}
        </main>
    );
};
