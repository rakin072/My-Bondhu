import { useState } from "react";
import { PhoneIncoming as HomeIcon, MapPin as MapPinIcon, Share2 as Share2Icon, Trophy as TrophyIcon, User as UserIcon, Wallet as WalletIcon } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AnimatedMiningGraphic } from "../../components/AnimatedMiningGraphic";

export const ElementViewHome = (): JSX.Element => {
  const [showToast, setShowToast] = useState(false);

  const handleWithdrawClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const navigationItems = [
    { icon: HomeIcon, label: "Home", active: true },
    { icon: WalletIcon, label: "Wallet", active: false },
    { icon: TrophyIcon, label: "Rank", active: false },
    { icon: UserIcon, label: "Profile", active: false },
    { icon: Share2Icon, label: "Share", active: false },
  ];

  return (
    <div className="flex justify-center min-h-[100dvh] w-full bg-gray-100">
      <div className="w-full max-w-[500px] h-[100dvh] mx-auto flex flex-col bg-white shadow-sm overflow-hidden relative">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <h1 className="text-lg font-bold text-gray-900">MYbondhu</h1>
          <Avatar className="w-8 h-8">
            <AvatarImage src="" alt="Profile" />
            <AvatarFallback className="bg-gray-200">
              <UserIcon className="w-4 h-4 text-gray-600" />
            </AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 flex flex-col px-4 pt-4 pb-2 overflow-y-auto">
          <Card className="bg-[#2C5FF6] border-0 mb-4">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src="" alt="Nasir stell" />
                    <AvatarFallback className="bg-white/20 text-white">
                      NS
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-white text-sm font-medium">
                        Nasir stell
                      </span>
                      <MapPinIcon className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">44th</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-lg">🪙</span>
                      <span className="text-white text-sm font-semibold">0</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleWithdrawClick}
                  variant="secondary"
                  size="sm"
                  className="bg-gray rounded-none hover:bg-white/30 text-white border-0 text-xs px-3 py-1 h-auto"
                >
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mb-4">
            <p className="text-[#2C5FF6] font-semibold text-sm">
              Ready for mining!
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center mb-4">
            <AnimatedMiningGraphic isMining={false} />
          </div>

          <Button className="w-full bg-[#2C5FF6] hover:bg-[#2C5FF6]/90 text-white font-bold py-6 rounded-full text-sm mb-2">
            START MINING 60 MIN
          </Button>
        </main>

        <nav className="flex items-center justify-around border-t bg-white py-2 px-2 pb-6">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                className="flex flex-col items-center gap-1 min-w-0 flex-1"
              >
                <Icon
                  className={`w-5 h-5 ${item.active ? "text-[#2C5FF6]" : "text-gray-400"}`}
                />
                <span
                  className={`text-[10px] ${item.active ? "text-[#2C5FF6] font-medium" : "text-gray-400"}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Premium Toast Notification */}
        {showToast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300 w-[max-content]">
            <div className="bg-[#2C5FF6] text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-white/20 backdrop-blur-sm">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-[12px] font-bold tracking-wide">Coming Soon!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
