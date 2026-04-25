import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface MiningNavContextType {
    isMiningActive: boolean;
    setMiningActive: (active: boolean) => void;
    showNav: boolean;
    handleScreenTap: () => void;
}

const MiningNavContext = createContext<MiningNavContextType>({
    isMiningActive: false,
    setMiningActive: () => {},
    showNav: true,
    handleScreenTap: () => {},
});

export const useMiningNav = () => useContext(MiningNavContext);

export const MiningNavProvider = ({ children }: { children: ReactNode }) => {
    const [isMiningActive, setIsMiningActive] = useState(false);
    const [showNav, setShowNav] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setMiningActive = useCallback((active: boolean) => {
        setIsMiningActive(active);
        if (active) {
            setShowNav(false);
        } else {
            setShowNav(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    }, []);

    const handleScreenTap = useCallback(() => {
        if (!isMiningActive) return;
        
        // Show nav
        setShowNav(true);

        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Hide after 3.5 seconds
        timerRef.current = setTimeout(() => {
            setShowNav(false);
            timerRef.current = null;
        }, 3500);
    }, [isMiningActive]);

    return (
        <MiningNavContext.Provider value={{ isMiningActive, setMiningActive, showNav, handleScreenTap }}>
            {children}
        </MiningNavContext.Provider>
    );
};
