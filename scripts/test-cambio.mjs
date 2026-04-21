import { config } from 'dotenv';
config();

const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function callDataApi(apiId, options = {}) {
  const baseUrl = BUILT_IN_FORGE_API_URL.endsWith('/') ? BUILT_IN_FORGE_API_URL : `${BUILT_IN_FORGE_API_URL}/`;
  const fullUrl = new URL('webdevtoken.v1.WebDevService/CallApi', baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'connect-protocol-version': '1',
      authorization: `Bearer ${BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      apiId,
      query: options.query,
      body: options.body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Data API request failed (${response.status} ${response.statusText}): ${detail}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === 'object' && 'jsonData' in payload) {
    try { return JSON.parse(payload.jsonData ?? '{}'); } catch { return payload.jsonData; }
  }
  return payload;
}

async function main() {
  console.log('=== Testing BRL=X (USD per BRL — needs 1/x to get R$/USD) ===');
  const r1 = await callDataApi('YahooFinance/get_stock_chart', { query: { symbol: 'BRL=X', region: 'US', interval: '1d', range: '5d' } });
  const meta1 = r1?.chart?.result?.[0]?.meta;
  console.log('BRL=X regularMarketPrice:', meta1?.regularMarketPrice);
  console.log('BRL=X chartPreviousClose:', meta1?.chartPreviousClose);
  if (meta1?.regularMarketPrice) console.log('  => 1/regularMarketPrice (R$/USD):', (1 / meta1.regularMarketPrice).toFixed(4));
  if (meta1?.chartPreviousClose) console.log('  => 1/chartPreviousClose (R$/USD):', (1 / meta1.chartPreviousClose).toFixed(4));

  console.log('\n=== Testing USDBRL=X (R$ per USD — direct) ===');
  const r2 = await callDataApi('YahooFinance/get_stock_chart', { query: { symbol: 'USDBRL=X', region: 'US', interval: '1d', range: '5d' } });
  const meta2 = r2?.chart?.result?.[0]?.meta;
  console.log('USDBRL=X regularMarketPrice:', meta2?.regularMarketPrice);
  console.log('USDBRL=X chartPreviousClose:', meta2?.chartPreviousClose);
}

main().catch(console.error);
