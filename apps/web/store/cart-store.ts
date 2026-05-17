import { create } from 'zustand';
import { cartApi, type Cart } from '@/lib/cart-api';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  error: string | null;

  fetchCart: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  setError: (msg: string | null) => void;
}

function emptyCart(): Cart {
  return { id: null, items: [], coupon: null, subtotal: 0, discount: 0, total: 0 };
}

export const useCartStore = create<CartState>()((set) => ({
  cart: null,
  loading: false,
  error: null,

  setError: (msg: string | null) => set({ error: msg }),

  fetchCart: async () => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.getCart();
      set({ cart, loading: false });
    } catch {
      set({ cart: emptyCart(), loading: false });
    }
  },

  addItem: async (variantId: string, quantity: number) => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.addItem(variantId, quantity);
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao adicionar item';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateItem: async (itemId: string, quantity: number) => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.updateItem(itemId, quantity);
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao atualizar item';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  removeItem: async (itemId: string) => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.removeItem(itemId);
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao remover item';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  clearCart: async () => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.clearCart();
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao limpar carrinho';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  applyCoupon: async (code: string) => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.applyCoupon(code);
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cupom inválido';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  removeCoupon: async () => {
    set({ loading: true, error: null });
    try {
      const cart = await cartApi.removeCoupon();
      set({ cart, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao remover cupom';
      set({ loading: false, error: msg });
      throw e;
    }
  },
}));

// Total de itens no carrinho (para badge no header)
export function useCartCount(cart: Cart | null): number {
  return cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
}
