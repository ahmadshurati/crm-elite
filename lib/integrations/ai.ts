import { buildCustomerSummary } from "@/lib/crm/customer-summary";
import { getIntegrationStatus } from "@/lib/integrations/config";

export type AiSummaryResult = {
  source: "openai" | "rules";
  summary: string;
  highlights: string[];
  recommendations: string[];
};

export type AiDraftEmailResult = {
  source: "openai" | "template";
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

async function callOpenAi(messages: { role: "system" | "user"; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(String(data.error?.message || res.statusText));
  }

  return String(data.choices?.[0]?.message?.content || "").trim();
}

export async function generateCustomerSummary(customerId: number): Promise<AiSummaryResult> {
  const ruleSummary = await buildCustomerSummary(customerId);

  if (!ruleSummary) {
    throw new Error("Customer not found");
  }

  const integration = getIntegrationStatus();

  if (!integration.ai.configured) {
    return {
      source: "rules",
      summary: ruleSummary.highlights.join(" "),
      highlights: ruleSummary.highlights,
      recommendations: ruleSummary.recommendations,
    };
  }

  const prompt = `أنت مساعد CRM لتأمين السيارات. اكتب ملخصاً عربياً موجزاً للعميل التالي:
الاسم: ${ruleSummary.customerName}
النقاط: ${ruleSummary.highlights.join(" | ")}
الإحصائيات: ${JSON.stringify(ruleSummary.stats)}
أعد JSON فقط بالشكل: {"summary":"...","highlights":["..."],"recommendations":["..."]}`;

  try {
    const raw = await callOpenAi([
      { role: "system", content: "أجب بالعربية فقط. JSON صالح بدون markdown." },
      { role: "user", content: prompt },
    ]);

    const parsed = JSON.parse(raw);
    return {
      source: "openai",
      summary: String(parsed.summary || ruleSummary.highlights.join(" ")),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : ruleSummary.highlights,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String)
        : ruleSummary.recommendations,
    };
  } catch {
    return {
      source: "rules",
      summary: ruleSummary.highlights.join(" "),
      highlights: ruleSummary.highlights,
      recommendations: ruleSummary.recommendations,
    };
  }
}

export async function draftCustomerEmail(input: {
  customerName: string;
  purpose: string;
  context?: string;
}): Promise<AiDraftEmailResult> {
  const integration = getIntegrationStatus();

  if (!integration.ai.configured) {
    const subject = `متابعة — ${input.purpose}`;
    const bodyText = `مرحباً ${input.customerName}،\n\n${input.context || "نود متابعتك بخصوص " + input.purpose + "."}\n\nمع التحية،\nElite Insurance`;
    return {
      source: "template",
      subject,
      bodyHtml: bodyText.replace(/\n/g, "<br/>"),
      bodyText,
    };
  }

  const raw = await callOpenAi([
    {
      role: "system",
      content: "اكتب رسالة بريد عربية احترافية. أعد JSON: subject, bodyHtml, bodyText",
    },
    {
      role: "user",
      content: `العميل: ${input.customerName}\nالغرض: ${input.purpose}\nالسياق: ${input.context || "—"}`,
    },
  ]);

  try {
    const parsed = JSON.parse(raw);
    return {
      source: "openai",
      subject: String(parsed.subject || `متابعة — ${input.purpose}`),
      bodyHtml: String(parsed.bodyHtml || parsed.bodyText || ""),
      bodyText: String(parsed.bodyText || ""),
    };
  } catch {
    const subject = `متابعة — ${input.purpose}`;
    const bodyText = `مرحباً ${input.customerName}،\n\n${input.context || "نود متابعتك بخصوص " + input.purpose + "."}\n\nمع التحية،\nElite Insurance`;
    return {
      source: "template",
      subject,
      bodyHtml: bodyText.replace(/\n/g, "<br/>"),
      bodyText,
    };
  }
}
