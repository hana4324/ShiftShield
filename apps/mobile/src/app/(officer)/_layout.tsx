import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors, fontFamily } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function icon(active: IconName, inactive: IconName) {
  const TabIcon = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons
      name={focused ? active : inactive}
      size={24}
      color={typeof color === "string" ? color : colors.steel400}
    />
  );
  TabIcon.displayName = `TabIcon(${active})`;
  return TabIcon;
}

export default function OfficerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue600,
        tabBarInactiveTintColor: colors.steel400,
        tabBarStyle: {
          backgroundColor: colors.navy950,
          borderTopColor: colors.borderOnDark,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.navy950 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="my-shifts"
        options={{ title: "My Shifts", tabBarIcon: icon("calendar", "calendar-outline") }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", tabBarIcon: icon("wallet", "wallet-outline") }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarIcon: icon("chatbubbles", "chatbubbles-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon("person-circle", "person-circle-outline") }}
      />
    </Tabs>
  );
}
