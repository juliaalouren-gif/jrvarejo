import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sem senha padrão no código (o repositório é público): sem a variável configurada, o painel fica trancado
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { password, from, to, search, status, method, page = 1 } = req.query;
  if (!DASHBOARD_PASSWORD || password !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  const pageSize = 50;
  const pageNum  = Math.max(1, parseInt(page));
  const offset   = (pageNum - 1) * pageSize;

  // Datas com timezone Brasil (UTC-3) para filtrar corretamente
  const fromTs = from ? `${from}T00:00:00-03:00` : null;
  const toTs   = to   ? `${to}T23:59:59-03:00`   : null;

  try {
    // ── 1. Query de pedidos com todos os filtros + paginação ──
    let ordersQ = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (fromTs)                       ordersQ = ordersQ.gte('created_at', fromTs);
    if (toTs)                         ordersQ = ordersQ.lte('created_at', toTs);
    if (status && status !== 'all')   ordersQ = ordersQ.eq('status', status);
    if (method && method !== 'all')   ordersQ = ordersQ.eq('payment_method', method);
    if (search) {
      ordersQ = ordersQ.or(
        `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    const { data: orders, count, error } = await ordersQ.range(offset, offset + pageSize - 1);
    if (error) throw error;

    // Upsells ligados a cada pedido da página (gravados com customer_address.upsell_of = id do pedido)
    const pageIds = (orders || []).map(o => o.id);
    if (pageIds.length) {
      const { data: ups, error: upErr } = await supabase
        .from('orders')
        .select('id, created_at, status, total_price, payment_method, customer_address')
        .in('customer_address->>upsell_of', pageIds)
        .order('created_at', { ascending: true });
      if (upErr) throw upErr;
      const byParent = {};
      (ups || []).forEach(u => {
        const parent = u.customer_address?.upsell_of;
        (byParent[parent] = byParent[parent] || []).push({
          id: u.id, created_at: u.created_at, status: u.status,
          total_price: u.total_price, payment_method: u.payment_method,
          offer: u.customer_address?.offer || 'upsell',
        });
      });
      orders.forEach(o => { o.upsells = byParent[o.id] || []; });
    }

    // ── 2. Stats respeitando filtros de data/método/busca (sem status) ──
    let statsQ = supabase
      .from('orders')
      .select('status, payment_method, total_price, created_at');

    if (fromTs) statsQ = statsQ.gte('created_at', fromTs);
    if (toTs)   statsQ = statsQ.lte('created_at', toTs);
    if (method && method !== 'all') statsQ = statsQ.eq('payment_method', method);
    if (search) {
      statsQ = statsQ.or(
        `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    const { data: filteredRows, error: err2 } = await statsQ;
    if (err2) throw err2;

    // ── 3. Stats gerais (sempre all-time, para referência) ────
    const { data: allRows, error: err3 } = await supabase
      .from('orders')
      .select('status, payment_method, total_price, created_at');
    if (err3) throw err3;

    // "Hoje" no fuso Brasil
    const nowBR  = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todayBR = nowBR.toISOString().slice(0, 10); // YYYY-MM-DD

    function isTodayBR(iso) {
      if (!iso) return false;
      // Converte o created_at (UTC) para data no fuso Brasil
      const d = new Date(iso);
      const brStr = new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return brStr === todayBR;
    }

    function inPeriod(iso) {
      if (!iso) return false;
      const d = new Date(iso);
      if (fromTs && d < new Date(fromTs)) return false;
      if (toTs   && d > new Date(toTs))   return false;
      return true;
    }

    const usePeriod = from || to;
    const periodRows = usePeriod ? filteredRows : allRows.filter(o => isTodayBR(o.created_at));

    // Label do período para os cards "do período"
    let periodoLabel = 'Hoje';
    if (from && to && from === to) periodoLabel = new Date(from + 'T12:00:00').toLocaleDateString('pt-BR');
    else if (from && to)           periodoLabel = `${new Date(from+'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(to+'T12:00:00').toLocaleDateString('pt-BR')}`;
    else if (from)                 periodoLabel = `A partir de ${new Date(from+'T12:00:00').toLocaleDateString('pt-BR')}`;
    else if (to)                   periodoLabel = `Até ${new Date(to+'T12:00:00').toLocaleDateString('pt-BR')}`;

    const stats = {
      // ── Filtrado (data/método/busca) ──
      total_pedidos:      filteredRows.length,
      total_pagos:        filteredRows.filter(o => o.status === 'approved').length,
      total_pix_pendente: filteredRows.filter(o => o.status === 'pending' && o.payment_method === 'pix').length,
      total_faturado:     filteredRows.filter(o => o.status === 'approved').reduce((s, o) => s + parseFloat(o.total_price || 0), 0),
      cartao_total:       filteredRows.filter(o => o.status === 'approved' && o.payment_method !== 'pix').length,
      pix_total:          filteredRows.filter(o => o.status === 'approved' && o.payment_method === 'pix').length,
      // ── Período (hoje se sem filtro, ou intervalo filtrado) ──
      faturado_periodo:   periodRows.filter(o => o.status === 'approved').reduce((s, o) => s + parseFloat(o.total_price || 0), 0),
      pedidos_periodo:    periodRows.length,
      pagos_periodo:      periodRows.filter(o => o.status === 'approved').length,
      periodo_label:      periodoLabel,
      // ── All-time para referência ──
      total_geral:        allRows.length,
      faturado_geral:     allRows.filter(o => o.status === 'approved').reduce((s, o) => s + parseFloat(o.total_price || 0), 0),
    };

    return res.status(200).json({
      stats,
      orders,
      total: count,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
      hasFilters: !!(from || to || (status && status !== 'all') || (method && method !== 'all') || search),
    });

  } catch (err) {
    console.error('Dashboard error:', JSON.stringify(err), err?.message, err?.stack);
    return res.status(500).json({ error: 'Erro interno.', detail: err?.message || String(err) });
  }
}
