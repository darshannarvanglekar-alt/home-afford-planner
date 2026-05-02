import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requestSchema = z.object({
  principal: z.number(),
  annualRatePct: z.number(),
  tenureYears: z.number(),
  baseEmi: z.number(),
  baselineTotalInterest: z.number(),
  withPrepayTotalInterest: z.number(),
  interestSaved: z.number(),
  monthsSaved: z.number(),
  partPayments: z.array(z.object({
    label: z.string(),
    amount: z.number(),
    month: z.number(),
    interestSaved: z.number(),
    monthsSaved: z.number(),
  })).optional().default([]),
  // Legacy fields kept for compat
  oneTimeAmount: z.number().optional(),
  oneTimeAtMonth: z.number().optional(),
  extraMonthly: z.number().optional().default(0),
  extraStartMonth: z.number().optional().default(0),
  stepUpPct: z.number().optional().default(0),
});

const SYSTEM_PROMPT = `You generate ONE short neutral observation for an Indian loan-relief scenario simulator. This is NOT financial advice.

Strict rules:
- Output a single sentence, max 45 words.
- Use actual rupee numbers from the data provided.
- Frame as an observation, never as advice. Use "If you...", "Your scenario shows...", "Prepaying ₹X in month Y...".
- Never use words: "we recommend", "you should", "best", "advisor", "advice", "SIP", "SWP", "mutual fund", "bank", "lender", "AMC", "insurance", "platform", "fund", "loan provider".
- Never mention any brand or company name.
- Label as illustrative — based on assumed rates entered by the user.
- Return ONLY plain text, no JSON, no quotes, no markdown.
- If multiple part payments are provided, comment on relative impact or compound effect.`;

export const Route = createFileRoute("/api/generate-loan-relief-nudge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) return Response.json({ error: "auth" }, { status: 401 });
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (error || !data.user) return Response.json({ error: "auth" }, { status: 401 });

          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "bad input" }, { status: 400 });

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return Response.json({ error: "not configured" }, { status: 500 });

          const p = parsed.data;
          const ppList = p.partPayments.length > 0
            ? p.partPayments.map((pp) => `  - "${pp.label}": ₹${Math.round(pp.amount)} at month ${pp.month} → saves ₹${Math.round(pp.interestSaved)} interest, ${pp.monthsSaved} months`).join("\n")
            : p.oneTimeAmount ? `  - One-time: ₹${Math.round(p.oneTimeAmount)} at month ${p.oneTimeAtMonth ?? 0}` : "  - None";

          const userPrompt = `Loan scenario:
- Principal: ₹${Math.round(p.principal)}
- Rate (assumed): ${p.annualRatePct}%
- Tenure: ${p.tenureYears} years
- Monthly EMI: ₹${Math.round(p.baseEmi)}
- Total interest without part payments: ₹${Math.round(p.baselineTotalInterest)}
- Total interest with part payments: ₹${Math.round(p.withPrepayTotalInterest)}
- Combined interest saved (illustrative): ₹${Math.round(p.interestSaved)}
- Combined time saved: ${p.monthsSaved} months
- Part payments:
${ppList}
- Extra monthly: ₹${Math.round(p.extraMonthly)} from month ${p.extraStartMonth}, step-up ${p.stepUpPct}%/yr

Write one short neutral observation about the most impactful aspect.`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              temperature: 0.5,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (!response.ok) {
            console.error("Loan relief nudge AI error", response.status, await response.text().catch(() => ""));
            return Response.json({ error: "ai" }, { status: response.status });
          }
          const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const text = (payload.choices?.[0]?.message?.content ?? "").trim();
          if (!text) return Response.json({ error: "empty" }, { status: 502 });
          return Response.json({ nudge: text });
        } catch (e) {
          console.error("Loan relief nudge handler error", e);
          return Response.json({ error: "server" }, { status: 500 });
        }
      },
    },
  },
});
