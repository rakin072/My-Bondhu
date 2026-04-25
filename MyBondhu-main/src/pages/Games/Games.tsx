import { useState, useEffect } from "react";
import { GoldCoin } from "../../components/GoldCoin";

export const Games = (): JSX.Element => {
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => {
                setIsCopied(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopied]);

    const handleCopy = () => {
        setIsCopied(true);
    };

    return (
        // <div className="flex-1 flex flex-col bg-white relative h-full w-full overflow-hidden">
        //     {/* Custom Header */}
        //     {/* <header className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0 z-10 bg-white">
        //         <h1 className="text-[22px] font-black text-[#0F172A] tracking-tight">MYbondhu</h1>
        //     </header> */}

        //     <main className="flex-1 flex flex-col items-center pt-8 px-5">
        //         {/* Reward Banner */}
        //         <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-6 mb-4 flex items-center justify-center gap-2">
        //             <span className="text-[15px] font-medium text-[#0F172A]">Earn Up To</span>
        //             <div className="flex items-center gap-1.5">
        //                 <GoldCoin className="w-5 h-5" />
        //                 <span className="text-[#FBBF24] text-[18px] font-black">10</span>
        //             </div>
        //             <span className="text-[15px] font-medium text-[#0F172A]">Gold Coins</span>
        //         </div>

        //         {/* Refer Card */}
        //         <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col items-center">
        //             <div className="w-full pt-8 pb-4 flex flex-col items-center px-6">
        //                 <span className="text-[11px] font-bold text-[#6B7280] mb-3">Refer & Share profile</span>
        //                 <div className="w-full flex items-center justify-center py-4 px-2 border-b border-gray-100">
        //                     <span className="text-[24px] font-medium text-[#6B7280] tracking-tight">@nasir1223432</span>
        //                 </div>
        //             </div>

        //             <button
        //                 onClick={handleCopy}
        //                 className="w-full py-5 text-[#2C5FF6] text-[15px] font-bold hover:bg-gray-50 transition-colors active:bg-gray-100"
        //             >
        //                 Refer and Earn
        //             </button>
        //         </div>
        //     </main>

        //     {/* Link Copied Toast - Matching Screen 37 */}
        //     {isCopied && (
        //         <div className="absolute bottom-[110px] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        //             <div className="bg-[#B9B9B9] text-white px-12 sm:px-20 py-3 rounded-[8px] text-[15px] font-bold shadow-sm backdrop-blur-sm whitespace-nowrap">
        //                 Link Copied!
        //             </div>
        //         </div>
        //     )}
            // </div>
            <div className="h-screen mx-auto my-48">Comming soon.....</div>
        );
    };
