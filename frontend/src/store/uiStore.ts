import { create } from 'zustand';

interface UIState {
  darkMode: boolean;
  sidebarCollapsed: boolean;
  toggleDark: () => void;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  darkMode: true,
  sidebarCollapsed: false,
  toggleDark: () => set(s => ({ darkMode: !s.darkMode })),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar: (v) => set({ sidebarCollapsed: v }),
}));
