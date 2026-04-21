import 'dotenv/config';

const BASE_URL = process.env.BUILT_IN_FORGE_API_URL || '';
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY || '';

async function callDataApi(apiId, query) {
  const baseUrl = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const fullUrl = new URL('webdevtoken.v1.WebDevService/CallApi', baseUrl).toString();
  const resp = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'connect-protocol-version': '1',
      'authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ apiId, query }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${await resp.text()}`);
  const payload = await resp.json();
  if (payload?.jsonData) return JSON.parse(payload.jsonData);
  return payload;
}

async function testCambio(symbol) {
  try {
    const data = await callDataApi('YahooFinance/get_stock_chart', {
      symbol, region: 'US', interval: '1d', range: '5d'
    });
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) { console.log(`${symbol}: NO META`); return; }
    console.log(`\n${symbol}:`);
    console.log(`  regularMarketPrice: ${meta.regularMarketPrice}`);
    console.log(`  chartPreviousClose: ${meta.chartPreviousClose}`);
    console.log(`  previousClose: ${meta.previousClose}`);
    console.log(`  currency: ${meta.currency}`);
    console.log(`  exchangeName: ${meta.exchangeName}`);
  } catch (e) {
    console.log(`${symbol}: ERROR - ${e.message}`);
  }
}

console.log('BASE_URL:', BASE_URL ? BASE_URL.substring(0, 40) + '...' : 'NOT SET');
await testCambio('USDBRL=X');
await testCambio('BRL=X');
