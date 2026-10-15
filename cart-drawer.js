// Carrinho lateral (painel suspenso) — abre por cima da página do produto
// ao clicar em "COMPRAR AGORA" e, dali, segue para o checkout.
// Uso: window.openCartDrawer(params) com os mesmos parâmetros que iam para o checkout
// (qty, price, oldPrice, light, product).
(function () {
    // Preços dos adicionais — precisam bater com checkout.html e api/process-payment.js
    function luminariaOffer(productType) {
        return productType === 'led'
            ? { name: 'Leve +3 luminárias LED', desc: 'Mais 3 unidades com desconto exclusivo', price: 59.90 }
            : { name: 'Leve +2 luminárias', desc: 'Mais 2 unidades com desconto exclusivo', price: 49.90 };
    }
    var REFLETORES_PRICE = 78.90;

    function productInfo(productType, light) {
        var map = {
            solar:         { name: 'Luminária Solar de Parede',
                             img: light === 'warm' ? 'treslumi.jpg' : 'luminaria-white.jpg' },
            led:           { name: 'Kit Luminária LED Sem Fio',
                             img: 'https://lojaskazamestra.com.br/cdn/shop/files/luminariaLedPilhasPrincipal05_800x.jpg' },
            'lampada-led': { name: 'Lâmpada LED Solar Max',
                             img: 'https://userelux.com.br/cdn/shop/files/Disenosintitulo_15_1024x.png?v=1773090670' },
            jardim:        { name: 'Luminária Solar Externa de Jardim',
                             img: light === 'warm' ? 'jardim-principal.jpg' : 'jardim-frente.jpg' },
        };
        return map[productType] || map.solar;
    }

    function variantLabel(productType, qty, light) {
        if (productType === 'lampada-led') return qty + ' unidades';
        if (productType === 'jardim') return qty + ' unidades — formato ' + light;
        return qty + ' unidades — ' + (light === 'warm' ? 'Luz Quente (Amarela)' : 'Luz Branca (Fria)');
    }

    function fmt(n) { return 'R$ ' + n.toFixed(2).replace('.', ','); }

    var CSS = `
    #jr-cart-overlay {
        position: fixed; inset: 0; background: rgba(10, 20, 17, .55);
        opacity: 0; visibility: hidden; transition: opacity .3s, visibility .3s; z-index: 100000;
    }
    #jr-cart-overlay.open { opacity: 1; visibility: visible; }
    #jr-cart {
        position: fixed; top: 5vh; right: 0; width: 90vw; height: 90vh;
        background: #f0f2f5; border-radius: 18px 0 0 18px;
        box-shadow: -12px 0 40px rgba(0,0,0,.25);
        transform: translateX(105%); transition: transform .35s cubic-bezier(.22,.8,.3,1);
        z-index: 100001; display: flex; flex-direction: column; overflow: hidden;
        font-family: 'Inter', sans-serif; color: #1a1a1a;
    }
    #jr-cart.open { transform: translateX(0); }
    #jr-cart * { box-sizing: border-box; }
    #jr-cart .jc-head {
        background: #2c4c3b; color: #fff; padding: 14px 18px;
        display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    #jr-cart .jc-head h2 { font-size: 17px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; color: #fff; }
    #jr-cart .jc-close {
        background: rgba(255,255,255,.12); border: none; color: #fff; width: 36px; height: 36px;
        border-radius: 50%; font-size: 22px; line-height: 1; cursor: pointer;
    }
    #jr-cart .jc-close:hover { background: rgba(255,255,255,.22); }
    #jr-cart .jc-body { flex: 1; overflow-y: auto; padding: 16px; }
    #jr-cart .jc-inner { max-width: 620px; margin: 0 auto; }
    #jr-cart .jc-foot { flex-shrink: 0; background: #fff; border-top: 1px solid #e2e8f0; padding: 14px 16px 16px; }
    #jr-cart .jc-card { background: #fff; border-radius: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06); padding: 16px; margin-bottom: 14px; }
    #jr-cart .jc-title { font-size: 15px; font-weight: 700; color: #1A3C34; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }

    #jr-cart .jc-item { display: flex; gap: 14px; align-items: center; }
    #jr-cart .jc-item img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; border: 1px solid #e2e8f0; flex-shrink: 0; }
    #jr-cart .jc-item-info { flex: 1; min-width: 0; }
    #jr-cart .jc-item-name { font-size: 14px; font-weight: 700; line-height: 1.3; }
    #jr-cart .jc-item-variant { font-size: 12px; color: #6b7280; margin-top: 3px; }
    #jr-cart .jc-item-price { text-align: right; flex-shrink: 0; }
    #jr-cart .jc-old { font-size: 12px; color: #6b7280; text-decoration: line-through; }
    #jr-cart .jc-now { font-size: 16px; font-weight: 800; color: #1A3C34; }

    #jr-cart .jc-offer {
        display: flex; gap: 12px; align-items: center; border: 2px dashed #cbd5e1; border-radius: 12px;
        padding: 12px; cursor: pointer; transition: border-color .2s, background .2s; margin-bottom: 12px; user-select: none;
    }
    #jr-cart .jc-offer:last-child { margin-bottom: 0; }
    #jr-cart .jc-offer:hover { border-color: #4CAF50; }
    #jr-cart .jc-offer.selected { border-style: solid; border-color: #4CAF50; background: #f0faf0; }
    #jr-cart .jc-check {
        width: 22px; height: 22px; border-radius: 6px; border: 2px solid #cbd5e1; background: #fff;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 13px; font-weight: 900;
    }
    #jr-cart .jc-offer.selected .jc-check { background: #4CAF50; border-color: #4CAF50; }
    #jr-cart .jc-offer-img {
        width: 56px; height: 56px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0;
        background: #fff7e0; display: flex; align-items: center; justify-content: center; color: #e0a800; font-size: 24px;
    }
    #jr-cart .jc-offer-body { flex: 1; min-width: 0; }
    #jr-cart .jc-badge { display: inline-block; white-space: nowrap; background: #fbbf24; color: #1a1a1a; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; margin-bottom: 4px; letter-spacing: .3px; }
    #jr-cart .jc-offer-name { font-size: 14px; font-weight: 700; line-height: 1.3; }
    #jr-cart .jc-offer-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }
    #jr-cart .jc-offer-price { font-size: 15px; font-weight: 800; color: #388E3C; white-space: nowrap; flex-shrink: 0; }

    #jr-cart .jc-rows { display: flex; flex-direction: column; gap: 6px; font-size: 14px; max-width: 620px; margin: 0 auto; }
    #jr-cart .jc-row { display: flex; justify-content: space-between; }
    #jr-cart .jc-muted { color: #6b7280; }
    #jr-cart .jc-row.jc-total { font-size: 18px; font-weight: 800; color: #1A3C34; padding-top: 8px; border-top: 1px solid #e2e8f0; margin-top: 2px; }
    #jr-cart .jc-pix { color: #388E3C; font-weight: 600; font-size: 13px; }
    #jr-cart .jc-pix.off { color: #b45309; }
    #jr-cart .jc-promo {
        display: flex; align-items: center; gap: 10px; background: #fff7e0; border: 1px solid #fcd34d;
        color: #78350f; border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.35; margin-bottom: 12px;
    }
    #jr-cart .jc-promo strong { color: #1A3C34; }
    #jr-cart .jc-promo.on { background: #f0faf0; border-color: #86efac; color: #166534; }
    #jr-cart .jc-promo-icon { font-size: 20px; flex-shrink: 0; }
    #jr-cart .jc-buy {
        display: block; width: 100%; max-width: 620px; margin: 12px auto 0; border: none; cursor: pointer;
        background: #1A3C34; color: #fff; font-family: inherit; font-size: 17px; font-weight: 800; letter-spacing: .5px;
        padding: 16px; border-radius: 12px; box-shadow: 0 6px 18px rgba(26,60,52,.25); transition: background .2s;
    }
    #jr-cart .jc-buy:hover { background: #24524a; }
    #jr-cart .jc-secure { text-align: center; font-size: 12px; color: #6b7280; margin-top: 8px; }

    @media (max-width: 480px) {
        #jr-cart .jc-body { padding: 12px; }
        #jr-cart .jc-offer {
            display: grid; grid-template-columns: 22px 46px minmax(0, 1fr);
            column-gap: 10px; row-gap: 4px; padding: 10px;
        }
        #jr-cart .jc-offer .jc-check, #jr-cart .jc-offer .jc-offer-img { grid-row: span 2; }
        #jr-cart .jc-offer-img { width: 46px; height: 46px; font-size: 20px; }
        #jr-cart .jc-offer-price { grid-column: 3; font-size: 15px; }
        #jr-cart .jc-rows { gap: 4px; font-size: 13px; }
        #jr-cart .jc-row.jc-total { font-size: 17px; }
        #jr-cart .jc-buy { padding: 14px; margin-top: 10px; }
        #jr-cart .jc-item img { width: 60px; height: 60px; }
    }`;

    var HTML = `
    <div id="jr-cart-overlay"></div>
    <aside id="jr-cart" role="dialog" aria-modal="true" aria-labelledby="jc-heading" aria-hidden="true">
        <div class="jc-head">
            <h2 id="jc-heading"><i class="fas fa-shopping-cart"></i> Seu carrinho</h2>
            <button class="jc-close" type="button" aria-label="Fechar carrinho">&times;</button>
        </div>
        <div class="jc-body">
            <div class="jc-inner">
                <section class="jc-card">
                    <div class="jc-item">
                        <img id="jc-item-img" src="" alt="">
                        <div class="jc-item-info">
                            <div class="jc-item-name" id="jc-item-name"></div>
                            <div class="jc-item-variant" id="jc-item-variant"></div>
                        </div>
                        <div class="jc-item-price">
                            <div class="jc-old" id="jc-old"></div>
                            <div class="jc-now" id="jc-now"></div>
                        </div>
                    </div>
                </section>
                <section class="jc-card">
                    <h3 class="jc-title"><i class="fas fa-gift"></i> Aproveite e adicione ao pedido</h3>
                    <div class="jc-promo" id="jc-promo">
                        <span class="jc-promo-icon" id="jc-promo-icon">🎁</span>
                        <span id="jc-promo-text"></span>
                    </div>
                    <div class="jc-offer" data-offer="luminaria">
                        <div class="jc-check">✓</div>
                        <img class="jc-offer-img" id="jc-lum-img" src="" alt="">
                        <div class="jc-offer-body">
                            <span class="jc-badge">MAIS VENDIDO</span>
                            <div class="jc-offer-name" id="jc-lum-name"></div>
                            <div class="jc-offer-desc" id="jc-lum-desc"></div>
                        </div>
                        <div class="jc-offer-price" id="jc-lum-price"></div>
                    </div>
                    <div class="jc-offer" data-offer="refletores">
                        <div class="jc-check">✓</div>
                        <img class="jc-offer-img" src="refle.png" alt="Refletores solares" style="object-fit: contain; background: #fff;">
                        <div class="jc-offer-body">
                            <span class="jc-badge">OFERTA ESPECIAL</span>
                            <div class="jc-offer-name">Leve também dois refletores solares</div>
                            <div class="jc-offer-desc">2 refletores solares por um preço especial</div>
                        </div>
                        <div class="jc-offer-price">+ ${fmt(REFLETORES_PRICE)}</div>
                    </div>
                </section>
            </div>
        </div>
        <div class="jc-foot">
            <div class="jc-rows">
                <div class="jc-row"><span class="jc-muted">Produtos</span><span id="jc-sub"></span></div>
                <div class="jc-row" id="jc-extras-row" style="display:none;"><span class="jc-muted">Adicionais</span><span id="jc-extras"></span></div>
                <div class="jc-row"><span class="jc-muted">Frete</span><span style="color:#388E3C;font-weight:600;">Grátis</span></div>
                <div class="jc-row jc-total"><span>Total</span><span id="jc-total"></span></div>
                <div class="jc-row jc-pix" id="jc-pix-row"><span id="jc-pix-label"></span><span id="jc-pix"></span></div>
            </div>
            <button class="jc-buy" type="button">COMPRAR AGORA</button>
            <p class="jc-secure">🔒 Pagamento 100% seguro</p>
        </div>
    </aside>`;

    var state = null;
    var built = false;

    function $(id) { return document.getElementById(id); }

    function build() {
        if (built) return;
        built = true;
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        var wrap = document.createElement('div');
        wrap.innerHTML = HTML;
        while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);

        $('jr-cart-overlay').addEventListener('click', close);
        document.querySelector('#jr-cart .jc-close').addEventListener('click', close);
        document.querySelector('#jr-cart .jc-buy').addEventListener('click', goToCheckout);
        document.querySelectorAll('#jr-cart .jc-offer').forEach(function (el) {
            el.addEventListener('click', function () {
                var key = el.getAttribute('data-offer');
                state.selected[key] = !state.selected[key];
                el.classList.toggle('selected', state.selected[key]);
                render();
            });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && $('jr-cart').classList.contains('open')) close();
        });
    }

    function render() {
        var prices = { luminaria: state.lum.price, refletores: REFLETORES_PRICE };
        var extras = Object.keys(state.selected).filter(function (k) { return state.selected[k]; })
            .reduce(function (s, k) { return s + prices[k]; }, 0);
        $('jc-sub').textContent = fmt(state.price);
        $('jc-extras-row').style.display = extras > 0 ? 'flex' : 'none';
        $('jc-extras').textContent = fmt(extras);
        $('jc-total').textContent = fmt(state.price + extras);
        // 5% no Pix só levando um adicional — mesma regra do checkout e do servidor
        var pixOn = extras > 0;
        $('jc-pix-row').classList.toggle('off', !pixOn);
        $('jc-pix-label').textContent = pixOn ? '⚡ No Pix com 5% OFF' : '⚡ Adicione um item e ganhe 5% OFF no Pix';
        $('jc-pix').textContent = pixOn ? fmt(state.price * 0.95 + extras) : '';
        $('jc-promo').classList.toggle('on', pixOn);
        $('jc-promo-icon').textContent = pixOn ? '✅' : '🎁';
        $('jc-promo-text').innerHTML = pixOn
            ? '<strong>Desconto liberado!</strong> Você ganhou 5% OFF pagando no Pix.'
            : 'Adicione <strong>qualquer item abaixo</strong> e ganhe <strong>5% de desconto</strong> pagando no Pix.';
    }

    function goToCheckout() {
        var params = new URLSearchParams(state.params);
        var bumps = Object.keys(state.selected).filter(function (k) { return state.selected[k]; });
        if (bumps.length) {
            params.set('bumps', bumps.join(','));
            params.set('cart', bumps.join(','));   // origem: escolhidos no carrinho lateral (aparece no dashboard)
        }
        window.location.href = 'checkout.html?' + params.toString();
    }

    function close() {
        $('jr-cart').classList.remove('open');
        $('jr-cart').setAttribute('aria-hidden', 'true');
        $('jr-cart-overlay').classList.remove('open');
        document.body.style.overflow = '';
    }

    window.openCartDrawer = function (params) {
        build();
        params = new URLSearchParams(params);
        var productType = params.get('product') || 'solar';
        var light = params.get('light') || 'warm';
        var qty = parseInt(params.get('qty') || '2', 10);
        var price = parseFloat(params.get('price') || '0');
        var oldPrice = parseFloat(params.get('oldPrice') || '0');
        var product = productInfo(productType, light);

        // Reabrir o carrinho mantém os adicionais já marcados
        var keep = state && state.productType === productType ? state.selected : { luminaria: false, refletores: false };
        state = { params: params.toString(), productType: productType, price: price, lum: luminariaOffer(productType), selected: keep };

        $('jc-item-img').src = product.img;
        $('jc-item-img').alt = product.name;
        $('jc-item-name').textContent = product.name;
        $('jc-item-variant').textContent = variantLabel(productType, qty, light);
        $('jc-now').textContent = fmt(price);
        $('jc-old').textContent = oldPrice > price ? fmt(oldPrice) : '';
        $('jc-lum-img').src = product.img;
        $('jc-lum-name').textContent = state.lum.name;
        $('jc-lum-desc').textContent = state.lum.desc;
        $('jc-lum-price').textContent = '+ ' + fmt(state.lum.price);
        document.querySelectorAll('#jr-cart .jc-offer').forEach(function (el) {
            el.classList.toggle('selected', !!state.selected[el.getAttribute('data-offer')]);
        });
        render();

        // Força o navegador a aplicar o estado inicial antes de animar a entrada
        void $('jr-cart').offsetWidth;
        $('jr-cart').classList.add('open');
        $('jr-cart').setAttribute('aria-hidden', 'false');
        $('jr-cart-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        document.querySelector('#jr-cart .jc-close').focus();
    };
})();
