import { Outlet, useLocation } from "react-router-dom";
import { Navigation } from "./Navigation";
import { Header } from "./Header";

export const Layout = (): JSX.Element => {
    const location = useLocation();
    const isProfile = location.pathname.startsWith("/profile");
    const isRank = location.pathname.startsWith("/rank");
    const isGrayBg = isProfile || isRank;

    return (
        <div className="flex justify-center min-h-[100dvh] w-full bg-gray-100">
            <div className={`w-full max-w-[500px] h-[100dvh] mx-auto flex flex-col shadow-sm overflow-hidden relative ${isGrayBg ? "bg-[#F3F4F6]" : "bg-white"}`}>
                {(!isRank && !isProfile) && <Header />}
                <Outlet />
                <Navigation />
            </div>
        </div>
    );
};
