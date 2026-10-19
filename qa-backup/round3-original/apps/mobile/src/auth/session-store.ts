import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

const TOKEN_KEY = "janus.accessToken";
const CLAIMS_KEY = "janus.localClaims";

export type LocalClaims = {
  sub: string;
  email?: string;
  phone_number?: string;
  name?: string;
  provider?: string;
};

async function read(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

type SessionState = {
  hydrated: boolean;
  accessToken: string | null;
  localClaims: LocalClaims | null;
  hydrate: () => Promise<void>;
  setSession: (token: string, claims: LocalClaims | null) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  hydrated: false,
  accessToken: null,
  localClaims: null,
  hydrate: async () => {
    const [token, rawClaims] = await Promise.all([read(TOKEN_KEY), read(CLAIMS_KEY)]);
    set({
      hydrated: true,
      accessToken: token,
      localClaims: rawClaims ? (JSON.parse(rawClaims) as LocalClaims) : null,
    });
  },
  setSession: async (token, claims) => {
    await Promise.all([
      write(TOKEN_KEY, token),
      write(CLAIMS_KEY, claims ? JSON.stringify(claims) : null),
    ]);
    set({ accessToken: token, localClaims: claims });
  },
  clearSession: async () => {
    await Promise.all([write(TOKEN_KEY, null), write(CLAIMS_KEY, null)]);
    set({ accessToken: null, localClaims: null });
  },
}));
