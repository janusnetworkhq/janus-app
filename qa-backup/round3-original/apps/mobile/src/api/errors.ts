import { useI18nStore } from "../i18n/store";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(opts: { code: string; message: string; status: number; requestId: string }) {
    super(opts.message);
    this.name = "ApiClientError";
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
  }

  get isVaultDenied(): boolean {
    return this.code === "VAULT_DENIED";
  }

  get userMessage(): string {
    const t = useI18nStore.getState().t;

    if (this.code === "VAULT_DENIED") return t("error_vault_denied");
    if (this.code === "PROFILE_INCOMPLETE") return t("error_profile_incomplete");
    if (this.code === "UNAUTHORIZED") return t("error_unauthorized");
    if (this.code === "NDA_NOT_ACCEPTED") return t("error_nda_not_accepted");
    if (this.code === "NDA_EXPIRED") return t("error_nda_expired");
    return this.message;
  }
}
