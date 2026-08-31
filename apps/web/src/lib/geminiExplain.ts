/**
 * Gemini-backed Build Signal explanations.
 * Grounded only on caller-provided public evidence. Never invents token links.
 * Uses the Generative Language REST API so we do not add a new dependency.
 */

import {
  type BuildSignalCopy,
  type BuildSignalCopyInput,
  buildSignalCopy,
  explanationFingerprint,
  isBuildSignalCopy,
} from "@/lib/buildSignals";

export type GeminiExplanationResult = {
  ok: boolean;
  copy: BuildSignalCopy;
  source: "gemini" | "template";
  model: string | null;
  fingerprint: string;
  error?: string;
};

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

function geminiApiKey(): string | null {
  const value = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return value || null;
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

export function isGeminiConfigured(): boolean {
  return Boolean(geminiApiKey());
}

function factsBlock(input: BuildSignalCopyInput): string {
  return JSON.stringify(
    {
      projectName: input.projectName,
      shortDescription: input.shortDescription,
      trackingReason: input.trackingReason,
      eventType: input.eventType,
      eventTitle: input.eventTitle,
      eventDescription: input.eventDescription,
      classification: input.classification,
      meaningfulScore: input.meaningfulScore,
      commitCount: input.commitCount,
      happenedAt: input.happenedAt,
      identityConfidence: input.identityConfidence,
      identityLabel: input.identityLabel,
      tokenSymbol: input.tokenSymbol,
      tokenChain: input.tokenChain,
      tokenContract: input.tokenContract,
      tokenSourceUrl: input.tokenSourceUrl,
      contractVerified: input.contractVerified,
      marketLabel: input.marketLabel,
      marketCap: input.marketCap,
      liquidityUsd: input.liquidityUsd,
      marketSource: input.marketSource,
      marketSnapshotAt: input.marketSnapshotAt,
    },
    null,
    2,
  );
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Gemini did not return JSON");
  }
}

function sanitizeCopy(copy: BuildSignalCopy): BuildSignalCopy {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 700);
  return {
    whatHappened: clean(copy.whatHappened),
    whyItMayMatter: clean(copy.whyItMayMatter),
    tokenRelation: clean(copy.tokenRelation),
    whatWeDoNotKnow: clean(copy.whatWeDoNotKnow),
    whatToWatchNext: clean(copy.whatToWatchNext),
  };
}

/**
 * Rewrite Build Signal sections in plain English from evidence facts only.
 * Falls back to deterministic templates when Gemini is unset or fails.
 */
export async function explainBuildSignalWithGemini(
  input: BuildSignalCopyInput,
): Promise<GeminiExplanationResult> {
  const fingerprint = explanationFingerprint(input);
  const template = buildSignalCopy(input);
  const apiKey = geminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      copy: template,
      source: "template",
      model: null,
      fingerprint,
      error: "GEMINI_API_KEY is not set",
    };
  }

  const model = geminiModel();
  const prompt = [
    "You write plain-English research notes for CODE × CAP Build Signals.",
    "Audience: non-technical readers who want to understand GitHub activity vs a crypto token.",
    "Use ONLY the JSON facts below. Do not invent users, revenue, security audits, partnerships, or token demand.",
    "If a token↔code link is not proven by the facts, say it is unknown / not verified.",
    "Never give buy/sell/price advice. Never say a token should go up or down.",
    "Name the token symbol when present. Mention chain + shortened contract when present.",
    "Keep each field to 1-3 short sentences. Concrete beats generic.",
    "tokenRelation must explicitly discuss how (or whether) this public build event relates to the tracked token.",
    "Return ONLY JSON with keys: whatHappened, whyItMayMatter, tokenRelation, whatWeDoNotKnow, whatToWatchNext.",
    "",
    "FACTS:",
    factsBlock(input),
  ].join("\n");

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    });
    const rawText = await response.text();
    let payload: GeminiGenerateResponse;
    try {
      payload = JSON.parse(rawText) as GeminiGenerateResponse;
    } catch {
      throw new Error(`Gemini returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Gemini HTTP ${response.status}`);
    }
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) throw new Error("Gemini returned empty content");
    const parsed = extractJsonObject(text);
    if (!isBuildSignalCopy(parsed)) {
      throw new Error("Gemini JSON missing required explanation fields");
    }
    return {
      ok: true,
      copy: sanitizeCopy(parsed),
      source: "gemini",
      model,
      fingerprint,
    };
  } catch (error) {
    return {
      ok: false,
      copy: template,
      source: "template",
      model,
      fingerprint,
      error: error instanceof Error ? error.message : "Gemini explanation failed",
    };
  }
}
