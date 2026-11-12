document.addEventListener('DOMContentLoaded', () => {
    const config = window.PEDIDOS_DJU_CONFIG || {};
    const products = window.DJU_PRODUCTS || [];
    const storageKey = 'pedidosDjuCart';
    const orderForm = document.getElementById('custom-order-form');
    const googleForm = document.getElementById('google-form-post');
    const responseFrame = document.getElementById('google-form-response-frame');
    const submitButton = document.getElementById('submit-order');
    const submissionStatus = document.getElementById('submission-status');
    const addressFields = document.getElementById('delivery-address-fields');
    const pickupAddressNote = document.getElementById('pickup-address-note');
    const addressInputs = [...addressFields.querySelectorAll('input')];
    let responseTimeout;
    let waitingForResponse = false;

    const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    let cart;
    try {
        cart = JSON.parse(localStorage.getItem(storageKey) || '{"items":{},"fulfillment":""}');
    } catch (error) {
        console.error('Não foi possível carregar o pedido salvo:', error);
        cart = { items: {}, fulfillment: '' };
        submissionStatus.textContent = 'Não foi possível recuperar a cesta salva neste navegador.';
    }
    if (!cart || typeof cart !== 'object') cart = { items: {}, fulfillment: '' };

    const items = cart.items && typeof cart.items === 'object'
        ? Object.entries(cart.items).map(([id, quantity]) => ({
            product: products.find(product => product.id === id),
            quantity: Number(quantity)
        })).filter(item => item.product && Number.isInteger(item.quantity) && item.quantity > 0)
        : [];
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    document.getElementById('order-review-items').innerHTML = items.map(({ product, quantity }) => `
        <article class="order-review-item">
            <span class="cart-item-icon" aria-hidden="true">${escapeHtml(product.icon)}</span>
            <div class="cart-item-details"><strong>${escapeHtml(product.name)}</strong><small>Quantidade: ${quantity} · ${product.startingPrice ? `a partir de ${money(product.price)}` : `${money(product.price)} cada`}</small></div>
            <strong class="cart-item-total">${money(product.price * quantity)}</strong>
        </article>`).join('');
    document.getElementById('order-review-empty').hidden = items.length > 0;
    document.getElementById('order-review-total').hidden = items.length === 0;
    document.getElementById('order-subtotal').textContent = money(subtotal);

    const storedFulfillment = cart.fulfillment === 'Retirada na loja'
        ? 'retirada'
        : cart.fulfillment === 'Consultar entrega' ? 'entrega' : '';
    const fulfillmentInputs = [...orderForm.querySelectorAll('input[name="fulfillment"]')];
    fulfillmentInputs.forEach(input => {
        input.checked = input.value === storedFulfillment;
    });

    function updateAddressFields() {
        const selectedFulfillment = orderForm.querySelector('input[name="fulfillment"]:checked')?.value;
        const isDelivery = selectedFulfillment === 'entrega';
        addressFields.hidden = !isDelivery;
        pickupAddressNote.hidden = selectedFulfillment !== 'retirada';
        addressInputs.forEach(input => {
            input.required = isDelivery && ['street', 'neighborhood', 'houseNumber'].includes(input.name);
        });
    }

    fulfillmentInputs.forEach(input => input.addEventListener('change', updateAddressFields));
    updateAddressFields();

    const entryKeys = ['name', 'whatsapp', 'product', 'quantity', 'fulfillment', 'subtotal', 'payment', 'street', 'neighborhood', 'houseNumber', 'reference', 'location'];
    const entries = config.orderFormEntries || {};

    function setSubmissionStatus(message, state) {
        submissionStatus.textContent = message;
        submissionStatus.dataset.state = state;
    }

    function setGoogleFormValue(entryKey, value) {
        let input = googleForm.querySelector(`[name="entry.${entries[entryKey]}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = `entry.${entries[entryKey]}`;
            googleForm.append(input);
        }
        input.value = value;
    }

    function setGoogleSystemValue(name, value) {
        let input = googleForm.querySelector(`[name="${name}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            googleForm.append(input);
        }
        input.value = value;
    }

    responseFrame.addEventListener('load', () => {
        if (!waitingForResponse) return;
        waitingForResponse = false;
        window.clearTimeout(responseTimeout);
        submitButton.disabled = true;
        submitButton.innerHTML = 'Resposta recebida <span aria-hidden="true">✓</span>';
        setSubmissionStatus('O Google Forms respondeu, mas o site não consegue confirmar se a resposta foi registrada. A equipe da D’ju confirmará o pedido pelo WhatsApp.', 'pending');
    });

    responseFrame.addEventListener('error', () => {
        if (!waitingForResponse) return;
        waitingForResponse = false;
        window.clearTimeout(responseTimeout);
        submitButton.disabled = false;
        submitButton.innerHTML = 'Tentar enviar novamente <span aria-hidden="true">♡</span>';
        setSubmissionStatus('Não foi possível completar a comunicação com o Google Forms. Confira sua conexão e tente novamente.', 'error');
    });

    orderForm.addEventListener('submit', event => {
        event.preventDefault();
        if (!items.length) {
            setSubmissionStatus('Sua cesta está vazia. Volte à vitrine e escolha ao menos um produto.', 'error');
            return;
        }
        if (!config.orderFormUrl || entryKeys.some(key => !/^\d+$/.test(String(entries[key] || '')))) {
            setSubmissionStatus('O envio ainda não está configurado corretamente. Avise a confeitaria.', 'error');
            return;
        }

        const formData = new FormData(orderForm);
        const fulfillment = formData.get('fulfillment');
        const payment = formData.get('payment');
        if (!['entrega', 'retirada'].includes(fulfillment) || !payment) {
            setSubmissionStatus('Escolha como deseja receber e a forma de pagamento.', 'error');
            return;
        }

        const addressValue = fulfillment === 'retirada' ? 'Não se aplica — retirada na confeitaria' : '';
        const values = {
            name: formData.get('customerName').trim(),
            whatsapp: formData.get('customerWhatsapp').trim(),
            product: items.map(({ product, quantity }) => `${quantity}x ${product.name}${product.startingPrice ? ' (preço inicial)' : ''}`).join('; '),
            quantity: items.map(({ quantity }) => quantity).join(', '),
            subtotal: money(subtotal),
            fulfillment,
            payment,
            street: fulfillment === 'retirada' ? addressValue : formData.get('street').trim(),
            neighborhood: fulfillment === 'retirada' ? addressValue : formData.get('neighborhood').trim(),
            houseNumber: fulfillment === 'retirada' ? addressValue : formData.get('houseNumber').trim(),
            reference: fulfillment === 'retirada' ? '' : formData.get('reference').trim(),
            location: fulfillment === 'retirada' ? '' : formData.get('location').trim()
        };

        try {
            const responseUrl = new URL(config.orderFormUrl);
            responseUrl.pathname = responseUrl.pathname.replace(/\/viewform\/?$/, '/formResponse');
            responseUrl.search = '';
            if (!responseUrl.pathname.endsWith('/formResponse')) {
                throw new Error('URL do formulário inválida para envio.');
            }
            googleForm.action = responseUrl.toString();
            const previousPageEntries = ['name', 'whatsapp', 'product', 'quantity', 'fulfillment'];
            previousPageEntries.push('subtotal', 'payment');
            const fbzx = `${Date.now()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
            const partialAnswers = previousPageEntries.map(key => [
                null,
                Number(entries[key]),
                [values[key]],
                0
            ]);

            ['street', 'neighborhood', 'houseNumber', 'reference', 'location'].forEach(key => {
                setGoogleFormValue(key, values[key]);
            });
            setGoogleSystemValue('fvv', '1');
            setGoogleSystemValue('partialResponse', JSON.stringify([partialAnswers, null, fbzx]));
            setGoogleSystemValue('pageHistory', '0,1,2');
            setGoogleSystemValue('fbzx', fbzx);
            setGoogleSystemValue('submissionTimestamp', '-1');
        } catch (error) {
            console.error('Não foi possível preparar o envio ao Google Forms:', error);
            setSubmissionStatus('Não foi possível preparar o formulário para envio. Avise a confeitaria.', 'error');
            return;
        }

        cart.fulfillment = fulfillment === 'retirada' ? 'Retirada na loja' : 'Consultar entrega';
        try {
            localStorage.setItem(storageKey, JSON.stringify(cart));
        } catch (error) {
            console.error('Não foi possível atualizar a forma de recebimento da cesta:', error);
        }

        waitingForResponse = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando solicitação…';
        setSubmissionStatus('Enviando seu pedido com segurança ao formulário da confeitaria…', 'pending');
        responseTimeout = window.setTimeout(() => {
            if (!waitingForResponse) return;
            waitingForResponse = false;
            submitButton.disabled = false;
            submitButton.innerHTML = 'Tentar enviar novamente <span aria-hidden="true">♡</span>';
            setSubmissionStatus('Ainda não recebemos resposta do Google Forms. Verifique a conexão; se tentar novamente, a confeitaria poderá receber o pedido duplicado.', 'error');
        }, 20000);
        googleForm.submit();
    });
});
