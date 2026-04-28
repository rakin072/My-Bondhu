import { useState, useEffect } from "react";
import { MapPin as MapPinIcon, User as UserIcon } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AnimatedMiningGraphic } from "../../components/AnimatedMiningGraphic";
import { GoldCoin } from "../../components/GoldCoin";
import beforeMiningBg from "../../assets/before-mining.png";
import onMiningBg from "../../assets/mining.gif";
import {
  claimMiningReward,
  getMiningStatus,
  getLeaderboard,
  getTelegramUserPreview,
  getUserProfile,
  startMiningSession,
  type AppUser,
} from "../../lib/telegram";

export const Home = (): JSX.Element => {
  const preview = getTelegramUserPreview();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMining, setIsMining] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [miningStatus, setMiningStatus] = useState<"idle" | "active" | "completed">("idle");
  const [rank, setRank] = useState<number | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Coming Soon!");
  const [earnedReward, setEarnedReward] = useState(0);

  const showInfoToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleWithdrawClick = () => {
    showInfoToast("Coming Soon!");
  };

  const refreshData = async () => {
    const [profile, miningStatus, leaderboard] = await Promise.all([
      getUserProfile(),
      getMiningStatus(),
      getLeaderboard(20),
    ]);

    setUser(profile);
    setIsMining(miningStatus.miningStatus === "active");
    setCanClaim(miningStatus.canClaim);
    setTimeLeft(Math.max(0, miningStatus.remainingSec ?? miningStatus.remainingMin * 60));
    setMiningStatus(miningStatus.miningStatus ?? (miningStatus.canClaim ? "completed" : miningStatus.active ? "active" : "idle"));
    setRank(leaderboard.me?.rank ?? null);
    if (miningStatus.rewardPoints && earnedReward === 0) {
      setEarnedReward(miningStatus.rewardPoints);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshData();
      } catch {
        showInfoToast("Failed to load mining data");
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (miningStatus === "active" && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Ask backend to flip to completed if time is up.
            void refreshData();
            return 0;
          }
          return prev > 0 ? prev - 1 : 0;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [miningStatus, timeLeft]);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    if (miningStatus === "active") {
      poll = setInterval(() => {
        void refreshData();
      }, 4000);
    }
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [miningStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartMining = async () => {
    try {
      setIsLoading(true);
      await startMiningSession();
      await refreshData();
      showInfoToast("Mining started");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start mining";
      showInfoToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMiningAction = async () => {
    if (miningStatus !== "completed") {
      if (miningStatus === "active") showInfoToast("Mining in progress");
      else showInfoToast("Start mining first");
      return;
    }

    try {
      setIsLoading(true);
      const result = await claimMiningReward();
      setEarnedReward(result.reward);
      setShowRewardModal(true);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim reward";
      showInfoToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    [preview?.firstName, preview?.lastName].filter(Boolean).join(" ") ||
    preview?.username ||
    "Guest User";
  const balance = user?.balance ?? 0;


  return (
    <>
      <main className="flex-1 flex flex-col px-5 pt-3 pb-[100px] overflow-hidden relative z-0">
        <div className="absolute inset-0 -z-10 select-none pointer-events-none overflow-hidden">
          <img
            src={beforeMiningBg}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover blur-[2px] brightness-95 transition-opacity duration-1000 ${isMining ? "opacity-0" : "opacity-100"}`}
          />
          <img
            src={onMiningBg}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover object-bottom brightness-95 transition-opacity duration-1000 ${isMining ? "opacity-100" : "opacity-0"}`}
          />
        </div>
        {miningStatus === "idle" ? (
          <>
            <Card className="bg-[#2C5FF6] border-0 mb-4 rounded-xl flex-shrink-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={preview?.avatarUrl ?? ""} alt={displayName} />
                      <AvatarFallback className="bg-white/20 text-white font-medium flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-white" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-medium">
                          {displayName}
                        </span>
                        <MapPinIcon className="w-3.5 h-3.5 text-white" />
                        <span className="text-white text-xs">{rank ? `${rank}th` : "-"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <GoldCoin className="w-[18px] h-[18px]" />
                        <span className="text-white font-semibold flex items-center mt-px">{balance}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleWithdrawClick}
                    variant="secondary"
                    size="sm"
                    className="bg-white/30 hover:bg-white/20 text-white border-0 text-xs px-4 py-1.5 h-auto rounded-md font-medium"
                  >
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="text-center mb-6 flex-shrink-0">
              <p className="text-[#2C5FF6] font-semibold text-sm tracking-wide">
                {isLoading ? "Loading..." : "Ready for mining!"}
              </p>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-0 mb-6">
              <AnimatedMiningGraphic isMining={false} />
            </div>

            <div className="mt-auto pt-2 pb-2 flex-shrink-0">
              <Button
                onClick={handleStartMining}
                disabled={isLoading}
                className="w-full bg-[#2C5FF6] hover:bg-[#2C5FF6]/90 text-white font-bold py-7 rounded-[26px] text-[15px] shadow-lg shadow-blue-500/20"
              >
                {isLoading ? "PLEASE WAIT..." : "MINE"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mt-4 flex-shrink-0 z-10 relative">
              <div className="flex flex-col">
                <h2 className="text-[#2C5FF6] font-bold text-[15px]">Time Left</h2>
                <div className="text-[#F2B908] font-black text-[54px] leading-none tracking-tight drop-shadow-sm mt-1">
                  {formatTime(timeLeft)}
                </div>
              </div>
              <Button
                onClick={handleMiningAction}
                disabled={isLoading}
                className="bg-gradient-to-b from-[#8C98A7] to-[#5C6777] hover:from-[#7C8897] hover:to-[#4C5767] border border-gray-400/30 text-white font-extrabold py-4 px-6 rounded-[20px] text-[14px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_8px_16px_rgba(0,0,0,0.15)] tracking-wide"
              >
                {miningStatus === "completed" ? "CLAIM" : "MINING..."}
              </Button>
            </div>
          </>
        )}

        {/* Bonus Earned Modal - Screen 38 */}
        {showRewardModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-[2px]">
            <div className="bg-white rounded-[12px] p-8 w-full max-w-[280px] relative flex flex-col items-center shadow-2xl overflow-hidden">
              {/* Sprinkles/Confetti effects logic (Simplified CSS) */}
              <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-yellow-400 opacity-80" />
              <div className="absolute top-10 right-10 w-2 h-2 rounded-full bg-purple-500 opacity-80" />
              <div className="absolute bottom-12 left-8 w-2 h-2 rounded-full bg-blue-500 opacity-80" />
              <div className="absolute top-6 right-6 w-3 h-[1px] bg-gray-400 rotate-45" />

              {/* Gold Coin Icon */}
              <div className="relative mb-4">
                <div className="absolute -inset-4 bg-yellow-400/10 rounded-full blur-xl animate-pulse" />
                <GoldCoin className="w-16 h-16 relative" />
                <span className="absolute -right-4 top-1 text-[28px] font-black text-[#FBBF24]">{earnedReward}</span>
              </div>

              <div className="flex flex-col items-center text-center mt-2">
                <h3 className="text-[15px] font-bold text-[#000000]">Earned {earnedReward} Gold Coins</h3>
                <p className="text-[11px] text-[#6B7280] font-medium mt-1">Your balance updated successfully</p>
              </div>

              <button
                onClick={() => setShowRewardModal(false)}
                className="mt-8 text-[#2C5FF6] text-[13px] font-bold"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Premium Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#2C5FF6] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 border border-white/20 backdrop-blur-sm">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-[14px] font-bold tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}
    </>
  );
};
