import { Tabs } from "expo-router";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { MinimizedTabBar } from "@/ui/MinimizedTabBar";

export default function AppTabs() {
  const me = useMe();
  const { t } = useTranslation();
  const student = me.data?.role === "STUDENT" || me.data?.role === "PLATFORM_ADMIN";

  return (
    <Tabs
      tabBar={(props) => <MinimizedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_feed"),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t("tab_create"),
          href: student ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tab_discover"),
          href: !student ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("tab_inbox"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
        }}
      />
    </Tabs>
  );
}
