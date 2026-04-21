import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export type PlanId = "morning_call" | "corporativo" | "agro_publisher";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  price: number;        // in BRL cents
  priceMonthly: number; // display price in BRL
  interval: "month";
  trialDays: number;
  features: string[];
  notIncluded?: string[];
  highlight?: boolean;
  badge?: string;
  stripePriceId?: string;
}

export const PLANS: Plan[] = [
  {
    id: "morning_call",
    name: "Morning Call Agro",
    tagline: "Inteligência diária para 1 usuário",
    description:
      "Para produtores, consultores e profissionais que precisam de informação qualificada todo dia.",
    price: 9700,
    priceMonthly: 97,
    interval: "month",
    trialDays: 7,
    features: [
      "WhatsApp Morning Call às 06h",
      "Briefing diário gerado por IA",
      "Resumo semanal e mensal por IA",
      "Cotações em tempo real (8 commodities)",
      "Conversão BRL/saca/arroba",
      "Acesso a todos os artigos agregados",
      "1 usuário",
    ],
    notIncluded: [
      "Múltiplos usuários",
      "E-mail diário às 07h",
      "Esteira de Conteúdo",
      "Posts LinkedIn + Imagem IA",
    ],
  },
  {
    id: "corporativo",
    name: "Corporativo",
    tagline: "Para equipes e consultorias",
    description:
      "Para tradings, cooperativas e consultorias que precisam informar toda a equipe.",
    price: 29700,
    priceMonthly: 297,
    interval: "month",
    trialDays: 7,
    highlight: true,
    badge: "Mais popular",
    features: [
      "Tudo do Morning Call Agro",
      "Até 10 usuários na mesma conta",
      "WhatsApp Morning Call para todos",
      "E-mail diário às 07h (briefing executivo)",
      "Resumo por período personalizado",
      "Painel de uso da equipe",
    ],
    notIncluded: [
      "Esteira de Conteúdo",
      "Posts LinkedIn + Imagem IA",
    ],
  },
  {
    id: "agro_publisher",
    name: "Agro Publisher",
    tagline: "Para quem produz conteúdo no agro",
    description:
      "Para consultores, influenciadores e profissionais que constroem autoridade digital no agronegócio.",
    price: 49700,
    priceMonthly: 497,
    interval: "month",
    trialDays: 7,
    badge: "Premium",
    features: [
      "Tudo do Morning Call Agro",
      "Esteira de Conteúdo completa",
      "Post LinkedIn gerado por IA",
      "Imagem IA (4 variantes de estilo)",
      "Mensagem WhatsApp pronta para envio",
      "Roteiro Instagram e TikTok",
      "Envio para sua base de assinantes",
      "E-mail diário às 07h",
      "Briefing por período personalizado",
    ],
  },
];

// Cache for Stripe price IDs
let _priceIds: Record<PlanId, string> | null = null;

export async function getOrCreateStripePrices(): Promise<Record<PlanId, string>> {
  if (_priceIds) return _priceIds;

  const priceIds: Partial<Record<PlanId, string>> = {};

  for (const plan of PLANS) {
    const products = await stripe.products.search({
      query: `metadata['plan_id']:'${plan.id}'`,
    });

    let productId: string;

    if (products.data.length > 0) {
      productId = products.data[0].id;
    } else {
      const product = await stripe.products.create({
        name: `AgroRSS ${plan.name}`,
        description: plan.description,
        metadata: { plan_id: plan.id },
      });
      productId = product.id;
    }

    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      currency: "brl",
      type: "recurring",
    });

    let priceId: string;

    if (prices.data.length > 0 && prices.data[0].unit_amount === plan.price) {
      priceId = prices.data[0].id;
    } else {
      for (const oldPrice of prices.data) {
        if (oldPrice.unit_amount !== plan.price) {
          await stripe.prices.update(oldPrice.id, { active: false });
        }
      }
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.price,
        currency: "brl",
        recurring: { interval: plan.interval },
        metadata: { plan_id: plan.id },
      });
      priceId = price.id;
    }

    priceIds[plan.id] = priceId;
  }

  _priceIds = priceIds as Record<PlanId, string>;
  return _priceIds;
}

export function getPlanById(planId: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  if (!_priceIds) return undefined;
  const entry = Object.entries(_priceIds).find(([, pid]) => pid === priceId);
  if (!entry) return undefined;
  return getPlanById(entry[0] as PlanId);
}

export function invalidatePriceCache(): void {
  _priceIds = null;
}
