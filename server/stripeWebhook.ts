import type { Express, Request, Response } from "express";
import express from "express";
import { stripe } from "./stripe-products";
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "./subscription";
import { notifyOwner } from "./_core/notification";

export function registerStripeWebhook(app: Express) {
  // MUST use raw body BEFORE express.json() — registered in index.ts before json middleware
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

      let event: any;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Webhook] Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Test events — return verification response
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Webhook] Event received: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            await handleCheckoutCompleted(event.data.object);
            // Notify owner about new subscription
            const session = event.data.object;
            const planId = session.metadata?.plan_id ?? "desconhecido";
            const customerEmail = session.metadata?.customer_email ?? session.customer_email ?? "";
            const customerName = session.metadata?.customer_name ?? "";
            await notifyOwner({
              title: `🌱 Nova assinatura AgroRSS`,
              content: `Novo assinante: ${customerName} (${customerEmail})\nPlano: ${planId}\nStatus: ${session.payment_status ?? "confirmado"}`,
            }).catch((e: any) => console.warn("[Webhook] notifyOwner failed:", e.message));
            break;
          }

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(event.data.object);
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object);
            break;

          case "invoice.payment_failed":
            // Mark subscription as past_due
            await handleSubscriptionUpdated({
              ...event.data.object.subscription,
              status: "past_due",
            });
            break;

          default:
            console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (err: any) {
        console.error(`[Webhook] Error processing event ${event.type}:`, err);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );
}
