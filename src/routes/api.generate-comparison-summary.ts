import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const propertyMetricsSchema = z.object({
  label: z.string(),
  propertyCost: z.number(),
  downPayment: z.number(),
  loanAmount: z.number(),
  interestRate: z.number(),
  tenureYears: z.number(),
  monthlyEmi: z.number(),
  monthlySurplus: z.number(),
  emiToIncomeRatio: z.number(),
  verdict: z.string(),
  affordabilityScore: z.number(),
  emergencyFundStatus: z.string(),
  totalInterest: z.number(),
  totalCostOfOwnership: z.number(),
  month60Corpus: z.number(),
  investmentContinuity: z.string(),
});

const requestSchema = z.object({
  propertyA: propertyMetricsSchema,
  propertyB: propertyMetricsSchema,
});

const SYSTEM_PROMPT = `You are a neutral home affordability scenario simulator for Indian families. Compare these two properties in 3-4 sentences using actual numbers. Focus on affordability, monthly cash flow, total interest cost, and long-term financial impact.

End with one clear sentence starting with:
'Overall, Property [A/B] has the stronger affordability scenario because...'

Do not recommend specific investments, providers, products, banks, lenders, platforms, or brands.
Do not use advice language such as "we recommend", "best option", or "you should".
Keep it under 80 words.`;

export const Route = createFileRoute("/api/generate-comparison-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedUser(request);
          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return jsonError("We couldn't prepare the comparison summary.", 400);

          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return jsonError("AI summary is not configured yet.", 500);

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0.45,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(parsed.data, null, 2) },
              ],
            }),
          });

          if (!response.ok) {
            return jsonError("AI summary is busy right now. Please try again.", response.status);
          }

          const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const summary = payload.choices?.[0]?.message?.content?.trim();
          if (!summary) return jsonError("We couldn't generate the comparison summary right now.", 422);

          return Response.json({ summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "We couldn't generate the comparison summary right now.";
          return jsonError(message, message.includes("sign in") ? 401 : 500);
        }
      },
    },
  },
});

async function requireAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in before generating the comparison summary.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in before generating the comparison summary.");
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
