import { create } from 'zustand';
import type { ActionType } from '../../../core/model/actions.ts';
import type { IndustryType } from '../../../core/model/types.ts';

/**
 * UI-only state machine for the guided action flow (§7.13). It records the
 * player's step-by-step choices (action → card → target → variant → confirm)
 * and is shared between the Action Bar panel and the board (board clicks feed
 * `pickLocation` / `pickLine`). It never touches the pure GameState; the chosen
 * selection is turned into a single concrete engine Action only on confirm.
 */
export interface FlowSel {
  actionType: ActionType | null;
  cardId: string | null;
  /** Build target / sell-tile location (chosen by clicking the board). */
  locationId: string | null;
  industry: IndustryType | null;
  slotId: string | null;
  merchantId: string | null;
  /** Network: the link line(s) selected (1, or 2 in the Rail Era). */
  lineIds: string[];
  /** Develop: the 1–2 industries to remove. */
  removals: IndustryType[];
  /** Scout: the two extra cards to discard. */
  discardIds: string[];
}

interface FlowStore extends FlowSel {
  start: (type: ActionType) => void;
  chooseCard: (cardId: string) => void;
  pickLocation: (id: string) => void;
  pickLine: (id: string) => void;
  chooseVariant: (industry: IndustryType, slotId: string) => void;
  chooseMerchant: (id: string) => void;
  toggleRemoval: (industry: IndustryType) => void;
  toggleDiscard: (cardId: string) => void;
  back: () => void;
  reset: () => void;
}

const EMPTY: FlowSel = {
  actionType: null,
  cardId: null,
  locationId: null,
  industry: null,
  slotId: null,
  merchantId: null,
  lineIds: [],
  removals: [],
  discardIds: [],
};

export const useFlow = create<FlowStore>((set, get) => ({
  ...EMPTY,

  start(type) {
    set({ ...EMPTY, actionType: type });
  },

  chooseCard(cardId) {
    set({ cardId });
  },

  pickLocation(id) {
    // Toggle off if clicking the already-chosen location.
    set((s) => ({ locationId: s.locationId === id ? null : id, industry: null, slotId: null }));
  },

  pickLine(id) {
    set((s) => {
      if (s.lineIds.includes(id)) return { lineIds: s.lineIds.filter((l) => l !== id) };
      if (s.lineIds.length >= 2) return {};
      return { lineIds: [...s.lineIds, id] };
    });
  },

  chooseVariant(industry, slotId) {
    set({ industry, slotId });
  },

  chooseMerchant(id) {
    set({ merchantId: id });
  },

  toggleRemoval(industry) {
    set((s) => {
      if (s.removals.includes(industry)) {
        return { removals: s.removals.filter((i) => i !== industry) };
      }
      if (s.removals.length >= 2) return { removals: [s.removals[0]!, industry] };
      return { removals: [...s.removals, industry] };
    });
  },

  toggleDiscard(cardId) {
    set((s) => {
      if (s.discardIds.includes(cardId)) {
        return { discardIds: s.discardIds.filter((c) => c !== cardId) };
      }
      if (s.discardIds.length >= 2) return { discardIds: [s.discardIds[1]!, cardId] };
      return { discardIds: [...s.discardIds, cardId] };
    });
  },

  back() {
    const s = get();
    if (s.actionType === 'BUILD') {
      if (s.industry || s.slotId) {
        set({ industry: null, slotId: null });
        return;
      }
      if (s.locationId) {
        set({ locationId: null });
        return;
      }
    } else if (s.actionType === 'NETWORK') {
      if (s.lineIds.length) {
        set({ lineIds: s.lineIds.slice(0, -1) });
        return;
      }
    } else if (s.actionType === 'SELL') {
      if (s.merchantId) {
        set({ merchantId: null });
        return;
      }
      if (s.locationId) {
        set({ locationId: null });
        return;
      }
    } else if (s.actionType === 'DEVELOP') {
      if (s.removals.length) {
        set({ removals: s.removals.slice(0, -1) });
        return;
      }
    } else if (s.actionType === 'SCOUT') {
      if (s.discardIds.length) {
        set({ discardIds: s.discardIds.slice(0, -1) });
        return;
      }
    }
    if (s.cardId) {
      set({
        cardId: null,
        locationId: null,
        industry: null,
        slotId: null,
        merchantId: null,
        lineIds: [],
        removals: [],
        discardIds: [],
      });
      return;
    }
    set({ actionType: null });
  },

  reset() {
    set({ ...EMPTY });
  },
}));
