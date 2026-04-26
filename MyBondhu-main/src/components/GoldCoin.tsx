export const GoldCoin = ({ className = "w-[22px] h-[22px]" }: { className?: string }) => (
    <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <circle cx="50" cy="52" r="48" fill="#D97706" />
        <circle cx="50" cy="50" r="48" fill="#FBBF24" />
        <circle cx="50" cy="50" r="36" fill="#F59E0B" />
        <path d="M50 14C30.1177 14 14 30.1177 14 50C14 69.8823 30.1177 86 50 86C69.8823 86 86 69.8823 86 50" stroke="#FDE68A" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    </svg>
);
