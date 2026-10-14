// Tabela de preços oficial (servidor). Ao mudar um kit nas páginas de produto,
// atualize aqui também — pedidos com valor diferente são recusados.
export const CATALOG = {
  solar:         { 2: 107.90, 4: 127.90 },
  led:           { 3: 79.90, 6: 139.90 },
  'lampada-led': { 2: 87.90, 4: 117.90 },
  jardim:        { 2: 87.90, 4: 107.90 }, // Luminária Solar Externa de Jardim (promo-liquidacao.html)
};

const SHIPPING_PRICES = [0, 19.90];

// Adicionais do carrinho que liberam o desconto de 5% no Pix
export const PIX_DISCOUNT_ADDONS = ['luminaria', 'refletores'];

export function hasPixDiscount(isPix, orderBumps) {
  return !!isPix && !!orderBumps && PIX_DISCOUNT_ADDONS.some(k => orderBumps[k] === true);
}

// Total esperado (mesma fórmula do checkout). Retorna null se produto,
// quantidade ou frete não existirem no catálogo.
// pixDiscount: 5% nos produtos+frete — só no Pix e com um adicional do carrinho.
export function expectedOrderTotal({ productType, quantity, shippingPrice, bumpTotal, pixDiscount }) {
  if (!Object.prototype.hasOwnProperty.call(CATALOG, productType)) return null;
  const kit = CATALOG[productType][quantity];
  if (kit === undefined) return null;

  const ship = Number(shippingPrice) || 0;
  if (!SHIPPING_PRICES.some(p => Math.abs(p - ship) < 0.005)) return null;

  const total = pixDiscount ? (kit + ship) * 0.95 + bumpTotal : kit + ship + bumpTotal;
  return Math.round(total * 100) / 100;
}
