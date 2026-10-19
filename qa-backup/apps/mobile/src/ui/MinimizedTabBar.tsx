import { memo, type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { color, font } from "../theme";
import { AppIcon } from "./AppIcon";
import { useTabBarStore } from "./tab-bar-store";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export const MinimizedTabBar = memo(function MinimizedTabBar({
  state,
  descriptors,
  navigation,
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const minimized = useTabBarStore((s) => s.minimized);
  const setMinimized = useTabBarStore((s) => s.setMinimized);

  const bottomMargin = Math.max(insets.bottom, Platform.OS === "ios" ? 14 : 10);

  // Filter out any screens configured with href: null
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return (options as { href?: string | null }).href !== null;
  });

  return (
    <View
      style={[
        styles.wrapper,
        { bottom: bottomMargin },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          if (minimized) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMinimized(false);
          }
        }}
        style={[
          styles.pill,
          minimized
            ? [styles.pillMinimized, { width: Math.min(180, width * 0.46) }]
            : [styles.pillNormal, { width: Math.min(360, width - 40) }],
        ]}
      >
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.key === route.key;

          const onPress = () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (minimized) setMinimized(false);

            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const label =
            options.tabBarLabel !== undefined
              ? String(options.tabBarLabel)
              : options.title !== undefined
                ? String(options.title)
                : route.name;

          const iconProps = getIconForRoute(route.name, isFocused);

          if (minimized) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.minimizedTabItem}
                hitSlop={8}
              >
                <AppIcon
                  ios={iconProps.ios}
                  android={iconProps.android}
                  size={14}
                  color={isFocused ? color.accent : "rgba(255,255,255,0.4)"}
                />
                {isFocused ? <View style={styles.activeDot} /> : null}
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              hitSlop={6}
            >
              <AppIcon
                ios={iconProps.ios}
                android={iconProps.android}
                size={20}
                color={isFocused ? color.accent : color.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? color.accent : color.textMuted },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </Pressable>
    </View>
  );
});

function getIconForRoute(
  routeName: string,
  focused: boolean
): { ios: Parameters<typeof AppIcon>[0]["ios"]; android: Parameters<typeof AppIcon>[0]["android"] } {
  switch (routeName) {
    case "index":
      return {
        ios: focused ? "play.rectangle.fill" : "play.rectangle",
        android: focused ? "play-circle" : "play-circle-outline",
      };
    case "create":
      return {
        ios: focused ? "plus.circle.fill" : "plus.circle",
        android: focused ? "add-circle" : "add-circle-outline",
      };
    case "discover":
      return {
        ios: "magnifyingglass",
        android: "search",
      };
    case "inbox":
      return {
        ios: focused ? "tray.fill" : "tray",
        android: focused ? "mail" : "mail-outline",
      };
    case "profile":
      return {
        ios: focused ? "person.fill" : "person",
        android: focused ? "person" : "person-outline",
      };
    default:
      return {
        ios: "circle.grid.2x2",
        android: "grid-outline",
      };
  }
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(18, 22, 28, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  pillNormal: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 8,
  },
  pillMinimized: {
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: "rgba(18, 22, 28, 0.75)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: font.semibold,
    fontWeight: "600",
  },
  minimizedTabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    flexDirection: "row",
    gap: 3,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: color.accent,
  },
});
