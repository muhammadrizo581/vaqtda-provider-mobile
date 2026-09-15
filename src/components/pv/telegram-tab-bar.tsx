import type { Tabs } from "expo-router";
import React, { useEffect, useState, type ComponentProps } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { alpha } from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export type TelegramTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export function TelegramTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: TelegramTabBarProps) {
  const { scheme, colors } = useTheme();
  const isDark = scheme === "dark";
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  // Telegram Android uslubida: inaktiv ikonka va matnlar qorong'i fonda toza oq / yorqin
  const inactiveIconColor = isDark ? "#ffffff" : colors.onSurfaceVariant;
  const inactiveTextColor = isDark ? "#ffffff" : colors.onSurfaceVariant;

  // insets.bottom 3-button navigatsiyada ~48dp, gesture'da ~16dp
  const bottomMargin = insets.bottom > 0 ? insets.bottom + 8 : 14;

  return (
    <View pointerEvents="box-none" style={[styles.outerWrapper, { bottom: bottomMargin }]}>
      <View style={styles.floatingShadow}>
        <View
          style={[
            styles.pillContainer,
            {
              backgroundColor: isDark
                ? colors.surfaceContainerHighest
                : colors.surface,
              borderColor: isDark
                ? alpha("#ffffff", 0.08)
                : alpha(colors.outlineVariant, 0.6),
            },
          ]}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];

            // href: null yoki display: 'none' bo'lgan tablarni yashirish (masalan, waitlist / queue)
            if (
              (options as { href?: string | null }).href === null ||
              (options.tabBarItemStyle as any)?.display === "none"
            ) {
              return null;
            }

            const isFocused = state.index === index;

            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const badge = options.tabBarBadge;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const iconColor = isFocused ? colors.primary : inactiveIconColor;
            const textColor = isFocused ? colors.primary : inactiveTextColor;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                android_ripple={{
                  color: alpha(colors.primary, 0.15),
                  borderless: true,
                  radius: 28,
                }}
                style={styles.tabItem}
              >
                {/* Telegramdagi kabi butun tab (ikonka + matn) birlashgan oval kapsula */}
                <View
                  style={[
                    styles.tabPill,
                    isFocused && {
                      backgroundColor: isDark
                        ? alpha(colors.primary, 0.24)
                        : alpha(colors.primary, 0.14),
                    },
                  ]}
                >
                  <View style={styles.iconContainer}>
                    {options.tabBarIcon?.({
                      focused: isFocused,
                      color: iconColor,
                      size: 21,
                    })}
                    {badge != null && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: colors.primary },
                          options.tabBarBadgeStyle as any,
                        ]}
                      >
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      { color: textColor },
                      isFocused && styles.labelActive,
                    ]}
                  >
                    {typeof label === "string" ? label : route.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 64,
    zIndex: 100,
  },
  floatingShadow: {
    flex: 1,
    borderRadius: 32,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  pillContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabPill: {
    height: 52,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 12,
  },
});
