## 2026-10-20 13:17 IST test-students task started
- pattern-based test OTP implemented (config.ts), +8 tests, 49/49 pass
- Aiven dry-run OK (users=3, student_profiles=1, 10 creates). Applying.
- Aiven seed applied: users 3->13, student_profiles 1->11; rerun no-op. Backup JSON in qa-backup/test-students/. Tests 49/49.
- Pushed 8c0584a; Render deploy dep-dbbhtiff3r2c738v3cd0 (same service srv-dbb1mmjncjis73ar3l3g, no env change).
- 13:29 IST  Render dep-dbbhtiff3r2c738v3cd0 live on 8c0584a, /ready ok, URL unchanged (janus-api-zrlc).
- Live verify: qa.student01/05/10 + qa.student: send, then verify 123456 OK, /v1/me STUDENT profileComplete=true with the seeded profile.
- Negative: qa.student01@example.com + 123456 gives INVALID_OTP; verify without a prior send gives OTP_EXPIRED (request-first kept).
