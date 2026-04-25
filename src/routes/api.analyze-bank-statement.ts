import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const extractedSchema = z.object({
  primarySalary: z.number().min(0),
  additionalIncome: z.number().min(0),
  familyContribution: z.number().min(0),
  existingEMIs: z.number().min(0),
  insurancePremiums: z.number().min(0),
  housingUtilities: z.number().min(0),
  familyDependents: z.number().min(0),
  healthProtection: z.number().min(0),
  dailyLiving: z.number().min(0),
  investmentsSavings: z.number().min(0),
  discretionary: z.number().min(0),
});

const SYSTEM_PROMPT = `You are a financial data extraction assistant for an Indian home affordability planning app.
Analyse the bank statement transactions provided and extract the following information. Return ONLY a valid JSON object with these exact fields:
{
  primarySalary: number,
  additionalIncome: number,
  familyContribution: number,
  existingEMIs: number,
  insurancePremiums: number,
  housingUtilities: number,
  familyDependents: number,
  healthProtection: number,
  dailyLiving: number,
  investmentsSavings: number,
  discretionary: number
}
Rules:
- All values must be positive numbers
- Use monthly averages across all months provided
- If a category has no transactions return 0
- Do not include the new home EMI being planned
- Return only the JSON, no explanation`;

export const Route = createFileRoute("/api/analyze-bank-statement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedUser(request);
          const form = await request.formData();
          const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);

          if (files.length === 0) return jsonError("Please upload at least one PDF or CSV file.", 400);
          if (files.length > 6) return jsonError("Please upload up to 6 files only.", 400);

          const chunks: string[] = [];
          for (const file of files) {
            validateFile(file);
            const text = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv")
              ? await file.text()
              : await extractBasicPdfText(file);
            chunks.push(`FILE: ${file.name}\n${text}`);
          }

          const statementText = chunks.join("\n\n---\n\n").slice(0, 120_000);
          if (statementText.trim().length < 40) {
            return jsonError("We couldn't read this file automatically. Please fill in the details below manually.", 422);
          }

          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return jsonError("AI analysis is not configured yet.", 500);

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: statementText },
              ],
            }),
          });

          if (!response.ok) {
            const status = response.status;
            return jsonError(
              status === 429
                ? "AI analysis is busy right now. Please try again shortly."
                : "We couldn't read this file automatically. Please fill in the details below manually.",
              status,
            );
          }

          const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
          const content = payload.choices?.[0]?.message?.content ?? "";
          const parsed = extractedSchema.safeParse(JSON.parse(content));
          if (!parsed.success) {
            return jsonError("We couldn't read this file automatically. Please fill in the details below manually.", 422);
          }

          return Response.json({
            values: parsed.data,
            months: estimateMonths(statementText),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "We couldn't read this file automatically. Please fill in the details below manually.";
          return jsonError(message, message.includes("File too large") || message.includes("PDF or CSV") ? 400 : 500);
        }
      },
    },
  },
});

async function requireAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in before analysing statements.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in before analysing statements.");
}

function validateFile(file: File) {
  const name = file.name.toLowerCase();
  const valid = name.endsWith(".pdf") || name.endsWith(".csv") || file.type === "application/pdf" || file.type.includes("csv");
  if (!valid) throw new Error("Please upload a PDF or CSV file only.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large. Please upload files under 10MB.");
}

async function extractBasicPdfText(file: File) {
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  const matches = [...text.matchAll(/\(([^()]|\\.)*\)\s*Tj|\[((?:.|\n|\r)*?)\]\s*TJ/g)];
  return matches
    .map((m) => decodePdfString(m[0]))
    .join("\n")
    .replace(/\s+/g, " ");
}

function decodePdfString(input: string) {
  return input
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/[\[\]()]/g, " ")
    .replace(/\\[0-7]{1,3}/g, " ")
    .replace(/\s*TJ|\s*Tj/g, " ");
}

function estimateMonths(text: string) {
  const months = new Set((text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi) ?? [])
    .map((v) => v.slice(0, 7).toLowerCase()));
  return Math.max(1, Math.min(6, months.size || 3));
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}