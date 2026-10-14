import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type RecentItem = {
  key: string
  kind: "customer" | "car" | "agreement" | "page"
  title: string
  subtitle?: string
  href: string
}

type CommandStore = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  recent: RecentItem[]
  remember: (item: RecentItem) => void
  clearRecent: () => void
}

export const useCommandStore = create<CommandStore>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((state) => ({ open: !state.open })),
      recent: [],
      remember: (item) =>
        set((state) => ({
          recent: [item, ...state.recent.filter((existing) => existing.key !== item.key)].slice(0, 5),
        })),
      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: "sleek-command",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ recent: state.recent }),
    },
  ),
)
