declare module '*.png';
declare module '*.gif';

interface TelegramThemeParams {
	bg_color?: string;
	text_color?: string;
	hint_color?: string;
	link_color?: string;
	button_color?: string;
	button_text_color?: string;
	secondary_bg_color?: string;
}

interface TelegramWebAppUser {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
}

interface TelegramWebApp {
	initData: string;
	initDataUnsafe?: {
		user?: TelegramWebAppUser;
	};
	platform: string;
	version: string;
	isExpanded: boolean;
	colorScheme?: "light" | "dark";
	themeParams: TelegramThemeParams;
	ready: () => void;
	expand: () => void;
	setHeaderColor?: (color: string) => void;
	setBackgroundColor?: (color: string) => void;
}

interface Window {
	Telegram?: {
		WebApp: TelegramWebApp;
	};
}
