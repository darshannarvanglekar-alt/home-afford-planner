import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const suggestionSchema = z.object({
  icon: z.string().min(1).max(4),
  title: z.string().min(1).max(80),
  explanation: z.string().min(1).max(500),
  type: z.enum(["opportunity", "warning", "action"]),
});

const profileSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  existingEMIs: z.number(),
  newEMI: z.number(),
  surplus: z.number(),
  investments: z.number(),
  emergencyFundMode: z.string(),
  emergencyFundTarget: z.number(),
  propertyCost: z.number(),
  loanAmount: z.number(),
  interestRate: z.number(),
  tenureYears: z.number(),
  totalInterest: z.number(),
  verdict: z.string(),
  emiToIncomeRatio: z.number(),
  healthInsurance: z.boolean(),
  dependents: z.number(),
  elderlyParents: z.boolean(),
  propertyType: z.string(),
  discretionary: z.number(),
});

const requestSchema = z.object({
  profile: profileSchema,
});

const SYSTEM_PROMPT = `You generate neutral scenario-planning suggestions for an Indian home affordability simulator. This app is not a financial advisory tool.
Your job is to give clear, numbers-driven scenario observations to help a family understand home purchase affordability.

You will receive the user's complete financial profile. Generate 4 to 6 personalised suggestions in JSON format.

Rules:
- Use actual rupee numbers from the data
- Be specific — never vague
- Be honest — if something is risky, say so
- Focus on: monthly investment, fixed return saving, lump sum investment, chit-style pooled saving, gold accumulation, blended approach, emergency fund protection, expense optimisation
- Never mention any bank, lender, AMC, mutual fund, insurance company, investment brand, or financial platform by name
- Never promote any product or provider
- Never use language like "we recommend", "best option", "you should invest in", "advisor", "advice", "SIP", "SWP", "mutual fund", "bank", or "loan provider"
- Label all projections as illustrative scenarios based on assumed rates
- Keep each suggestion under 60 words
- Use neutral planning language, not advisory language
- Return ONLY this JSON array:
[
  {
    "icon": "single emoji",
    "title": "bold one-liner under 8 words",
    "explanation": "2-3 sentences with actual ₹ amounts, specific and actionable",
    "type": "opportunity | warning | action"
  }
]

Generate suggestions covering these areas where relevant:
1. Monthly investment scenario: If surplus > 5000, model 30% of surplus as monthly investment at an assumed 12% annual return after 5 years.
2. Extra repayment scenario: Calculate an annual extra payment equal to 1 month EMI and approximate tenure or interest impact.
3. Lump sum investment scenario: If current investments > 0, project corpus after 10 years at an assumed 12% annual return and show possible cash-flow support.
4. Interest sensitivity scenario: Compare total interest at current rate vs 0.5% lower without naming any provider.
5. Safety buffer scenario: If target is not comfortably met, calculate months to build it using current surplus.
6. Health insurance suggestion: If health insurance is No, explain realistic family floater annual cost range in India and EMI protection impact.
7. Expense optimisation: If discretionary spend is above 15% of income, calculate impact of a 20% reduction.`;

export const Route = createFileRoute("/api/generate-plan-suggestions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedUser(request);
          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return jsonError("We couldn't prepare your AI suggestions.", 400);

          const apiKey = process.env.LOVABLE_API_KEY ?? process.env.OPENAI_API_KEY;
          if (!apiKey) return jsonError("AI suggestions are not configured yet.", 500);

          const response = await callAiWithRetry(apiKey, parsed.data.profile);
          if (!response.ok) return jsonError("AI suggestions are busy right now. Please try regenerating.", response.status);

          const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
          const suggestions = parseSuggestions(payload.choices?.[0]?.message?.content ?? "");
          if (suggestions.length === 0) return jsonError("We couldn't generate suggestions right now.", 422);

          return Response.json({ suggestions: suggestions.slice(0, 6) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "We couldn't generate suggestions right now.";
          return jsonError(message, message.includes("sign in") ? 401 : 500);
        }
      },
    },
  },
});

async function requireAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in before generating suggestions.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in before generating suggestions.");
}

function buildUserPrompt(profile: z.infer<typeof profileSchema>) {
  return `User financial profile:
- Monthly income: ₹${Math.round(profile.totalIncome)}
- Monthly expenses: ₹${Math.round(profile.totalExpenses)}
- Existing EMIs: ₹${Math.round(profile.existingEMIs)}
- New home EMI: ₹${Math.round(profile.newEMI)}
- Monthly surplus after all: ₹${Math.round(profile.surplus)}
- Current monthly investments: ₹${Math.round(profile.investments)}
- Emergency fund mode: ${profile.emergencyFundMode}
- Emergency fund target: ₹${Math.round(profile.emergencyFundTarget)}
- Property cost: ₹${Math.round(profile.propertyCost)}
- Loan amount: ₹${Math.round(profile.loanAmount)}
- Interest rate: ${profile.interestRate}%
- Tenure: ${profile.tenureYears} years
- Total interest payable: ₹${Math.round(profile.totalInterest)}
- Verdict: ${profile.verdict}
- EMI to income ratio: ${profile.emiToIncomeRatio.toFixed(1)}%
- Health insurance: ${profile.healthInsurance ? "yes" : "no"}
- Dependents: ${profile.dependents}
- Elderly parents: ${profile.elderlyParents ? "yes" : "no"}
- Property type: ${profile.propertyType}
- Discretionary spend: ₹${Math.round(profile.discretionary)}`;
}

async function callAiWithRetry(apiKey: string, profile: z.infer<typeof profileSchema>) {
  const body = JSON.stringify({
    model: process.env.LOVABLE_API_KEY ? "google/gemini-3-flash-preview" : "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(profile) },
    ],
  });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(process.env.LOVABLE_API_KEY ? "https://ai.gateway.lovable.dev/v1/chat/completions" : "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (response.ok || attempt === 2) {
        if (!response.ok) console.error("AI suggestions API failed", { status: response.status, body: await response.clone().text().catch(() => "Unable to read error body") });
        return response;
      }

      console.error("AI suggestions API attempt failed; retrying", { status: response.status, body: await response.clone().text().catch(() => "Unable to read error body") });
    } catch (error) {
      console.error("AI suggestions API request error", { attempt, error });
      if (attempt === 2) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("We couldn't generate suggestions right now.");
}

function parseSuggestions(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const jsonText = cleaned.startsWith("[") ? cleaned : cleaned.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  const parsed = z.array(suggestionSchema).safeParse(JSON.parse(jsonText));
  return parsed.success ? parsed.data : [];
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}