const { z } = require('zod');
const config = require('./config');

// Mirrors Component.DEFAULT_CART in the widget's index.html, so an agent
// browsing "the same store" via MCP sees the same demo catalog a human
// would see in the conversational UI.
const DEMO_CART = [
  { name: 'Słuchawki bezprzewodowe', qty: 1, price: 249 },
  { name: 'Powerbank 20000 mAh', qty: 1, price: 129 },
  { name: 'Kabel USB-C 2 m', qty: 2, price: 39 },
];

function money(v) {
  return v.toFixed(2).replace('.', ',') + ' zł';
}

function jsonResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Registers the Paytalk/Autopay checkout tools on an MCP server instance.
 * Every tool call is a real network call to the live Online v1.1 sandbox
 * (autopay-sandbox/) — same hash-signing and ITN-verification code paths
 * already exercised by the widget itself, not a separate mock.
 */
function registerCheckoutTools(server) {
  server.registerTool(
    'get_cart',
    {
      title: 'Pobierz koszyk demo',
      description:
        'Zwraca przykładowy koszyk sklepu Paytalk (pozycje, ilości, ceny, suma). Użyj przed initiate_payment, żeby znać kwotę do zapłaty.',
      inputSchema: {},
    },
    async () => {
      const total = DEMO_CART.reduce((sum, item) => sum + item.qty * item.price, 0);
      return jsonResult({
        items: DEMO_CART,
        totalAmount: total.toFixed(2),
        totalLabel: money(total),
        currency: 'PLN',
      });
    }
  );

  server.registerTool(
    'initiate_payment',
    {
      title: 'Rozpocznij płatność (sandbox Autopay)',
      description:
        'Startuje transakcję w testowym środowisku Autopay Online v1.1: liczy podpis (Hash) dla podanego zamówienia i metody płatności. To sandbox — żadne prawdziwe pieniądze nie są pobierane.',
      inputSchema: {
        orderId: z.string().min(1).describe('Identyfikator zamówienia, np. "1001"'),
        amount: z.string().regex(/^\d+\.\d{2}$/).describe('Kwota w formacie 0.00, np. "417.00"'),
        customerEmail: z.string().email().describe('E-mail kupującego, na który wysyłane jest potwierdzenie'),
        gatewayId: z.enum(['1', '2', '3']).describe('Metoda płatności: 1 = BLIK, 2 = karta, 3 = przelew online'),
      },
    },
    async ({ orderId, amount, customerEmail, gatewayId }) => {
      try {
        const res = await fetch(config.sandboxBase + '/api/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ orderId, amount, customerEmail, gatewayId }).toString(),
        });
        const json = await res.json();
        if (!res.ok) return errorResult('Sandbox zwrócił błąd: ' + (json.error || res.status));
        return jsonResult(json);
      } catch (err) {
        return errorResult('Nie udało się połączyć z sandboxem: ' + err.message);
      }
    }
  );

  server.registerTool(
    'confirm_payment',
    {
      title: 'Potwierdź płatność (symulacja banku)',
      description:
        'Symuluje odpowiedź banku/kanału płatności w sandboxie: buduje poprawnie podpisany ITN, weryfikuje go tak samo jak prawdziwy endpoint, i zwraca wynik (CONFIRMED/NOTCONFIRMED + status płatności). Wywołaj po initiate_payment, żeby dokończyć testowy zakup.',
      inputSchema: {
        orderId: z.string().min(1),
        amount: z.string().regex(/^\d+\.\d{2}$/),
        gatewayId: z.enum(['1', '2', '3']),
        status: z.enum(['SUCCESS', 'FAILED']).default('SUCCESS').describe('Symulowany wynik po stronie banku'),
      },
    },
    async ({ orderId, amount, gatewayId, status }) => {
      try {
        const res = await fetch(config.sandboxBase + '/api/simulate-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount, gatewayId, status }),
        });
        const json = await res.json();
        if (!res.ok) return errorResult('Sandbox zwrócił błąd: ' + (json.error || res.status));
        return jsonResult(json);
      } catch (err) {
        return errorResult('Nie udało się połączyć z sandboxem: ' + err.message);
      }
    }
  );
}

module.exports = { registerCheckoutTools, DEMO_CART };
