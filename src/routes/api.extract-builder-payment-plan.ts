import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const stageSchema = z.object({
  stageName: z.string().min(1),
  month: z.number().int().min(1).max(120),
  bankAmount: z.number().min(0),
  selfAmount: z.number().min(0),
  totalAmount: z.number().min(0),
});

const responseSchema = z.object({
  stages: z.array(stageSchema).max(30),
  propertyCost: z.number().min(0).optional(),
});

const SYSTEM_PROMPT = `You are a document extraction assistant for an Indian real estate payment plan analyser.
Extract the builder payment schedule from this document. Return ONLY a valid JSON object:
{
  "stages": [
    {
      "stageName": string,
      "month": number,
      "bankAmount": number,
      "selfAmount": number,
      "totalAmount": number
    }
  ],
  "propertyCost": number | null
}
Rules:
- Extract ALL stages found in the document
- Convert any amounts in lakhs to full rupees (e.g. 10 lakhs = 1000000)
- If amounts are percentages of total cost, calculate based on the property cost provided by user
- If bank/self split is not shown, put 75% in bankAmount and 25% in selfAmount
- If month is not clear use 1, 12, 24, 36 as defaults for 4 stages
- If you cannot find a payment schedule, return {"stages":[],"propertyCost":null}
- Return only JSON, no explanation`;

export const Route = createFileRoute("/api/extract-builder-payment-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuthenticatedUser(request);
          const form = await request.formData();
          const file = form.get("file");
          const propertyCost = Number(form.get("propertyCost") ?? 0) || 0;
          if (!(file instanceof File)) return jsonError("Please upload a PDF, JPG or PNG file only.", 400);
          validateFile(file);

          const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(file.name);
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) return jsonError("AI extraction is not configured yet.", 500);

          const userContent = isImage
            ? [
                { type: "text", text: `User-entered property cost: ${propertyCost || "not provided"}. Extract the payment schedule from this image.` },
                { type: "image_url", image_url: { url: await fileToDataUrl(file) } },
              ]
            : `User-entered property cost: ${propertyCost || "not provided"}.\n\nDOCUMENT TEXT:\n${(await extractBasicPdfText(file)).slice(0, 80_000)}`;

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
                { role: "user", content: userContent },
              ],
            }),
          });

          if (!response.ok) {
            return jsonError(
              response.status === 429
                ? "AI extraction is busy right now. Please try again shortly."
                : "The image quality is too low to read. Please try a clearer photo or upload the PDF directly.",
              response.status,
            );
          }

          const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
          const content = payload.choices?.[0]?.message?.content ?? "{}";
          const parsed = responseSchema.safeParse(JSON.parse(content));
          if (!parsed.success) {
            return jsonError("The image quality is too low to read. Please try a clearer photo or upload the PDF directly.", 422);
          }
          if (parsed.data.stages.length === 0) {
            return jsonError("We couldn't find a payment schedule in this document. Please enter the stages manually below.", 422);
          }

          return Response.json(parsed.data);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The image quality is too low to read. Please try a clearer photo or upload the PDF directly.";
          return jsonError(message, message.includes("File too large") || message.includes("PDF, JPG or PNG") ? 400 : 500);
        }
      },
    },
  },
});

async function requireAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in before extracting a payment plan.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in before extracting a payment plan.");
}

function validateFile(file: File) {
  const name = file.name.toLowerCase();
  const valid = name.endsWith(".pdf") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || file.type === "application/pdf" || file.type === "image/jpeg" || file.type === "image/png";
  if (!valid) throw new Error("Please upload a PDF, JPG or PNG file only.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large. Please upload under 10MB or take a photo instead.");
}

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
}

async function extractBasicPdfText(file: File) {
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  const matches = [...text.matchAll(/\(([^()]|\\.)*\)\s*Tj|\[((?:.|\n|\r)*?)\]\s*TJ/g)];
  return matches.map((m) => decodePdfString(m[0])).join("\n").replace(/\s+/g, " ");
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

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}