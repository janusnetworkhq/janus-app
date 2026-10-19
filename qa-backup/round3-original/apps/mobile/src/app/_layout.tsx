import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as ScreenOrientation from "expo-screen-orientation";
import { ApiClientError } from "@/api/errors";
import { queryClient } from "@/api/query";
import { signOut } from "@/auth/actions";
import { useSessionStore } from "@/auth/session-store";
import { useMe } from "@/auth/use-me";
import { useI18nStore } from "@/i18n";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void ScreenOrientation.unlockAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <RootNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const hydrated = useSessionStore((s) => s.hydrated);
  const token = useSessionStore((s) => s.accessToken);
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrateI18n = useI18nStore((s) => s.hydrate);
  const i18nHydrated = useI18nStore((s) => s.hydrated);
  const me = useMe();

  useEffect(() => {
    void hydrate();
    void hydrateI18n();
  }, [hydrate, hydrateI18n]);

  useEffect(() => {
    if (me.error instanceof ApiClientError && me.error.status === 401) {
      void signOut();
    }
  }, [me.error]);

  useEffect(() => {
    const waitingOnMe = Boolean(token) && me.isPending;
    if (hydrated && i18nHydrated && !waitingOnMe) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated, i18nHydrated, token, me.isPending]);

  if (!hydrated || !i18nHydrated) return null;
  if (token && me.isPending) return null;

  const signedIn = Boolean(token);
  const ready = signedIn && me.data?.profileComplete === true;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: "fade" }}>
      <Stack.Protected guard={!ready}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="user/[id]" options={{ animation: "slide_from_right", headerShown: true, headerBackTitle: "Back", title: "", headerTintColor: color.text, headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false }} />
        <Stack.Screen name="nda/[id]" options={{ animation: "slide_from_bottom", presentation: "modal", headerShown: true, headerBackTitle: "Back", title: "NDA", headerTintColor: color.text, headerStyle: { backgroundColor: color.bg } }} />
        <Stack.Screen name="vault/[studentId]" options={{ animation: "slide_from_right", headerShown: true, headerBackTitle: "Back", title: "Vault", headerTintColor: color.text, headerStyle: { backgroundColor: color.bg } }} />
        <Stack.Screen name="asset/[id]" options={{ animation: "fade", headerShown: true, headerBackTitle: "Back", title: "Prototype", headerTintColor: color.text, headerStyle: { backgroundColor: "#000" } }} />
      </Stack.Protected>
      {/* Declared last so it is never picked as the initial route when signed out. */}
      <Stack.Screen
        name="settings"
        options={{
          animation: "slide_from_right",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
