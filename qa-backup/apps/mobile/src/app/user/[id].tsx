import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { get, post } from "@/api/client";
import { keys } from "@/api/query";
import type { FeedPage, PublicCard } from "@/api/types";
import { useMe } from "@/auth/use-me";
import { newIdempotencyKey } from "@/auth/actions";
import { useTranslation } from "@/i18n";
import { ProfileHeader } from "@/profile/ProfileHeader";
import { color, space } from "@/theme";
import { ErrorView } from "@/ui/ErrorView";
import { Button } from "@/ui/Button";

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const { t } = useTranslation();
  const card = useQuery({ queryKey: keys.user(id), queryFn: () => get<PublicCard>(`/v1/users/${id}`) });
  const videos = useQuery({
    queryKey: keys.userVideos(id),
    queryFn: () => get<FeedPage>(`/v1/users/${id}/videos`),
  });
  const follow = useMutation({
    mutationFn: () => post(`/v1/users/${id}/follow`),
    onError: (err: Error) => Alert.alert(t("status_error_title"), err.message),
  });

  if (card.isError) return <ErrorView error={card.error} />;
  const user = card.data;
  if (!user) return null;

  const recruiter = me.data?.role === "RECRUITER";

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 48 }}>
      <ProfileHeader
        displayName={user.displayName}
        handle={user.handle}
        headline={user.student?.headline}
        university={user.student?.university}
        city={user.student?.city}
        orgName={user.recruiter?.org?.name}
        title={user.recruiter?.title}
        hasVault={user.hasVault}
        videoCount={videos.data?.items.length ?? user.videoCount}
        onFollow={user.id === me.data?.id ? undefined : () => follow.mutate()}
      />
      {recruiter && user.role === "STUDENT" ? (
        <Button
          label={user.hasVault ? t("user_btn_request_access") : t("user_btn_no_vault")}
          disabled={!user.hasVault}
          onPress={() => {
            void post("/v1/nda/requests", { studentId: user.id }, { idempotencyKey: newIdempotencyKey() })
              .then(() => Alert.alert(t("user_req_alert_title"), t("user_req_alert_body")))
              .catch((err: Error) => Alert.alert(t("user_req_error"), err.message));
          }}
          style={{ marginHorizontal: space[4], marginTop: space[3] }}
        />
      ) : null}
      {recruiter && user.hasVault ? (
        <Button
          label={t("user_btn_open_vault")}
          variant="surface"
          onPress={() => router.push(`/vault/${user.id}`)}
          style={{ marginHorizontal: space[4], marginTop: space[3] }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
});
