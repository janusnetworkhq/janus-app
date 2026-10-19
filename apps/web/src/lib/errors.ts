export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(opts: { code: string; message: string; status: number; requestId: string }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
  }

  get userMessage(): string {
    if (this.code === "VAULT_DENIED") return "Sign an NDA to view this prototype.";
    if (this.code === "PROFILE_INCOMPLETE") return "Finish onboarding to continue.";
    if (this.code === "UNAUTHORIZED") return "Session expired. Sign in again.";
    if (this.code === "NDA_NOT_ACCEPTED") return "The student has not accepted this NDA yet.";
    if (this.code === "HASH_MISMATCH") return "The agreement text changed. Reload and read it again.";
    if (this.code === "NDA_SIGNED") return "This NDA is already signed.";
    if (this.code === "NAME_REQUIRED") return "Type your legal name to sign.";
    return this.message;
  }
}
