import { create } from "zustand";

type TabBarStore = {
  minimized: boolean;
  setMinimized: (val: boolean) => void;
};

export const useTabBarStore = create<TabBarStore>((set) => ({
  minimized: false,
  setMinimized: (minimized) => set({ minimized }),
}));
