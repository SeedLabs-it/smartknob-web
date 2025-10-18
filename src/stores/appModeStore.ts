import { create } from "zustand";
import { AppMode } from "@/components/ModeSelector/ModeSelector";

interface AppModeState {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppModeStore = create<AppModeState>((set) => ({
  currentMode: "configurator",
  setMode: (mode: AppMode) => set({ currentMode: mode }),
}));
