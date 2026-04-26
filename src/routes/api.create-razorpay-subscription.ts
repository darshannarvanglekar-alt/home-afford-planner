import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requestSchema = z.object({ planType: z.enum(["monthly", "annual"]) });

const PLAN_AMOUNTS = {
  monthly: { amount: 49900, period: "monthly", interval: 1, notes: "HomeAfford Pro Monthly" },
  annual: { amount: 399900, period: "yearly", interval: 1, notes: "HomeAfford Pro Annual" },
} as const;

export const Route = createFileRoute("/api/create-razorpay-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireAuthenticatedUser(request);
          const parsed = requestSchema.safeParse(await request.json());
          if (!parsed.success) return jsonError("Invalid plan selected.", 400);
          const keyId = process.env.RAZORPAY_KEY_ID;
          const keySecret = process.env.RAZORPAY_KEY_SECRET;
          if (!keyId || !keySecret) return jsonError("Payments are not configured yet.", 500);

          const planId = await createRazorpayPlan(parsed.data.planType, keyId, keySecret);
          const subscription = await razorpayFetch<{ id: string }>("/v1/subscriptions", keyId, keySecret, {
            method: "POST",
            body: JSON.stringify({
              plan_id: planId,
              total_count: parsed.data.planType === "monthly" ? 120 : 10,
              customer_notify: 1,
              notes: { userId: user.id, planType: parsed.data.planType },
            }),
          });

          return Response.json({
            keyId,
            subscriptionId: subscription.id,
            name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "",
            email: user.email ?? "",
          });
        } catch (error) {
          return jsonError(error instanceof Error ? error.message : "Couldn't start checkout.", 500);
        }
      },
    },
  },
});

async function createRazorpayPlan(planType: "monthly" | "annual", keyId: string, keySecret: string) {
  const plan = PLAN_AMOUNTS[planType];
  const result = await razorpayFetch<{ id: string }>("/v1/plans", keyId, keySecret, {
    method: "POST",
    body: JSON.stringify({
      period: plan.period,
      interval: plan.interval,
      item: { name: plan.notes, amount: plan.amount, currency: "INR", description: plan.notes },
      notes: { product: "HomeAfford Pro", planType },
    }),
  });
  return result.id;
}

async function razorpayFetch<T>(path: string, keyId: string, keySecret: string, init: RequestInit): Promise<T> {
  const response = await fetch(`https://api.razorpay.com${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error("Payment failed. Please try again.");
  return response.json() as Promise<T>;
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