import { Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router-dom";
import miningIllustrationLogin from "../../assets/mining-illustration-login.png";

export const Login = (): JSX.Element => {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate("/home");
    };

    return (
        <div className="flex justify-center min-h-[100dvh] w-full bg-gray-100">
            <div className="w-full max-w-[500px] h-[100dvh] mx-auto flex flex-col bg-white shadow-sm overflow-hidden relative">
                <main className="flex-1 flex flex-col px-4 pt-12 pb-8 overflow-y-auto">
                    {/* Header Section */}
                    <div className="flex flex-col items-center mt-8 mb-6">
                        <h1 className="text-[40px] font-black text-[#2C5FF6] tracking-tight leading-none">MYbondhu</h1>
                        <p className="text-black font-semibold mt-3 text-[15px]">Mining gold for Taka</p>
                    </div>

                    {/* Illustration Section */}
                    <div className="flex-1 flex items-center justify-center -mx-4">
                        <img
                            src={miningIllustrationLogin}
                            alt="Mining illustration login"
                            className="w-full h-auto object-contain scale-[1.15]"
                        />
                    </div>
                    {/* Action Button */}
                    <div className="mt-auto pt-4">
                        <Button
                            onClick={handleLogin}
                            className="w-full bg-[#2C5FF6] hover:bg-[#2C5FF6]/90 text-white font-bold py-7 rounded-[26px] text-[17px] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                            Login with Telegram
                            <Send className="w-5 h-5 ml-1" fill="white" />
                        </Button>
                    </div>
                </main>
            </div>
        </div>
    );
};
