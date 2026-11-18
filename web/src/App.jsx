import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { VoiceSettingsProvider } from "./contexts/VoiceSettingsContext.jsx";
import { WallpaperProvider } from "./contexts/WallpaperContext.jsx";
import { useVisualViewport } from "./hooks/useVisualViewport.js";
import PwaInstallBanner from "./components/PwaInstallBanner.jsx";
import IosInstallHint from "./components/IosInstallHint.jsx";
import SplashScreen from "./screens/SplashScreen.jsx";
import ChatScreen from "./screens/ChatScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import ProfileSetupScreen from "./screens/ProfileSetupScreen.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import "./App.css";

function AppRoutes() {
  useVisualViewport();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<AuthScreen />} />
        <Route element={<RequireAuth />}>
          <Route path="/setup" element={<ProfileSetupScreen />} />
          <Route path="/profile" element={<AccountProfileScreen />} />
          <Route element={<RequireAuth profile />}>
            <Route path="/chat" element={<AccountChatScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AccountChatScreen() {
  const { user } = useAuth();
  return <ChatScreen key={user.id} />;
}

function AccountProfileScreen() {
  const { user } = useAuth();
  return <ProfileScreen key={user.id} />;
}

export default function App() {
  return (
    <AuthProvider>
    <ThemeProvider>
      <VoiceSettingsProvider>
        <WallpaperProvider>
          <AppRoutes />
          <PwaInstallBanner />
          <IosInstallHint />
        </WallpaperProvider>
      </VoiceSettingsProvider>
    </ThemeProvider>
    </AuthProvider>
  );
}
