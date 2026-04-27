import { useEffect, useState } from "react";
import { ChevronDown, Check, Trophy } from "lucide-react";
import { GoldCoin } from "../../components/GoldCoin";
import { getLeaderboard, type LeaderboardPlayer } from "../../lib/telegram";

const MedalIcon = ({ place }: { place: number }) => {
    // Only 1, 2, 3 have medals
    const color = place === 1 ? "#F59E0B" : place === 2 ? "#9CA3AF" : "#B45309";

    return (
        <div className="w-[30px] h-[34px] relative flex items-center justify-center shrink-0">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0">
                {/* Ribbons */}
                <path d="M7 16L4 28L9 24L12 26L12 16H7Z" fill="#14532d" />
                <path d="M17 16L20 28L15 24L12 26L12 16H17Z" fill="#14532d" />
                {/* Coin */}
                <circle cx="12" cy="11" r="11" fill={color} />
                <circle cx="12" cy="11" r="8" fill="transparent" stroke="white" strokeWidth="1" opacity="0.3" />
                {/* Star */}
                <path d="M12 5.5L13.5 8.5L16.5 9L14.5 11.5L15 14.5L12 13L9 14.5L9.5 11.5L7.5 9L10.5 8.5L12 5.5Z" fill="#FEF3C7" />
            </svg>
        </div>
    );
};

