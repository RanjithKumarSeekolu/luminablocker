import type { AppFocusData } from "@/app/(tabs)";

export type AiInsight = {
  id: string;
  title: string;
  body: string;
  recommendation: string;
  icon: string;
  tone: "primary" | "success" | "warning";
};

type InsightPayload = {
  generatedAt: string;
  targets: Array<{
    appName: string;
    category: string;
    usageMs: number;
    score: number;
    level: number;
    usageBreakdown: AppFocusData["usageBreakdown"];
    weeklyUsageMs: number[];
  }>;
};

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL || "openrouter/free";

let cached: { key: string; expiresAt: number; insights: AiInsight[] } | null = null;

function roundUsage(ms: number): number {
  // Avoid a new model request for every few seconds of foreground activity.
  return Math.round(ms / (5 * 60 * 1000)) * (5 * 60 * 1000);
}

function buildPayload(
  targets: AppFocusData[],
  weeklyUsageMap: Record<string, { day: string; usageMs: number }[]>,
): InsightPayload {
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    targets: targets.slice(0, 8).map((target) => ({
      appName: target.appName,
      category: target.category,
      usageMs: roundUsage(target.usageMs),
      score: target.score,
      level: target.level,
      usageBreakdown: {
        early: roundUsage(target.usageBreakdown.early),
        work: roundUsage(target.usageBreakdown.work),
        evening: roundUsage(target.usageBreakdown.evening),
        night: roundUsage(target.usageBreakdown.night),
      },
      weeklyUsageMs: (weeklyUsageMap[target.packageName] ?? []).map((point) =>
        roundUsage(point.usageMs),
      ),
    })),
  };
}

function cacheKey(payload: InsightPayload): string {
  return JSON.stringify(payload);
}

function parseModelInsights(content: unknown): AiInsight[] {
  const text = (typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : "")).join("")
      : "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Some free providers prepend a short explanation despite the JSON-only
    // instruction. Recover the JSON object/array instead of dropping the card.
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    const start = objectStart >= 0 ? objectStart : arrayStart;
    const end = objectStart >= 0 ? objectEnd : arrayEnd;
    if (start < 0 || end <= start) throw new Error("AI returned invalid JSON");
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  const items = Array.isArray(parsed)
    ? parsed
    : (parsed as { insights?: unknown }).insights;
  if (!Array.isArray(items)) throw new Error("AI returned no insights");

  return items.slice(0, 3).map((item, index) => ({
    id: String(item.id || `ai-${index + 1}`),
    title: String(item.title || "A pattern to notice"),
    body: String(item.body || "Your recent usage has a pattern worth noticing."),
    recommendation: String(
      item.recommendation || "Take a short pause before your next session.",
    ),
    icon: String(item.icon || "sparkles-outline"),
    tone: ["primary", "success", "warning"].includes(item.tone)
      ? item.tone
      : "primary",
  }));
}

export async function fetchAiInsights(
  targets: AppFocusData[],
  weeklyUsageMap: Record<string, { day: string; usageMs: number }[]>,
): Promise<AiInsight[]> {
  if (targets.length === 0) return [];
  if (!OPENROUTER_API_KEY) {
    throw new Error("EXPO_PUBLIC_OPENROUTER_API_KEY is not configured");
  }

  const payload = buildPayload(targets, weeklyUsageMap);
  const key = cacheKey(payload);
  if (cached && cached.key === key && cached.expiresAt > Date.now()) {
    return cached.insights;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://lumina.app",
      "X-Title": "Lumina",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
            content:
            "You are Lumina, a calm digital-wellbeing coach. Analyze only the supplied aggregate app-usage data. Do not diagnose mental health, shame the user, or invent facts. Return a JSON object only with an insights array containing at most 3 objects. Do not include analysis, explanations, or markdown. Each object must have id, title, body, recommendation, icon, and tone. tone must be primary, success, or warning. Keep title under 60 characters, body under 180 characters, and recommendation under 160 characters. Use Ionicons names ending in -outline, such as moon-outline, trending-up-outline, timer-outline, or sparkles-outline.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Identify the most useful usage patterns and give actionable recommendations.",
            data: payload,
          }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}`);

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const insights = parseModelInsights(result.choices?.[0]?.message?.content);
  cached = {
    key,
    insights,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  return insights;
}
