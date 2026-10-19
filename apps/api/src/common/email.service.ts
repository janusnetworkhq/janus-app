import { Injectable, Logger } from "@nestjs/common";
import { appConfig } from "./config";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendOtp(opts: {
    to: string;
    code: string;
    name?: string;
  }): Promise<{ success: boolean; id?: string }> {
    const greeting = opts.name ? `Hi ${opts.name},` : "Hello,";

    if (!appConfig.resendApiKey) {
      this.logger.log(
        `\n=======================================================\n` +
          `[EmailService] Verification Code for ${opts.to}: [ ${opts.code} ]\n` +
          `(Set RESEND_API_KEY to send real emails)\n` +
          `=======================================================\n`,
      );
      return { success: true, id: `local-dev-${Date.now()}` };
    }

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0D10; color: #F4F1EA; margin: 0; padding: 40px 20px; }
            .container { max-width: 480px; margin: 0 auto; background-color: #14181F; border: 1px solid #2A3340; border-radius: 14px; padding: 32px; }
            .brand { color: #C8F542; font-size: 16px; font-weight: 700; letter-spacing: 3px; margin-bottom: 24px; }
            h1 { font-size: 22px; margin-top: 0; color: #F4F1EA; }
            p { font-size: 15px; line-height: 1.5; color: #9AA3B2; margin: 16px 0; }
            .otp-box { background-color: #1C222C; border: 1px solid #C8F542; border-radius: 10px; padding: 18px; text-align: center; margin: 28px 0; }
            .otp-code { font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #C8F542; }
            .footer { font-size: 12px; color: #6C768A; margin-top: 32px; border-top: 1px solid #2A3340; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="brand">JANUS</div>
            <h1>Your Verification Code</h1>
            <p>${greeting}</p>
            <p>Use the 6-digit verification code below to sign in to your Janus account. This code is valid for 10 minutes.</p>
            <div class="otp-box">
              <span class="otp-code">${opts.code}</span>
            </div>
            <p>If you did not request this verification code, please ignore this email.</p>
            <div class="footer">
              Janus · Showcasing Innovation, Protecting Intellectual Property.
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appConfig.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: appConfig.resendFromEmail,
          to: [opts.to],
          subject: `${opts.code} is your Janus verification code`,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Resend API error (${response.status}): ${errorText}`);
        // Log locally so user/developer is never blocked even if Resend limits hit
        this.logger.warn(`[Fallback] OTP for ${opts.to}: [ ${opts.code} ]`);
      } else {
        const data = (await response.json()) as { id?: string };
        this.logger.log(`Resend dispatched email to ${opts.to}, id: ${data.id}`);
        return { success: true, id: data.id };
      }
      return { success: true };
    } catch (err) {
      this.logger.error(`Failed to send email via Resend: ${err instanceof Error ? err.message : String(err)}`);
      this.logger.warn(`[Fallback] OTP for ${opts.to}: [ ${opts.code} ]`);
      return { success: true };
    }
  }

  /** Transactional notification email. Falls back to the dev log when Resend is not configured. */
  async sendNotification(opts: { to: string; subject: string; text: string }): Promise<{ success: boolean; id?: string }> {
    if (!appConfig.resendApiKey) {
      this.logger.log(`[EmailService] Notification to ${opts.to}: ${opts.subject} — ${opts.text}`);
      return { success: true, id: `local-dev-${Date.now()}` };
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${appConfig.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: appConfig.resendFromEmail,
          to: [opts.to],
          subject: opts.subject,
          text: `${opts.text}\n\n— Janus`,
        }),
      });
      if (!response.ok) {
        this.logger.error(`Resend API error (${response.status}): ${await response.text()}`);
        return { success: false };
      }
      const data = (await response.json()) as { id?: string };
      return { success: true, id: data.id };
    } catch (err) {
      this.logger.error(`Resend notification failed: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false };
    }
  }
}