export const Friends = (): JSX.Element => {
    const [filter, setFilter] = useState<"Today" | "1 Week" | "1 Month" | "All Time">("Today");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
    const [me, setMe] = useState<LeaderboardPlayer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const getOrdinalRank = (rank: number): string => {
        const mod10 = rank % 10;
        const mod100 = rank % 100;
        if (mod10 === 1 && mod100 !== 11) return `${rank}st`;
        if (mod10 === 2 && mod100 !== 12) return `${rank}nd`;
        if (mod10 === 3 && mod100 !== 13) return `${rank}rd`;
        return `${rank}th`;
    };

    const getLimitForFilter = (currentFilter: "Today" | "1 Week" | "1 Month" | "All Time"): number => {
        if (currentFilter === "Today") return 10;
        if (currentFilter === "1 Week") return 20;
        if (currentFilter === "1 Month") return 30;
        return 50;
    };

    useEffect(() => {
        const loadLeaderboard = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                const result = await getLeaderboard(getLimitForFilter(filter));
                setPlayers(result.players);
                setMe(result.me);
            } catch {
                setLoadError("Failed to load leaderboard");
            } finally {
                setIsLoading(false);
            }
        };

        void loadLeaderboard();
    }, [filter]);

    const top3 = players.slice(0, 3);
    const others = players.slice(3);

    const handleCopy = () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // UI mapping for filter text as visual
    const displayFilterLabels: Record<string, string> = {
        "Today": "Today",
        "1 Week": "7 days",
        "1 Month": "Month",
        "All Time": "All Time"
    };

    return (
        <div className="flex-1 flex flex-col bg-[#F3F4F6] relative h-full w-full overflow-hidden">

            {/* Custom Rank Header */}
            <header className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0 z-20 bg-[#F3F4F6]">
                <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight">MYbondhu</h1>

                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="bg-[#2C5FF6] hover:bg-[#254ED3] text-white px-3 py-[7px] rounded text-[11px] font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <span className="flex items-center">
                            <ChevronDown className="w-4 h-4 mr-0.5" strokeWidth={3} />
                            {displayFilterLabels[filter]}
                        </span>
                    </button>

                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)}></div>
                            <div className="absolute right-0 top-[110%] w-[120px] bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.1)] py-2 z-40">
                                {(["Today", "1 Week", "1 Month", "All Time"] as const).map((filterKey) => {
                                    const isSelected = filter === filterKey;
                                    return (
                                        <button
                                            key={filterKey}
                                            onClick={() => {
                                                setFilter(filterKey);
                                                setDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-[6px] text-[12px] flex items-center gap-[6px] hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="w-[14px] flex justify-center shrink-0">
                                                {isSelected && <Check className="w-[12px] h-[12px] text-black" strokeWidth={3} />}
                                            </div>
                                            <span className={`text-[#000000] ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                                {displayFilterLabels[filterKey]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Scrollable List */}
            <main className="flex-1 overflow-y-auto px-4 pb-[180px] pt-2 hide-scrollbar">

                {/* Top 3 Card */}
                <div className="bg-white rounded-[10px] shadow-sm flex flex-col px-4 pt-1 mb-3">
                    {isLoading && <div className="py-6 text-center text-sm text-gray-500">Loading leaderboard...</div>}
                    {!isLoading && loadError && <div className="py-6 text-center text-sm text-red-500">{loadError}</div>}
                    {!isLoading && !loadError && top3.length === 0 && (
                        <div className="py-6 text-center text-sm text-gray-500">No players found</div>
                    )}
                    {!isLoading && !loadError && top3.map((user, index) => (
                        <div key={user.userid} className={`flex items-center py-[14px] gap-3 ${index !== top3.length - 1 ? "border-b border-gray-100/80" : ""}`}>

                            {/* Medals container / spacer */}
                            {user.rank <= 3 ? (
                                <MedalIcon place={index + 1} />
                            ) : (
                                <div className="w-[30px] shrink-0" />
                            )}

                            <img src={user.user_photo ?? `https://i.pravatar.cc/150?u=${user.userid}`} className="w-[42px] h-[42px] rounded-full object-cover shrink-0 bg-gray-200" alt={user.username} />

                            <div className="flex flex-col gap-0.5 flex-1 w-full overflow-hidden">
                                <div className="flex items-center gap-1.5 w-full">
                                    <span className="text-[15px] font-semibold text-[#000000] truncate max-w-[120px]">{user.username}</span>
                                    <div className={`flex items-center gap-0.5 text-[11px] font-bold shrink-0 ${user.rank <= 3 ? "text-[#2C5FF6]" : "text-[#6B7280]"}`}>
                                        <Trophy className="w-3 h-3" strokeWidth={2.5} />
                                        <span>{getOrdinalRank(user.rank)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <GoldCoin className="w-4 h-4" />
                                    <span className="text-[#FBBF24] text-[15px] font-black">{user.points}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Rest of the list */}
                <div className="bg-white rounded-[10px] shadow-sm flex flex-col px-4 pt-1 mb-8">
                    {others.map((user, index) => (
                        <div key={user.userid} className={`flex items-center py-[14px] gap-3 ${index !== others.length - 1 ? "border-b border-gray-100/80" : ""}`}>
                            <img src={user.user_photo ?? `https://i.pravatar.cc/150?u=${user.userid}`} className="w-[42px] h-[42px] rounded-full object-cover shrink-0 bg-gray-200" alt={user.username} />

                            <div className="flex flex-col gap-0.5 flex-1 w-full overflow-hidden">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[15px] font-semibold text-[#000000] truncate max-w-[120px]">{user.username}</span>
                                    <div className="flex items-center gap-0.5 text-[#6B7280] text-[11px] font-bold shrink-0">
                                        <Trophy className="w-3 h-3" strokeWidth={2.5} />
                                        <span>{getOrdinalRank(user.rank)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <GoldCoin className="w-4 h-4" />
                                    <span className="text-[#FBBF24] text-[15px] font-black">{user.points}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Sticky "Me" Card at bottom, matching UI exactly */}
            <div className="absolute bottom-[104px] left-4 right-4 z-10 w-auto">
                {/* Refer Button */}
                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleCopy}
                        className="bg-[#2C5FF6] text-white text-[13px] font-bold py-2 px-2 rounded-lg shadow-lg z-50 w-[30%]"
                    >
                        Refer and Earn
                    </button>
                </div>

                <div className="bg-white rounded-[8px] border border-[#2C5FF6] shadow-md flex items-center justify-between px-4 py-[14px]">
                    <div className="flex items-center gap-4">
                        <img src={me?.user_photo ?? "https://i.pravatar.cc/150?u=me"} className="w-[42px] h-[42px] rounded-full object-cover shrink-0 bg-gray-200" alt="Me" />
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-[#000000]">Me</span>
                            <div className="flex items-center gap-0.5 text-[#2C5FF6] text-[12px] font-bold">
                                <Trophy className="w-3.5 h-3.5" strokeWidth={2.5} />
                                <span>{me ? getOrdinalRank(me.rank) : "--"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <GoldCoin className="w-[18px] h-[18px]" />
                        <span className="text-[#FBBF24] text-[16px] font-black">{me?.points ?? 0}</span>
                    </div>
                </div>
            </div>

            {/* Link Copied Toast */}
            {isCopied && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#B9B9B9] text-white px-8 py-3 rounded-[8px] text-[15px] font-bold shadow-sm backdrop-blur-sm whitespace-nowrap">
                        Link Copied!
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
};
