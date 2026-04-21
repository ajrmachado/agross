import Stripe from 'stripe';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load env from webdev
try {
  const envContent = readFileSync('/opt/.manus/webdev.sh.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^export\s+([^=]+)="?([^"]*)"?$/);
    if (match) process.env[match[1]] = match[2];
  });
} catch {}

const key = process.env.STRIPE_SECRET_KEY;
console.log('STRIPE_SECRET_KEY presente:', !!key);
console.log('Modo:', key?.startsWith('sk_test') ? 'TEST' : key?.startsWith('sk_live') ? 'LIVE' : 'DESCONHECIDO');
console.log('Prefixo:', key?.substring(0, 15) + '...');

if (!key) {
  console.error('ERRO: STRIPE_SECRET_KEY não configurada!');
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });

try {
  // 1. Listar produtos existentes
  const products = await stripe.products.search({ query: "metadata['plan_id']:'morning_call'" });
  console.log('\n--- Produtos morning_call no Stripe:', products.data.length);
  products.data.forEach(p => console.log(' -', p.id, p.name, JSON.stringify(p.metadata)));

  const products2 = await stripe.products.search({ query: "metadata['plan_id']:'corporativo'" });
  console.log('--- Produtos corporativo no Stripe:', products2.data.length);
  products2.data.forEach(p => console.log(' -', p.id, p.name, JSON.stringify(p.metadata)));

  // 2. Tentar criar uma sessão de checkout de teste
  console.log('\n--- Tentando criar checkout session de teste...');
  
  // Primeiro criar/buscar preço
  let productId;
  if (products.data.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripe.products.create({
      name: 'AgroRSS Morning Call Agro',
      description: 'Plano Morning Call Agro',
      metadata: { plan_id: 'morning_call' },
    });
    productId = product.id;
    console.log('Produto criado:', productId);
  }

  const prices = await stripe.prices.list({ product: productId, active: true, currency: 'brl', type: 'recurring' });
  let priceId;
  if (prices.data.length > 0 && prices.data[0].unit_amount === 9700) {
    priceId = prices.data[0].id;
    console.log('Preço existente:', priceId, 'R$', prices.data[0].unit_amount / 100);
  } else {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: 9700,
      currency: 'brl',
      recurring: { interval: 'month' },
      metadata: { plan_id: 'morning_call' },
    });
    priceId = price.id;
    console.log('Preço criado:', priceId);
  }

  // Criar sessão de checkout
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 7 },
    allow_promotion_codes: true,
    success_url: 'https://agrordsdash-dnudfrkh.manus.space/subscription/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://agrordsdash-dnudfrkh.manus.space/pricing',
    client_reference_id: '1',
    metadata: { user_id: '1', plan_id: 'morning_call', customer_email: 'test@test.com', customer_name: 'Teste' },
  });

  console.log('\n✅ Checkout session criada com sucesso!');
  console.log('URL:', session.url?.substring(0, 80) + '...');
  console.log('ID:', session.id);

} catch (err) {
  console.error('\n❌ ERRO:', err.message);
  console.error('Tipo:', err.type);
  console.error('Code:', err.code);
  console.error('Param:', err.param);
}
