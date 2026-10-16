// Tabela de preços oficial (servidor). Ao mudar um kit nas páginas de produto,
// atualize aqui também — pedidos com valor diferente são recusados.
// Chave = unidades do kit, valor = preço de 1 kit.
export const CATALOG = {
  solar:         { 2: 107.90, 4: 127.90 },
  led:           { 3: 79.90, 6: 139.90 },
  'lampada-led': { 2: 87.90, 4: 117.90 },
  jardim:        { 2: 87.90, 4: 107.90 }, // Luminária Solar Externa de Jardim (promo-liquidacao.html)
};

// "Quantos kits?" nas páginas de produto: a pessoa pode levar vários kits iguais.
// Mesmo limite do script.js (changeKitQty); 10 kits de 6 = 60 unidades, abaixo
// do limite de 100 unidades do process-payment.
export const MAX_KITS = 10;

const SHIPPING_PRICES = [0, 19.90];

// Adicionais (carrinho lateral e checkout). A ordem precisa ser a mesma do
// checkout (luminaria, refletores, envio) para a soma dar exatamente igual.
export function bumpPrices(productType) {
  return {
    luminaria:  productType === 'led' ? 59.90 : 49.90,
    refletores: 78.90,
    envio:      9.90,
    garantia:   5.90,
  };
}

export function bumpTotalFor(productType, orderBumps) {
  if (!orderBumps || typeof orderBumps !== 'object') return 0;
  return Object.entries(bumpPrices(productType))
    .filter(([k]) => orderBumps[k] === true)
    .reduce((sum, [, v]) => sum + v, 0);
}

// Adicionais do carrinho que liberam o desconto de 5% no Pix
export const PIX_DISCOUNT_ADDONS = ['luminaria', 'refletores'];

export function hasPixDiscount(isPix, orderBumps) {
  return !!isPix && !!orderBumps && PIX_DISCOUNT_ADDONS.some(k => orderBumps[k] === true);
}

// Todos os totais válidos para o pedido (mesma fórmula do checkout).
// Uma quantidade pode vir de kits diferentes — ex.: 4 unidades = 1 kit de 4
// ou 2 kits de 2 — então cada combinação possível entra na lista.
// Lista vazia = produto, quantidade ou frete fora do catálogo.
// O desconto de 5% (Pix + adicional do carrinho) vale sobre kits + frete.
export function validOrderTotals({ productType, quantity, shippingPrice, orderBumps, isPix }) {
  if (!Object.prototype.hasOwnProperty.call(CATALOG, productType)) return [];

  const ship = Number(shippingPrice) || 0;
  if (!SHIPPING_PRICES.some(p => Math.abs(p - ship) < 0.005)) return [];

  const bumpTotal = bumpTotalFor(productType, orderBumps);
  const pixDiscount = hasPixDiscount(isPix, orderBumps);

  const totals = [];
  for (const [kitQty, kitPrice] of Object.entries(CATALOG[productType])) {
    const kits = quantity / Number(kitQty);
    if (!Number.isInteger(kits) || kits < 1 || kits > MAX_KITS) continue;
    // Mesmo arredondamento do script.js (applyKitPricing)
    const kitsPrice = Math.round(kitPrice * kits * 100) / 100;
    const total = pixDiscount ? (kitsPrice + ship) * 0.95 + bumpTotal : kitsPrice + ship + bumpTotal;
    totals.push(Math.round(total * 100) / 100);
  }
  return totals;
}

export function isValidOrderTotal(order, totalPrice) {
  return validOrderTotals(order).some(t => Math.abs(t - totalPrice) <= 0.01);
}

// Composição da compra gravada no pedido (para o dashboard): kit, adicionais com
// origem (carrinho lateral x order bump do checkout), frete e desconto Pix.
// Só é chamada depois de isValidOrderTotal, então sempre existe um kit que fecha o valor.
export function orderBreakdown({ productType, quantity, shippingPrice, orderBumps, isPix, cartAddons }, totalPrice) {
  const ship = Number(shippingPrice) || 0;
  const prices = bumpPrices(productType);
  const bumpTotal = bumpTotalFor(productType, orderBumps);
  const pixDiscount = hasPixDiscount(isPix, orderBumps);
  const fromCart = new Set(Array.isArray(cartAddons) ? cartAddons : []);

  let kit = null;
  for (const [kitQty, kitPrice] of Object.entries(CATALOG[productType] || {})) {
    const kits = quantity / Number(kitQty);
    if (!Number.isInteger(kits) || kits < 1 || kits > MAX_KITS) continue;
    const kitsPrice = Math.round(kitPrice * kits * 100) / 100;
    const total = Math.round((pixDiscount ? (kitsPrice + ship) * 0.95 + bumpTotal : kitsPrice + ship + bumpTotal) * 100) / 100;
    if (Math.abs(total - totalPrice) <= 0.01) { kit = { units: quantity, kitUnits: Number(kitQty), kits, price: kitsPrice }; break; }
  }

  const addons = Object.keys(prices)
    .filter(k => orderBumps?.[k] === true)
    .map(k => ({ key: k, price: prices[k], origin: fromCart.has(k) ? 'carrinho' : 'checkout' }));

  // Mesmo valor que o checkout mostra: (preço cheio) − (valor cobrado no Pix)
  const discount = pixDiscount && kit ? Math.round((kit.price + ship + bumpTotal - totalPrice) * 100) / 100 : 0;
  return { productType, kit, addons, shipping: ship, pixDiscount: discount, total: totalPrice };
}
