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

const SYSTEM_PROMPT = `You are a friendly, expert financial planning assistant for an Indian home affordability app.
Your job is to give clear, actionable, numbers-driven suggestions to help a family make their home purchase affordable and financially sustainable.

You will receive the user's complete financial profile. Generate 4 to 6 personalised suggestions in JSON format.

Rules:
- Use actual rupee numbers from the data
- Be specific — never vague
- Be honest — if something is risky, say so
- Focus on: SIP for corpus building, part prepayment of loan, SWP to supplement EMI, interest cost reduction, emergency fund protection, expense optimisation
- Never recommend specific fund names or stock names
- Keep each suggestion under 60 words
- Sound like a trusted friend, not a robot
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
1. SIP corpus suggestion: If surplus > 5000, suggest a SIP of 30% of surplus, estimate 12% annual return after 5 years, and explain part-payment impact.
2. Part payment suggestion: Calculate annual prepayment equal to 1 month EMI, approximate tenure reduction and interest saved.
3. SWP suggestion: If investments > 0, project corpus after 10 years at 12%, calculate 4% annual withdrawal as monthly SWP, and show how it offsets EMI.
4. Interest reduction suggestion: Compare total interest at current rate vs 0.5% lower and recommend periodic bank rate review.
5. Emergency fund suggestion: If target is not comfortably met, calculate months to build it using current surplus.
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

          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return jsonError("AI suggestions are not configured yet.", 500);

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0.7,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserPrompt(parsed.data.profile) },
              ],
            }),
          });

          if (!response.ok) {
            return jsonError("AI suggestions are busy right now. Please try regenerating.", response.status);
          }

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

function parseSuggestions(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const jsonText = cleaned.startsWith("[") ? cleaned : cleaned.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  const parsed = z.array(suggestionSchema).safeParse(JSON.parse(jsonText));
  return parsed.success ? parsed.data : [];
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}