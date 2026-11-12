document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('site-toast');
    const products = window.DJU_PRODUCTS || [];
    const cartStorageKey = 'pedidosDjuCart';
    let toastTimer;
    let activeCategory = 'Todas';
    let cart = readCart();

    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('visible');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4500);
    }

    function readCart() {
        try {
            const storedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '{"items":{},"fulfillment":""}');
            const items = storedCart.items && typeof storedCart.items === 'object' ? storedCart.items : {};
            return {
                items: Object.fromEntries(Object.entries(items)
                    .filter(([id, quantity]) => products.some(product => product.id === id) && Number.isInteger(quantity) && quantity > 0)
                    .map(([id, quantity]) => [id, quantity])),
                fulfillment: ['Retirada na loja', 'Consultar entrega'].includes(storedCart.fulfillment) ? storedCart.fulfillment : ''
            };
        } catch (error) {
            console.error('Não foi possível carregar a cesta salva:', error);
            return { items: {}, fulfillment: '' };
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(cartStorageKey, JSON.stringify(cart));
        } catch (error) {
            console.error('Não foi possível salvar a cesta:', error);
            showToast('Não foi possível guardar a cesta neste navegador. Confira as permissões de armazenamento.');
        }
    }

    function renderCart() {
        const cartProducts = products.filter(product => cart.items[product.id]);
        const totalItems = Object.values(cart.items).reduce((sum, quantity) => sum + quantity, 0);
        const subtotal = cartProducts.reduce((sum, product) => sum + product.price * cart.items[product.id], 0);
        document.getElementById('cart-count').textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
        document.getElementById('nav-cart-count').textContent = totalItems;
        document.getElementById('cart-empty').hidden = cartProducts.length > 0;
        document.getElementById('cart-checkout').hidden = cartProducts.length === 0;
        document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
        document.getElementById('cart-items').innerHTML = cartProducts.map(product => `
            <article class="cart-item">
                <span class="cart-item-icon" aria-hidden="true">${escapeHtml(product.icon)}</span>
                <div class="cart-item-details"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.startingPrice ? `A partir de ${formatPrice(product.price)} cada` : `${formatPrice(product.price)} cada`)}</small></div>
                <div class="quantity-control" aria-label="Quantidade de ${escapeHtml(product.name)}">
                    <button type="button" data-quantity-change="-1" data-product-id="${escapeHtml(product.id)}" aria-label="Diminuir quantidade">−</button>
                    <span>${cart.items[product.id]}</span>
                    <button type="button" data-quantity-change="1" data-product-id="${escapeHtml(product.id)}" aria-label="Aumentar quantidade">+</button>
                </div>
                <strong class="cart-item-total">${formatPrice(product.price * cart.items[product.id])}</strong>
                <button class="cart-remove" type="button" data-remove-product="${escapeHtml(product.id)}" aria-label="Remover ${escapeHtml(product.name)}">×</button>
            </article>`).join('');
        document.querySelectorAll('input[name="fulfillment"]').forEach(input => {
            input.checked = input.value === cart.fulfillment;
        });
        document.querySelectorAll('[data-add-product]').forEach(button => {
            button.textContent = cart.items[button.dataset.addProduct] ? `Adicionar mais (${cart.items[button.dataset.addProduct]}) +` : 'Adicionar +';
        });
    }

    function renderProducts() {
        const searchTerm = document.getElementById('product-search').value.trim().toLocaleLowerCase('pt-BR');
        const visibleProducts = products.filter(product => {
            const matchesCategory = activeCategory === 'Todas' || product.category === activeCategory;
            const matchesSearch = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('pt-BR').includes(searchTerm);
            return matchesCategory && matchesSearch;
        });
        const priceLabel = product => product.startingPrice ? `A partir de ${formatPrice(product.price)}` : formatPrice(product.price);

        document.getElementById('products-grid').innerHTML = visibleProducts.map(product => `
            <article class="product-card">
                <div class="product-art" aria-hidden="true"><span>${escapeHtml(product.icon)}</span><i>✦</i></div>
                <div class="product-info">
                    <span class="product-category">${escapeHtml(product.category)}</span>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description)}</p>
                    <div class="product-card-footer">
                        <div class="product-prices"><strong>${priceLabel(product)}</strong>${product.originalPrice ? `<del>${formatPrice(product.originalPrice)}</del>` : ''}</div>
                        <button class="product-order" type="button" data-add-product="${escapeHtml(product.id)}">Adicionar +</button>
                    </div>
                </div>
            </article>`).join('');
        document.getElementById('product-count').textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'produto' : 'produtos'}`;
        document.getElementById('catalog-empty').hidden = visibleProducts.length > 0;
    }

    function renderCategories() {
        const categories = ['Todas', ...new Set(products.map(product => product.category))];
        document.getElementById('product-categories').innerHTML = categories.map(category => {
            const count = category === 'Todas' ? products.length : products.filter(product => product.category === category).length;
            return `<button type="button" class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)} <span>${count}</span></button>`;
        }).join('');
    }

    function formatPrice(price) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
    }

    renderCategories();
    renderProducts();
    renderCart();
    document.getElementById('product-search').addEventListener('input', renderProducts);
    document.getElementById('product-categories').addEventListener('click', event => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        activeCategory = button.dataset.category;
        renderCategories();
        renderProducts();
    });
    document.getElementById('products-grid').addEventListener('click', event => {
        const addButton = event.target.closest('[data-add-product]');
        if (!addButton) return;
        const product = products.find(item => item.id === addButton.dataset.addProduct);
        if (!product) return;
        cart.items[product.id] = (cart.items[product.id] || 0) + 1;
        saveCart();
        renderCart();
        showToast(`${product.name} adicionado à sua cesta.`);
    });
    document.getElementById('cart-items').addEventListener('click', event => {
        const quantityButton = event.target.closest('[data-quantity-change]');
        const removeButton = event.target.closest('[data-remove-product]');
        const productId = quantityButton?.dataset.productId || removeButton?.dataset.removeProduct;
        if (!productId || !cart.items[productId]) return;
        if (removeButton) {
            delete cart.items[productId];
        } else {
            cart.items[productId] += Number(quantityButton.dataset.quantityChange);
            if (cart.items[productId] <= 0) delete cart.items[productId];
        }
        saveCart();
        renderCart();
    });
    document.querySelectorAll('input[name="fulfillment"]').forEach(input => {
        input.addEventListener('change', () => {
            cart.fulfillment = input.value;
            saveCart();
        });
    });
    document.getElementById('continue-order').addEventListener('click', () => {
        if (!Object.keys(cart.items).length) {
            showToast('Adicione ao menos um produto à sua cesta.');
            return;
        }
        if (!cart.fulfillment) {
            showToast('Escolha se prefere retirada ou consultar a entrega.');
            return;
        }
        saveCart();
        window.location.href = 'pedidos.html';
    });
});
