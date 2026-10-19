import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { get, post } from "@/api/client";
import { keys } from "@/api/query";
import type { NdaRequest } from "@/api/types";
import { useMe } from "@/auth/use-me";
import { useTranslation } from "@/i18n";
import { color, font, radius, space } from "@/theme";
import { AppIcon } from "@/ui/AppIcon";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorView } from "@/ui/ErrorView";

export default function InboxScreen() {
  const me = useMe();
  const [tab, setTab] = useState<"received" | "sent">(() =>
    me.data?.role === "RECRUITER" ? "sent" : "received"
  );

  const query = useQuery({
    queryKey: tab === "received" ? keys.ndaInbox : keys.ndaOutbound,
    queryFn: () => get<NdaRequest[]>(tab === "received" ? "/v1/nda/inbox" : "/v1/nda/outbound"),
  });

  if (query.isError) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={styles.title}>File Requests</Text>

      {/* Segmented Control Header */}
      <View style={styles.segmentedContainer}>
        <Pressable
          onPress={() => setTab("received")}
          style={[styles.segmentBtn, tab === "received" && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, tab === "received" && styles.segmentTextActive]}>
            Received
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("sent")}
          style={[styles.segmentBtn, tab === "sent" && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, tab === "sent" && styles.segmentTextActive]}>
            Sent
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {(query.data ?? []).length === 0 ? (
          <EmptyState
            title={tab === "received" ? "No Received Requests" : "No Sent Requests"}
            body={
              tab === "received"
                ? "When someone requests permission to review your confidential files, their request will appear here."
                : "When you request access to other innovators' project files, track their status here."
            }
          />
        ) : (
          (query.data ?? []).map((row) => (
            <NdaRow key={row.id} row={row} isReceived={tab === "received"} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NdaRow({ row, isReceived }: { row: NdaRequest; isReceived: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const decide = useMutation({
    mutationFn: (accept: boolean) => post(`/v1/nda/requests/${row.id}/decide`, { accept }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ndaInbox }),
    onError: (err: Error) => Alert.alert(t("status_error_title"), err.message),
  });

  const who = isReceived
    ? row.recruiter?.displayName ?? (row.recruiter?.handle ? `@${row.recruiter.handle}` : "Requester")
    : row.student?.displayName ?? (row.student?.handle ? `@${row.student.handle}` : "Innovator");
  const org = row.recruiter?.recruiterProfile?.org?.name;

  const statusLabel =
    row.status === "PENDING"
      ? t("inbox_status_pending")
      : row.status === "ACCEPTED"
        ? t("inbox_status_accepted")
        : t("inbox_status_declined");

  const statusBadgeStyle =
    row.status === "ACCEPTED"
      ? styles.statusAccepted
      : row.status === "REJECTED" || row.status === "EXPIRED"
        ? styles.statusDeclined
        : styles.statusPending;

  return (
    <Pressable
      onPress={() => {
        // Already signed: go to the vault instead of re-opening the NDA (re-signing returns 409).
        if (!isReceived && row.status === "ACCEPTED" && row.agreement) router.push(`/vault/${row.studentId}`);
        else if (!isReceived && row.status === "ACCEPTED") router.push(`/nda/${row.id}`);
        if (!isReceived && row.status === "PENDING")
          Alert.alert(t("inbox_waiting_title"), t("inbox_waiting_body"));
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name}>{who}</Text>
        {org ? <Text style={styles.meta}>{org}</Text> : null}
        {row.reason ? (
          <Text style={styles.reasonText} numberOfLines={2}>
            {`"${row.reason}"`}
          </Text>
        ) : null}
        <View style={[styles.statusBadge, statusBadgeStyle]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
      {isReceived && row.status === "PENDING" ? (
        <View style={styles.actions}>
          <Pressable onPress={() => decide.mutate(false)} style={styles.ghost} hitSlop={6}>
            <Text style={styles.ghostText}>{t("inbox_btn_decline")}</Text>
          </Pressable>
          <Pressable onPress={() => decide.mutate(true)} style={styles.ok} hitSlop={6}>
            <Text style={styles.okText}>{t("inbox_btn_accept")}</Text>
          </Pressable>
        </View>
      ) : !isReceived && row.status === "ACCEPTED" ? (
        <AppIcon ios="chevron.right" android="chevron-forward" size={18} color={color.accent} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  title: {
    color: color.text,
    fontSize: 26,
    fontFamily: font.semibold,
    fontWeight: "700",
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    marginHorizontal: space[4],
    marginBottom: space[2],
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: color.surface,
  },
  segmentText: {
    color: color.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  list: { padding: space[4], gap: space[3], paddingBottom: 120 },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
    gap: space[3],
  },
  name: { color: color.text, fontSize: 16, fontWeight: "600" },
  meta: { color: color.textMuted, fontSize: 13 },
  reasonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  statusPending: {
    backgroundColor: "rgba(245, 197, 66, 0.15)",
  },
  statusAccepted: {
    backgroundColor: "rgba(200, 245, 66, 0.15)",
  },
  statusDeclined: {
    backgroundColor: "rgba(249, 112, 102, 0.15)",
  },
  statusText: {
    color: color.text,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actions: { flexDirection: "row", gap: 8 },
  ghost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  ghostText: { color: color.textMuted, fontWeight: "600", fontSize: 13 },
  ok: {
    backgroundColor: color.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  okText: { color: color.accentInk, fontWeight: "700", fontSize: 13 },
});
