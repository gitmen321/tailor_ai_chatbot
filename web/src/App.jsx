import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { VoiceSettingsProvider } from "./contexts/VoiceSettingsContext.jsx";
import { WallpaperProvider } from "./contexts/WallpaperContext.jsx";
import { useVisualViewport } from "./hooks/useVisualViewport.js";
import SplashScreen from "./screens/SplashScreen.jsx";
import ChatScreen from "./screens/ChatScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import "./App.css";

function AppRoutes() {
  useVisualViewport();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <VoiceSettingsProvider>
        <WallpaperProvider>
          <AppRoutes />
        </WallpaperProvider>
      </VoiceSettingsProvider>
    </ThemeProvider>
  );
}
