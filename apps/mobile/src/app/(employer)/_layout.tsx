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

export default function EmployerTabs() {
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
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: icon("grid", "grid-outline") }}
      />
      <Tabs.Screen
        name="shifts"
        options={{ title: "Shifts", tabBarIcon: icon("calendar", "calendar-outline") }}
      />
      <Tabs.Screen
        name="applicants"
        options={{ title: "Applicants", tabBarIcon: icon("people", "people-outline") }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarIcon: icon("chatbubbles", "chatbubbles-outline") }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: icon("ellipsis-horizontal-circle", "ellipsis-horizontal-circle-outline"),
        }}
      />
    </Tabs>
  );
}
