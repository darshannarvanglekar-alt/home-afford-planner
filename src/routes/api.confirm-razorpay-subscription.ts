import { createHmac, timingSafeEqual } from "crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requestSchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  planType: z.enum(["monthly", "annual"]),
});

export const Route = createFileRoute("/api/confirm-razorpay-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return jsonError("Payment verification failed.", 400);
          const secret = process.env.RAZORPAY_KEY_SECRET;
          if (!secret) return jsonError("Payments are not configured yet.", 500);
          if (!verifySignature(parsed.data, secret)) return jsonError("Payment verification failed.", 401);

          const now = new Date();
          const expiry = new Date(now);
          if (parsed.data.planType === "monthly") expiry.setMonth(expiry.getMonth() + 1);
          else expiry.setFullYear(expiry.getFullYear() + 1);

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              plan: "pro",
              plan_type: parsed.data.planType,
              plan_start_date: now.toISOString(),
              plan_expiry: expiry.toISOString(),
              razorpay_subscription_id: parsed.data.razorpay_subscription_id,
            })
            .eq("id", user.id);
          if (error) return jsonError("Payment succeeded, but we couldn't unlock Pro. Please contact support.", 500);

          return Response.json({ success: true });
        } catch (error) {
          return jsonError(error instanceof Error ? error.message : "Payment failed. Please try again.", 500);
        }
      },
    },
  },
});

function verifySignature(data: z.infer<typeof requestSchema>, secret: string) {
  const expected = createHmac("sha256", secret)
    .update(`${data.razorpay_payment_id}|${data.razorpay_subscription_id}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(data.razorpay_signature));
}

async function requireAuthenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Please sign in before upgrading.");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in before upgrading.");
  return data.user;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}