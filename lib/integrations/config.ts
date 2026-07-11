export type IntegrationProvider = "resend" | "smtp" | "twilio" | "whatsapp-meta" | "meta" | "openai" | "none";

export type InboxChannel = "all" | "whatsapp" | "gmail" | "email" | "sms" | "instagram";

export type IntegrationStatus = {
  email: { configured: boolean; provider: IntegrationProvider; fromEmail: string | null };
  gmail: { configured: boolean; provider: IntegrationProvider };
  sms: { configured: boolean; provider: IntegrationProvider };
  whatsapp: { configured: boolean; provider: IntegrationProvider };
  instagram: { configured: boolean; provider: IntegrationProvider };
  ai: { configured: boolean; provider: IntegrationProvider; model: string | null };
  payments: { configured: boolean; provider: string | null };
};

export function getIntegrationStatus(): IntegrationStatus {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const gmailClientId = process.env.GMAIL_CLIENT_ID?.trim();
  const gmailRefresh = process.env.GMAIL_REFRESH_TOKEN?.trim();
  const instagramToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const instagramPageId = process.env.INSTAGRAM_PAGE_ID?.trim();

  const emailConfigured = Boolean(resendKey || (smtpHost && process.env.SMTP_USER && process.env.SMTP_PASS));
  const gmailConfigured = Boolean(gmailClientId && gmailRefresh);
  const smsConfigured = Boolean(twilioSid && twilioToken && process.env.TWILIO_SMS_FROM);
  const whatsappConfigured = Boolean(
    (twilioSid && twilioToken && process.env.TWILIO_WHATSAPP_FROM) ||
      (whatsappToken && process.env.WHATSAPP_PHONE_NUMBER_ID)
  );
  const instagramConfigured = Boolean(instagramToken && instagramPageId);

  return {
    email: {
      configured: emailConfigured,
      provider: resendKey ? "resend" : smtpHost ? "smtp" : "none",
      fromEmail: process.env.EMAIL_FROM?.trim() || null,
    },
    gmail: {
      configured: gmailConfigured,
      provider: gmailConfigured ? "smtp" : "none",
    },
    sms: {
      configured: smsConfigured,
      provider: smsConfigured ? "twilio" : "none",
    },
    whatsapp: {
      configured: whatsappConfigured,
      provider: whatsappToken ? "whatsapp-meta" : whatsappConfigured ? "twilio" : "none",
    },
    instagram: {
      configured: instagramConfigured,
      provider: instagramConfigured ? "meta" : "none",
    },
    ai: {
      configured: Boolean(openAiKey),
      provider: openAiKey ? "openai" : "none",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    },
    payments: {
      configured: Boolean(stripeKey),
      provider: stripeKey ? "stripe" : null,
    },
  };
}
