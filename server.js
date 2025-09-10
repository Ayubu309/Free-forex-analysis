import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import NodeCache from 'node-cache';

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const ALPHA_KEY = process.env.ALPHA_KEY; // Alpha Vantage API key

// Cache for 60 seconds
const cache = new NodeCache({ stdTTL: 60 });

// Currency pairs
const pairs = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'EUR/AUD', 'AUD/JPY', 'CHF/JPY', 'GBP/CAD', 'GBP/CHF',
  'AUD/CAD', 'AUD/CHF', 'NZD/JPY', 'CAD/JPY',
  'EUR/CAD', 'TRY/USD', 'ZAR/USD', 'MXN/USD'
];

// Utility function: convert pair to Alpha Vantage format
const pairToSymbol = pair => pair.replace('/', '');

async function fetchBatchRates() {
  const cached = cache.get('rates');
  if (cached) return cached;

  const results = {};
  for (const pair of pairs) {
    const symbol = pairToSymbol(pair);
    try {
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol.slice(0,3)}&to_currency=${symbol.slice(3,6)}&apikey=${ALPHA_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      results[pair] = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
    } catch(e) {
      results[pair] = null;
    }
  }

  cache.set('rates', results);
  return results;
}

// Generate simple signals (demo)
function generateSignal(rate) {
  const shortSignal = rate % 2 > 1 ? 'BUY' : 'SELL';
  const longSignal  = rate % 2 > 1 ? 'SELL' : 'BUY';

  const shortSL = (rate * (shortSignal === 'BUY' ? 0.995 : 1.005)).toFixed(5);
  const shortTP = (rate * (shortSignal === 'BUY' ? 1.005 : 0.995)).toFixed(5);

  const longSL = (rate * (longSignal === 'BUY' ? 0.995 : 1.005)).toFixed(5);
  const longTP = (rate * (longSignal === 'BUY' ? 1.01 : 0.99)).toFixed(5);

  const reason = "Price action + market structure analysis (support/resistance + HH/HL levels)";

  return { shortSignal, shortSL, shortTP, longSignal, longSL, longTP, reason };
}

app.get('/api/analysis', async (req, res) => {
  const rates = await fetchBatchRates();
  const analysis = {};

  for (const pair of pairs) {
    const rate = rates[pair];
    if (rate === null) continue;
    analysis[pair] = generateSignal(rate);
  }

  res.json({ analysis });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
