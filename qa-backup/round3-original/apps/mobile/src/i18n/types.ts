export type SupportedLanguage =
  | "en"
  | "en-GB"
  | "es"
  | "fr"
  | "de"
  | "hi"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "bn"
  | "mr"
  | "gu";

export type LanguageRegion = "us_uk" | "india";

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string; // English name
  nativeName: string; // Native script name
  flag: string; // Emoji flag or symbol
  region: LanguageRegion;
}

export interface TranslationDictionary {
  // Common / Navigation
  app_name: string;
  tab_feed: string;
  tab_create: string;
  tab_discover: string;
  tab_inbox: string;
  tab_profile: string;
  btn_continue: string;
  btn_cancel: string;
  btn_save: string;
  btn_retry: string;
  btn_back: string;
  btn_edit: string;
  btn_follow: string;
  btn_following: string;
  btn_sign_out: string;
  btn_settings: string;
  status_loading: string;
  status_error_title: string;
  status_error_body: string;

  // Welcome Screen
  welcome_brand: string;
  welcome_tagline: string;
  welcome_description: string;
  welcome_cta_oauth: string;
  welcome_cta_default: string;
  welcome_trust_badge: string;

  // Sign In Screen
  signin_title: string;
  signin_subtitle: string;
  signin_email_label: string;
  signin_email_placeholder: string;
  signin_name_label: string;
  signin_name_placeholder: string;
  signin_btn_submit: string;
  signin_btn_continue: string;
  signin_btn_send_code: string;
  signin_new_user_notice: string;
  signin_error_title: string;
  signin_error_message: string;

  // OTP Screen
  otp_title: string;
  otp_subtitle: string;
  otp_field_placeholder: string;
  otp_btn_verify: string;
  otp_resend_countdown: string;
  otp_resend_btn: string;
  otp_resend_success: string;
  otp_change_email: string;
  otp_error_invalid: string;

  // Onboarding Screen
  onboard_title: string;
  onboard_subtitle: string;
  onboard_student_role: string;
  onboard_student_desc: string;
  onboard_recruiter_role: string;
  onboard_recruiter_desc: string;
  onboard_handle_label: string;
  onboard_handle_placeholder: string;
  onboard_name_label: string;
  onboard_name_placeholder: string;
  onboard_university_label: string;
  onboard_university_placeholder: string;
  onboard_headline_label: string;
  onboard_headline_placeholder: string;
  onboard_city_label: string;
  onboard_city_placeholder: string;
  onboard_org_label: string;
  onboard_org_placeholder: string;
  onboard_orgslug_label: string;
  onboard_orgslug_placeholder: string;
  onboard_jobtitle_label: string;
  onboard_jobtitle_placeholder: string;
  onboard_submit_btn: string;
  onboard_error_title: string;

  // Feed Screen
  feed_empty_title: string;
  feed_empty_body: string;
  feed_sound_tap: string;
  feed_sound_active: string;
  feed_vault_action_recruiter: string;
  feed_vault_action_author: string;
  feed_like_accessibility: string;
  feed_comment_accessibility: string;

  // Discover Screen
  discover_title: string;
  discover_subtitle: string;
  discover_search_placeholder: string;

  // Create Screen
  create_kicker: string;
  create_step_pick_title: string;
  create_step_pick_desc: string;
  create_btn_record: string;
  create_btn_library: string;
  create_step_caption_title: string;
  create_caption_placeholder: string;
  create_step_vault_title: string;
  create_step_vault_desc: string;
  create_btn_attach_vault: string;
  create_btn_publish_direct: string;
  create_status_uploading: string;
  create_status_attaching: string;
  create_status_processing: string;
  create_error_too_long_title: string;
  create_error_too_long_body: string;
  create_error_upload_failed: string;
  create_error_transcode: string;

  // Inbox Screen
  inbox_title_student: string;
  inbox_title_recruiter: string;
  inbox_empty_student_title: string;
  inbox_empty_student_body: string;
  inbox_empty_recruiter_title: string;
  inbox_empty_recruiter_body: string;
  inbox_status_pending: string;
  inbox_status_accepted: string;
  inbox_status_declined: string;
  inbox_btn_accept: string;
  inbox_btn_decline: string;
  inbox_waiting_title: string;
  inbox_waiting_body: string;

  // Profile Screen
  profile_edit_title: string;
  profile_protected_vault: string;
  profile_videos_stat: string;
  profile_empty_demos: string;
  profile_settings_language: string;
  profile_save_error: string;

  // User Profile Screen
  user_btn_request_access: string;
  user_btn_no_vault: string;
  user_btn_open_vault: string;
  user_req_alert_title: string;
  user_req_alert_body: string;
  user_req_error: string;

  // NDA / Agreement Screen
  nda_kicker: string;
  nda_seal_label: string;
  nda_field_legal_name: string;
  nda_field_placeholder: string;
  nda_btn_sign: string;
  nda_scroll_hint: string;
  nda_signed_title: string;
  nda_signed_body: string;
  nda_sign_error: string;
  nda_dialog_title: string;
  nda_dialog_body: string;
  nda_dialog_confirm: string;
  nda_dialog_sent: string;

  // Vault / Protected Asset Screen
  vault_header_title: string;
  vault_empty_title: string;
  vault_empty_body: string;
  vault_denied_title: string;
  vault_denied_body: string;
  vault_btn_open: string;
  asset_viewer_title: string;
  asset_preparing_viewer: string;
  asset_watermark_label: string;

  // Settings Screen
  settings_title: string;
  settings_section_language: string;
  settings_region_us_uk: string;
  settings_region_india: string;
  settings_section_about: string;
  settings_about_desc: string;
  settings_section_security: string;
  settings_security_desc: string;
  settings_section_account: string;
  settings_app_version: string;
  settings_active_language: string;

  // Errors / Missing
  notfound_title: string;
  notfound_back_home: string;
  error_vault_denied: string;
  error_profile_incomplete: string;
  error_unauthorized: string;
  error_nda_not_accepted: string;
  error_nda_expired: string;
}
