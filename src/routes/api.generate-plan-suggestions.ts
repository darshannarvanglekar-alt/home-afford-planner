import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const suggestionSchema = z.object({
  icon: z.string().min(1).max(4),
  title: z.string().min(1).max(80),
  explanation: z.string().min(1).max(500),
  impact: z.string().min(1).max(80),
  type: z.enum(["opportunity", "warning", "action"]),
  simulation: z
    .object({
      monthlyInvestment: z.number().optional(),
      downPayment: z.number().optional(),
      possessionMonth: z.number().optional(),
      emergencyFundPref: z.enum(["conservative", "balanced", "aggressive"]).optional(),
    })
    .optional(),
});

const profileSchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  existingEMIs: z.number(),
  newEMI: z.number(),
  surplus: z.number(),
  investments: z.number(),
  existingInvestmentCorpusToday: z.number().optional(),
  existingInvestmentProjectedCorpus: z.number().optional(),
  existingInvestmentCoveragePct: z.number().optional(),
  targetCorpus: z.number(),
  projectedCorpus: z.number(),
  corpusGap: z.number(),
  monthsToPurchase: z.number(),
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
  emiEndEvents: z
    .array(z.object({ label: z.string(), amount: z.number(), endsInMonth: z.number() }))
    .optional()
    .default([]),
  insuranceMaturities: z
    .array(z.object({ subtype: z.string(), amount: z.number(), inMonth: z.number() }))
    .optional()
    .default([]),
  annualPaymentMonthlyEquivalent: z.number().optional().default(0),
});

const requestSchema = z.object({
  profile: profileSchema,
});

const SYSTEM_PROMPT = `You generate neutral scenario-planning suggestion cards for an Indian home affordability scenario simulator. This app is not a financial advisory tool.
Your job is to suggest only numerical changes to user-entered amounts, timelines, or contribution patterns.

You will receive the user's complete financial profile. Generate 3 to 5 meaningful suggestions in JSON format. If the plan is already well-optimised and no meaningful numerical scenario exists, return an empty JSON array.

Rules:
- Use actual rupee numbers from the data
- Be specific — never vague
- Only suggest numerical adjustments to amounts, timelines, or contribution patterns
- Always show the mathematical impact of each suggestion
- Keep each suggestion explanation to 2 sentences maximum
- Always frame suggestions as "If you..." or "Your corpus is projected to..."
- All projections must be labelled or phrased as illustrative scenarios based on assumed rates
- Never mention any bank, lender, AMC, mutual fund, insurance company, investment brand, or financial platform by name
- Never promote any product or provider
- Never use language like "we recommend", "best option", "you should invest in", "advisor", "advice", "SIP", "SWP", "mutual fund", "bank", "lender", "AMC", "insurance company", "platform", "portfolio", "fund", or "loan provider"
- Keep each suggestion under 60 words
- Use neutral planning language, not advisory language
- Return ONLY this JSON array:
[
  {
    "icon": "single emoji",
    "title": "bold one-liner under 8 words",
    "explanation": "maximum 2 sentences with actual ₹ amounts, specific and actionable",
    "impact": "short chip text like 8 months faster or Saves ₹4.2L interest",
    "simulation": { "monthlyInvestment": 18000, "downPayment": 1200000, "possessionMonth": 30, "emergencyFundPref": "conservative" },
    "type": "opportunity | warning | action"
  }
]

Generate suggestions covering these areas where relevant:
1. Increase monthly contribution: if corpus gap exists and surplus allows higher monthly contribution.
2. Annual step-up contribution: if corpus gap exists, model a 10% yearly increase using monthlyInvestment as the updated first amount.
3. Extend timeline before purchase: if corpus is significantly short and timeline is under 24 months.
4. Add safety buffer first: if safety buffer is not protected and surplus allows a small monthly set-aside.
5. Existing corpus coverage: if existing investments cover a meaningful portion, acknowledge the coverage percentage and suggest only the additional monthly amount needed to close the remaining gap.
6. Reduce loan amount by increasing down payment: if projected corpus exceeds target.

For simulation, include only fields that should change in the simulator. Use the user's current values as a base.`;

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
          if (!response.ok)
            return jsonError(
              "AI suggestions are busy right now. Please try regenerating.",
              response.status,
            );

          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const suggestions = parseSuggestions(payload.choices?.[0]?.message?.content ?? "");

          return Response.json({ suggestions: suggestions.slice(0, 5) });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "We couldn't generate suggestions right now.";
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
- Current monthly investment commitment: ₹${Math.round(profile.investments)}
- Existing investment corpus today: ₹${Math.round(profile.existingInvestmentCorpusToday ?? 0)}
- Existing investments projected corpus by possession/purchase: ₹${Math.round(profile.existingInvestmentProjectedCorpus ?? profile.projectedCorpus)}
- Existing investments coverage of target: ${Math.round(profile.existingInvestmentCoveragePct ?? 0)}%
- Target corpus: ₹${Math.round(profile.targetCorpus)}
- Projected corpus at current pace: ₹${Math.round(profile.projectedCorpus)}
- Corpus gap: ₹${Math.round(profile.corpusGap)}
- Months to possession or purchase: ${Math.round(profile.monthsToPurchase)}
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
- Discretionary spend: ₹${Math.round(profile.discretionary)}
- EMIs ending during build-up: ${(profile.emiEndEvents ?? []).map((e) => `${e.label} ₹${Math.round(e.amount)}/mo ends in month ${e.endsInMonth}`).join("; ") || "none"}
- Insurance maturities arriving during build-up: ${(profile.insuranceMaturities ?? []).map((m) => `${m.subtype} ₹${Math.round(m.amount)} in month ${m.inMonth}`).join("; ") || "none"}
- Annual-payment monthly equivalent: ₹${Math.round(profile.annualPaymentMonthlyEquivalent ?? 0)}

Additional suggestion areas to cover when relevant:
- If an EMI ends during the build-up window, suggest redirecting that ₹X/month into corpus from month N+1 and quantify how many months earlier the gap closes.
- If an insurance policy matures before possession, reference the maturity arrival and how it reduces the corpus gap.
- If annual-payment burden is significant, suggest keeping a buffer for those months when surplus drops.`;
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
      const response = await fetch(
        process.env.LOVABLE_API_KEY
          ? "https://ai.gateway.lovable.dev/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        },
      );

      if (response.ok || attempt === 2) {
        if (!response.ok)
          console.error("AI suggestions API failed", {
            status: response.status,
            body: await response
              .clone()
              .text()
              .catch(() => "Unable to read error body"),
          });
        return response;
      }

      console.error("AI suggestions API attempt failed; retrying", {
        status: response.status,
        body: await response
          .clone()
          .text()
          .catch(() => "Unable to read error body"),
      });
    } catch (error) {
      console.error("AI suggestions API request error", { attempt, error });
      if (attempt === 2) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("We couldn't generate suggestions right now.");
}

function parseSuggestions(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const jsonText = cleaned.startsWith("[") ? cleaned : (cleaned.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
  const parsed = z.array(suggestionSchema).safeParse(JSON.parse(jsonText));
  return parsed.success ? parsed.data : [];
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
