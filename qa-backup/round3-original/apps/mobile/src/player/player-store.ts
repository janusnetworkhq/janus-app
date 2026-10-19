import { create } from "zustand";

type PlayerState = {
  activeId: string | null;
  muted: boolean;
  university: string;
  setActiveId: (id: string | null) => void;
  toggleMute: () => void;
  setUniversity: (value: string) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  activeId: null,
  muted: true,
  university: "",
  setActiveId: (id) => set({ activeId: id }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setUniversity: (university) => set({ university }),
}));
