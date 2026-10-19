import { Alert } from "react-native";
import { post } from "../api/client";
import { newIdempotencyKey } from "../auth/actions";
import { useI18nStore } from "../i18n/store";

export function requestNda(studentId: string, videoId?: string): void {
  const t = useI18nStore.getState().t;

  Alert.alert(
    t("nda_dialog_title"),
    t("nda_dialog_body"),
    [
      { text: t("btn_cancel"), style: "cancel" },
      {
        text: t("nda_dialog_confirm"),
        onPress: () => {
          void post("/v1/nda/requests", { studentId, videoId }, { idempotencyKey: newIdempotencyKey() })
            .then(() => Alert.alert(t("user_req_alert_title"), t("nda_dialog_sent")))
            .catch((err: Error) => Alert.alert(t("user_req_error"), err.message));
        },
      },
    ]
  );
}
