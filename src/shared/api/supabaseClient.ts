import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseEnvConfig {
  url?: string;
  anonKey?: string;
}

export class MissingSupabaseConfigError extends Error {
  constructor(missingKey: string) {
    super(`Supabase設定が不足しています: ${missingKey} が未設定です`);
    this.name = "MissingSupabaseConfigError";
  }
}

export function createSupabaseClient(config: SupabaseEnvConfig): SupabaseClient {
  if (!config.url) {
    throw new MissingSupabaseConfigError("EXPO_PUBLIC_SUPABASE_URL");
  }
  if (!config.anonKey) {
    throw new MissingSupabaseConfigError("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

let cachedClient: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient({
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  }
  return cachedClient;
}
