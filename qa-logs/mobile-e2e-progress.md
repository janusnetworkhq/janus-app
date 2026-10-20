# Mobile E2E + APK progress log (live API https://janus-api-zrlc.onrender.com, OTP mode)

## Milestones
- 08:14 IST  apps/mobile had the user's uncommitted work. Took a tgz backup (qa-backup/mobile-prod/), made a verbatim snapshot commit c773975 on new branch `prod-otp-config`. master (e449ee7) untouched.
- 08:2x  Prod config: EXPO_PUBLIC_API_URL=live, EXPO_PUBLIC_AUTH_MODE=otp; dev-token login gated to __DEV__ + local mode; eas.json preview = internal APK with prod env; app.json JANUS/janus/app.janus.mobile v1.0.0, versionCode 1, splash.
- 08:3x  Drawn SignaturePad (react-native-signature-canvas) on NDA sign, sends signaturePngBase64.
- 08:4x  Bug: create sent vaultKind "OTHER" (API 400). Fixed via vaultKindFor(). Bug: retry duplicated the post. Fixed (uploadedVideoId ref). The partial duplicate was soft-deleted.
- 08:5x  REAL ffmpeg mp4 (simctl addmedia) went to Cloudinary, video cmvg40j6i… READY, plus vault PDF cmvg40xs5… (DOCUMENT).
- 08:58  Bug: Profile showed "No showcases" while loading. Fixed (spinner + invalidate user-videos after publish).
- 08:5x  Settings/language (EN->HI->EN), student sign-out, recruiter OTP login, discover, profile+follow, NDA request, recruiter notifications: PASS.
- 09:05  Mobile commits: 0ec0adc (prod config/OTP), f221bb9 (signature pad), 60d9b9d (fixes).
- APK: EAS not logged in; no Android SDK / JDK 17; ~270 MB free disk. Blocked (see report).
