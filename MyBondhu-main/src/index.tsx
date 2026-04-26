import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Notification } from "./pages/Notification";
import { Wallet } from "./pages/Wallet";
import { Profile } from "./pages/Profile";
import { Friends as Rank } from "./pages/Friends";
import { Games } from "./pages/Games";
import { Layout } from "./components/Layout";
import { NotificationProvider } from "./context/NotificationContext";
import { initTelegramWebApp } from "./lib/telegram";
import { MiningNavProvider } from "./contexts/MiningNavContext";

initTelegramWebApp();

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <NotificationProvider>
      <BrowserRouter>
        <MiningNavProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/notifications" element={<Notification />} />
            <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/rank" element={<Rank />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/games" element={<Games />} />
          </Route>
          </Routes>
        </MiningNavProvider>
      </BrowserRouter>
    </NotificationProvider>
  </StrictMode>,
);
