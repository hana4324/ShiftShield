import { Ionicons } from "@expo/vector-icons";
import { PLANS, formatLeadTime } from "@shiftshield/shared/constants";
import {
  computeShiftCost,
  formatCents,
  formatDuration,
  resolveShiftWindow,
} from "@shiftshield/shared/money";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { CheckList, ChoiceChips, TextField, ToggleRow } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { nowMs } from "@/lib/format";
import { useDemoStore, type ShiftDraft } from "@/store/demo-store";
import { colors, fontFamily } from "@/theme";

const TZ = "America/Chicago";
const REQUIREMENT_OPTIONS = [
  { value: "Own transportation", label: "Own transportation" },
  { value: "Minimum age 21", label: "Minimum age 21" },
  { value: "Black uniform (polo + pants)", label: "Black uniform (polo + pants)" },
  { value: "Business attire", label: "Business attire" },
  { value: "Radio / flashlight provided", label: "Radio / flashlight provided" },
];

function todayLocal(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export default function PostShiftScreen() {
  const sites = useDemoStore((s) => s.sites);
  const saveShift = useDemoStore((s) => s.saveShift);
  const plan = PLANS.find((p) => p.code === DEMO_COMPANY.plan)!;

  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [title, setTitle] = useState("Night Security");
  const [date, setDate] = useState(todayLocal(1));
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("06:00");
  const [rate, setRate] = useState("26.00");
  const [needed, setNeeded] = useState("1");
  const [level, setLevel] = useState<"2" | "3" | "4">("2");
  const [armed, setArmed] = useState(false);
  const [reqs, setReqs] = useState<string[]>(["Own transportation", "Minimum age 21"]);
  const [customReq, setCustomReq] = useState("");
  const [description, setDescription] = useState("");
  const [fillMode, setFillMode] = useState<"review" | "auto">("review");
  const [urgent, setUrgent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const window = useMemo(() => {
    try {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d{2}:\d{2}$/.test(start) ||
        !/^\d{2}:\d{2}$/.test(end)
      )
        return null;
      return resolveShiftWindow(date, start, end, TZ);
    } catch {
      return null;
    }
  }, [date, start, end]);

  const rateCents = Math.round(Number(rate) * 100);
  const officers = Math.max(1, Math.floor(Number(needed) || 1));
  const cost =
    window && Number.isFinite(rateCents) && rateCents > 0
      ? computeShiftCost({
          hourlyRateCents: rateCents,
          minutes: window.minutes,
          feeBps: plan.feeBps,
          officersNeeded: officers,
        })
      : null;
  const leadOk = window
    ? window.startAt.getTime() - nowMs() >= plan.minLeadTimeMinutes * 60_000
    : true;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the shift a title";
    if (!window) e.date = "Use YYYY-MM-DD and HH:MM (24h)";
    if (!(rateCents > 0)) e.rate = "Enter an hourly rate";
    if (rateCents > 0 && rateCents < 1200) e.rate = "Rate seems low for a licensed officer";
    if (!leadOk)
      e.date = `${plan.name} requires ${formatLeadTime(plan.minLeadTimeMinutes)} lead time. Upgrade to Enterprise to post any time.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (publish: boolean) => {
    if (!validate() || !window) return;
    const draft: ShiftDraft = {
      siteId,
      title: title.trim(),
      description: description.trim(),
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      hourlyRateCents: rateCents,
      officersNeeded: officers,
      requiredLicenseLevel: Number(level) as 2 | 3 | 4,
      armedRequired: armed || level !== "2",
      requirementLabels: [...reqs, ...(customReq.trim() ? [customReq.trim()] : [])],
      fillMode,
      isUrgent: urgent,
    };
    const id = saveShift(draft, publish);
    if (publish) {
      Alert.alert(
        "Shift published",
        "Qualified officers within range are being notified now. Pro shifts go out first.",
        [
          {
            text: "View shift",
            onPress: () => router.replace({ pathname: "/shift/[id]", params: { id } }),
          },
        ],
      );
    } else {
      Alert.alert("Draft saved", "Find it under Shifts > Drafts.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  return (
    <Screen
      title="Post New Shift"
      back
      footer={
        <View style={styles.footer}>
          <PrimaryButton title="Save draft" variant="outline" onPress={() => submit(false)} />
          <PrimaryButton
            title="Publish"
            style={{ flex: 1 }}
            onPress={() => submit(true)}
            icon={<Ionicons name="megaphone" size={18} color={colors.white} />}
          />
        </View>
      }
    >
      <ChoiceChips
        label="Site"
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        value={siteId}
        onChange={setSiteId}
      />
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Night Security, Front Desk Officer..."
        error={errors.title}
      />
      <View style={styles.row3}>
        <TextField
          label="Date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1.4 }}
        />
        <TextField
          label="Start"
          value={start}
          onChangeText={setStart}
          placeholder="22:00"
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1 }}
        />
        <TextField
          label="End"
          value={end}
          onChangeText={setEnd}
          placeholder="06:00"
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1 }}
        />
      </View>
      {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
      {window ? (
        <Text style={styles.hint}>
          {formatDuration(window.minutes)}
          {window.crossesMidnight ? " · overnight, ends next day" : ""} · site time (Central)
        </Text>
      ) : null}
      <View style={styles.row3}>
        <TextField
          label="Hourly rate"
          prefix="$"
          value={rate}
          onChangeText={setRate}
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
          error={errors.rate}
          hint="You set it"
        />
        <TextField
          label="Officers needed"
          value={needed}
          onChangeText={setNeeded}
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
      </View>
      <ChoiceChips<"2" | "3" | "4">
        label="Required license level"
        options={[
          { value: "2", label: "Level II (unarmed)" },
          { value: "3", label: "Level III (armed)" },
          { value: "4", label: "Level IV (PPO)" },
        ]}
        value={level}
        onChange={setLevel}
      />
      <ToggleRow
        label="Armed post"
        description="Requires a Level III commission"
        value={armed || level !== "2"}
        onChange={setArmed}
      />
      <CheckList
        label="Requirements checklist"
        options={REQUIREMENT_OPTIONS}
        values={reqs}
        onToggle={(v) => setReqs((r) => (r.includes(v) ? r.filter((x) => x !== v) : [...r, v]))}
      />
      <TextField
        label="Custom requirement"
        value={customReq}
        onChangeText={setCustomReq}
        placeholder="e.g. Bilingual Spanish"
        hint="optional"
      />
      <TextField
        label="Description / post orders"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="What the officer needs to know before arriving"
      />
      <ChoiceChips<"review" | "auto">
        label="Fill mode"
        options={[
          { value: "review", label: "Review applicants" },
          { value: "auto", label: "Auto-accept first qualified" },
        ]}
        value={fillMode}
        onChange={setFillMode}
      />
      <ToggleRow
        label="Urgent"
        description="Also sends SMS alerts to nearby officers"
        value={urgent}
        onChange={setUrgent}
      />

      <Card>
        <Text style={styles.costTitle}>Cost before you publish</Text>
        {cost ? (
          <>
            <Line
              label={`Officer pay (${officers} × ${formatDuration(window!.minutes)} × ${formatCents(rateCents)}/hr)`}
              value={formatCents(cost.totalOfficerPayCents)}
            />
            <Line
              label={`Platform fee (${plan.feeBps / 100}% on ${plan.name})`}
              value={formatCents(cost.totalPlatformFeeCents)}
            />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total charged on confirmation</Text>
              <Text style={styles.totalValue}>{formatCents(cost.totalCents)}</Text>
            </View>
            <Text style={styles.hint}>
              Officers receive exactly {formatCents(cost.officerPayCents)} each. Held on your card
              when an officer is confirmed, released after you approve the timesheet.
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>Enter a valid date, time and rate to see the total.</Text>
        )}
      </Card>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row3: { flexDirection: "row", gap: 10 },
  hint: {
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -6,
  },
  error: { color: colors.red, fontFamily: fontFamily.medium, fontSize: 13, marginTop: -6 },
  costTitle: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 16, marginBottom: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  lineLabel: {
    flex: 1,
    color: colors.textMutedOnLight,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  lineValue: { color: colors.navy950, fontFamily: fontFamily.semibold, fontSize: 14 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 1,
    borderTopColor: colors.borderOnLight,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  totalLabel: { color: colors.navy950, fontFamily: fontFamily.bold, fontSize: 14 },
  totalValue: {
    color: colors.navy950,
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  footer: { flexDirection: "row", gap: 10 },
});
