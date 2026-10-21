import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ShiftCard } from "@/components/ShiftCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChoiceChips } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen, ScreenTitle } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ShiftStatus } from "@/lib/demo-data";
import { bookedCount, siteOf, useDemoStore } from "@/store/demo-store";

type Tab = "active" | "drafts" | "past";

const activeStatuses: ShiftStatus[] = ["open", "filled", "in_progress"];

export default function EmployerShifts() {
  const [tab, setTab] = useState<Tab>("active");
  const shifts = useDemoStore((s) => s.shifts);
  const sites = useDemoStore((s) => s.sites);
  const assignments = useDemoStore((s) => s.assignments);
  const siteFilter = useDemoStore((s) => s.selectedSiteFilter);

  const visible = shifts.filter((s) => (siteFilter ? s.siteId === siteFilter : true));
  const list = visible
    .filter((s) =>
      tab === "active"
        ? activeStatuses.includes(s.status)
        : tab === "drafts"
          ? s.status === "draft"
          : s.status === "completed" || s.status === "cancelled",
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <Screen tone="dark">
      <ScreenTitle
        title="Shifts"
        subtitle={siteFilter ? siteOf(sites, siteFilter).name : "All locations"}
      />
      <ChoiceChips<Tab>
        options={[
          { value: "active", label: "Active" },
          { value: "drafts", label: "Drafts" },
          { value: "past", label: "Past" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <PrimaryButton
        title="Post New Shift"
        size="md"
        onPress={() => router.push("/employer/post-shift")}
      />
      <View style={{ gap: 10 }}>
        {list.length === 0 ? (
          <EmptyState
            tone="dark"
            icon="calendar-outline"
            title={
              tab === "drafts"
                ? "No drafts"
                : tab === "past"
                  ? "No past shifts"
                  : "No active shifts"
            }
            body="Shifts you post show up here with their fill status."
          />
        ) : (
          list.map((shift) => {
            const site = siteOf(sites, shift.siteId);
            const booked = bookedCount(assignments, shift.id);
            return (
              <ShiftCard
                key={shift.id}
                shift={shift}
                site={site}
                onPress={() => router.push({ pathname: "/shift/[id]", params: { id: shift.id } })}
                trailing={
                  <StatusBadge
                    status={shift.status}
                    label={
                      shift.status === "open"
                        ? booked > 0
                          ? `${booked}/${shift.officersNeeded} booked`
                          : "Searching"
                        : undefined
                    }
                    size="sm"
                  />
                }
              />
            );
          })
        )}
      </View>
    </Screen>
  );
}
