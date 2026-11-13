document.addEventListener('DOMContentLoaded', () => {
    const config = window.PEDIDOS_DJU_CONFIG || {};
    const products = window.DJU_ENCOMENDAS_PRODUCTS || [];
    const form = document.getElementById('encomendas-form');
    const googleForm = document.getElementById('encomendas-google-form');
    const responseFrame = document.getElementById('encomendas-google-form-frame');
    const submitButton = document.getElementById('submit-encomenda');
    const submissionStatus = document.getElementById('encomenda-status');
    const orderDateInput = document.getElementById('order-date');
    const selectedOrderDate = document.getElementById('selected-order-date');
    const calendarMonth = document.getElementById('calendar-month');
    const calendarDays = document.getElementById('calendar-days');
    const previousMonthButton = document.getElementById('calendar-previous');
    const nextMonthButton = document.getElementById('calendar-next');
    const productGrid = document.getElementById('encomendas-products');
    const productCategories = document.getElementById('encomenda-categories');
    const productSearch = document.getElementById('encomenda-search');
    const productCount = document.getElementById('encomenda-product-count');
    const emptyProducts = document.getElementById('encomendas-empty');
    const orderTextarea = document.getElementById('encomenda-products');
    const orderCount = document.getElementById('encomenda-order-count');
    const orderTotal = document.getElementById('encomenda-order-total');
    const entryKeys = ['name', 'whatsapp', 'products', 'orderDate', 'payment'];
    const entries = config.encomendasFormEntries || {};
    const selectedOrderItems = new Map();
    const formatCurrency = amount => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amount);
    let responseTimeout;
    let waitingForResponse = false;
    let activeCategory = 'Todas';

    const formatDate = date => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const dateToIso = date => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');

    function getEarliestOrderDate() {
        const earliestDate = new Date();
        earliestDate.setHours(0, 0, 0, 0);
        earliestDate.setDate(earliestDate.getDate() + 2);
        return earliestDate;
    }

    function renderCategories() {
        const categories = ['Todas', ...new Set(products.map(product => product.category))];
        productCategories.innerHTML = categories.map(category => {
            const count = category === 'Todas'
                ? products.length
                : products.filter(product => product.category === category).length;
            const isActive = category === activeCategory;
            return `<button type="button" class="category-chip${isActive ? ' active' : ''}" data-category="${escapeHtml(category)}" aria-pressed="${isActive}">${escapeHtml(category)} <span>${count}</span></button>`;
        }).join('');
    }

    function renderProducts() {
        const searchTerm = productSearch.value.trim().toLocaleLowerCase('pt-BR');
        const visibleProducts = products.map((product, index) => ({ product, index })).filter(({ product }) => {
            const matchesCategory = activeCategory === 'Todas' || product.category === activeCategory;
            const matchesSearch = `${product.name} ${product.category} ${product.description} ${product.price}`
                .toLocaleLowerCase('pt-BR').includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        productGrid.innerHTML = visibleProducts.map(({ product, index }) => {
            const options = product.orderOptions || [];
            const savedSelection = selectedOrderItems.get(index);
            const optionIndex = savedSelection ? savedSelection.optionIndex : 0;
            const quantity = savedSelection ? savedSelection.quantity : product.minQuantity || 1;
            const option = options[optionIndex] || { label: '', price: product.unitPrice || 0 };
            const quantityLabel = product.quantityLabel || (product.minQuantity ? 'Unidades' : 'Quantidade');
            const minimumQuantity = product.minQuantity || 1;
            const initialTotal = product.unitPrice ? product.unitPrice * quantity : option.price * quantity;
            const optionControl = options.length > 1
                ? `<label>Opção<select data-order-control data-order-option aria-label="Opção para ${escapeHtml(product.name)}">${options.map((item, itemIndex) => `<option value="${itemIndex}"${itemIndex === optionIndex ? ' selected' : ''}>${escapeHtml(item.label)} — ${escapeHtml(formatCurrency(item.price))}</option>`).join('')}</select></label>`
                : options.length === 1
                    ? `<p class="encomenda-product-option">${escapeHtml(options[0].label)}</p>`
                    : '';
            return `
            <article class="product-card encomenda-product-card">
                <div class="product-art">${product.image
                    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy" decoding="async">`
                    : `<span aria-hidden="true">${escapeHtml(product.icon)}</span>`}</div>
                <div class="product-info">
                    <span class="product-category">${escapeHtml(product.category)}</span>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description)}</p>
                    <div class="encomenda-product-price">${escapeHtml(product.price)}</div>
                    <div class="encomenda-product-order" data-product-index="${index}">
                        ${optionControl}
                        <label>${escapeHtml(quantityLabel)}${product.minQuantity ? ` (mínimo ${product.minQuantity})` : ''}<input type="number" min="${minimumQuantity}" step="1" value="${quantity}" data-order-control data-order-quantity aria-label="${escapeHtml(quantityLabel)} para ${escapeHtml(product.name)}"></label>
                        <div class="encomenda-product-estimate"><span>Valor desta seleção</span><strong data-order-price>${escapeHtml(formatCurrency(initialTotal))}</strong></div>
                        <label class="encomenda-select-label"><input type="checkbox" data-order-control data-order-selected${savedSelection ? ' checked' : ''}><span>Adicionar ao pedido</span></label>
                    </div>
                    <a class="encomenda-source-link" href="${escapeHtml(product.menuUrl)}" target="_blank" rel="noopener noreferrer">Menu original e fotos ↗</a>
                </div>
            </article>`;
        }).join('');
        productCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'opção' : 'opções'}`;
        emptyProducts.hidden = visibleProducts.length > 0;
    }

    function getProductTotal(product, selection) {
        if (product.unitPrice) return product.unitPrice * selection.quantity;
        const option = product.orderOptions[selection.optionIndex];
        return option.price * selection.quantity;
    }

    function renderOrderSummary() {
        let total = 0;
        const lines = [];
        selectedOrderItems.forEach((selection, productIndex) => {
            const product = products[productIndex];
            const option = (product.orderOptions || [])[selection.optionIndex];
            const lineTotal = getProductTotal(product, selection);
            const quantityDetails = product.unitPrice
                ? `${selection.quantity} unidades`
                : option.units
                    ? `${option.units * selection.quantity} unidades · ${option.label.replace(/^\d+\s+unidades?\s*[·-]\s*/i, '')}${selection.quantity > 1 ? ` · ${selection.quantity} pacotes` : ''}`
                    : `${option.label}${selection.quantity > 1 ? ` · ${selection.quantity} unidades` : ''}`;
            lines.push(`• ${product.name} — ${quantityDetails}: ${formatCurrency(lineTotal)}`);
            total += lineTotal;
        });

        orderTextarea.value = lines.length
            ? `${lines.join('\n')}\n\nTOTAL ESTIMADO: ${formatCurrency(total)}`
            : '';
        orderCount.textContent = lines.length
            ? `${lines.length} ${lines.length === 1 ? 'produto selecionado' : 'produtos selecionados'}`
            : 'Nenhum produto selecionado.';
        orderTotal.textContent = formatCurrency(total);
    }

    function handleProductOrderChange(event) {
        if (!event.target.matches('[data-order-control]')) return;
        const orderControls = event.target.closest('.encomenda-product-order');
        const productIndex = Number(orderControls.dataset.productIndex);
        const product = products[productIndex];
        const quantityInput = orderControls.querySelector('[data-order-quantity]');
        const minimumQuantity = product.minQuantity || 1;
        let quantity = Number(quantityInput.value);
        if (!Number.isInteger(quantity) || quantity < minimumQuantity) {
            quantity = minimumQuantity;
            quantityInput.value = String(minimumQuantity);
        }
        const optionSelect = orderControls.querySelector('[data-order-option]');
        const optionIndex = optionSelect ? Number(optionSelect.value) : 0;
        const selection = { optionIndex, quantity };
        orderControls.querySelector('[data-order-price]').textContent = formatCurrency(getProductTotal(product, selection));

        const checkbox = orderControls.querySelector('[data-order-selected]');
        if (event.target === checkbox) {
            if (checkbox.checked) selectedOrderItems.set(productIndex, selection);
            else selectedOrderItems.delete(productIndex);
        } else if (checkbox.checked) {
            selectedOrderItems.set(productIndex, selection);
        }
        renderOrderSummary();
    }

    let earliestOrderDate = getEarliestOrderDate();
    let displayedMonth = new Date(earliestOrderDate.getFullYear(), earliestOrderDate.getMonth(), 1);

    function renderCalendar() {
        calendarMonth.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(displayedMonth);
        const monthStart = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
        const firstWeekday = (monthStart.getDay() + 6) % 7;
        const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
        const earliestMonth = new Date(earliestOrderDate.getFullYear(), earliestOrderDate.getMonth(), 1);
        previousMonthButton.disabled = displayedMonth <= earliestMonth;
        calendarDays.innerHTML = `${'<span class="calendar-empty" aria-hidden="true"></span>'.repeat(firstWeekday)}${Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
            const isoDate = dateToIso(date);
            const isUnavailable = date < earliestOrderDate;
            const isSelected = orderDateInput.value === isoDate;
            return `<button class="calendar-day${isSelected ? ' selected' : ''}" type="button" data-order-date="${isoDate}" aria-label="${formatDate(date)}" aria-pressed="${isSelected}"${isUnavailable ? ' disabled' : ''}>${day}</button>`;
        }).join('')}`;
    }

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

    calendarDays.addEventListener('click', event => {
        const dayButton = event.target.closest('[data-order-date]');
        if (!dayButton || dayButton.disabled) return;
        const [year, month, day] = dayButton.dataset.orderDate.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        if (selectedDate < earliestOrderDate) return;
        orderDateInput.value = dayButton.dataset.orderDate;
        selectedOrderDate.textContent = `Data escolhida: ${formatDate(selectedDate)}.`;
        renderCalendar();
    });

    previousMonthButton.addEventListener('click', () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        renderCalendar();
    });
    nextMonthButton.addEventListener('click', () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        renderCalendar();
    });
    renderCalendar();
    renderCategories();
    renderProducts();
    renderOrderSummary();

    productSearch.addEventListener('input', renderProducts);
    productGrid.addEventListener('change', handleProductOrderChange);
    productCategories.addEventListener('click', event => {
        const categoryButton = event.target.closest('[data-category]');
        if (!categoryButton) return;
        activeCategory = categoryButton.dataset.category;
        renderCategories();
        renderProducts();
    });

    responseFrame.addEventListener('load', () => {
        if (!waitingForResponse) return;
        waitingForResponse = false;
        window.clearTimeout(responseTimeout);
        submitButton.disabled = true;
        submitButton.innerHTML = 'Solicitação enviada <span aria-hidden="true">✓</span>';
        setSubmissionStatus('O formulário respondeu; a equipe confirmará o recebimento, a disponibilidade e os valores pelo WhatsApp.', 'pending');
    });

    responseFrame.addEventListener('error', () => {
        if (!waitingForResponse) return;
        waitingForResponse = false;
        window.clearTimeout(responseTimeout);
        submitButton.disabled = false;
        submitButton.innerHTML = 'Tentar enviar novamente <span aria-hidden="true">♡</span>';
        setSubmissionStatus('Não foi possível completar a comunicação com o Google Forms. Confira sua conexão e tente novamente.', 'error');
    });

    form.addEventListener('submit', event => {
        event.preventDefault();
        earliestOrderDate = getEarliestOrderDate();
        renderCalendar();
        const selectedDateParts = orderDateInput.value.split('-').map(Number);
        const selectedDate = selectedDateParts.length === 3
            ? new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2])
            : null;
        if (!selectedDate || Number.isNaN(selectedDate.getTime()) || dateToIso(selectedDate) !== orderDateInput.value || selectedDate < earliestOrderDate) {
            setSubmissionStatus('Escolha no calendário uma data válida com pelo menos 2 dias de antecedência.', 'error');
            calendarDays.focus();
            return;
        }
        if (!selectedOrderItems.size) {
            setSubmissionStatus('Selecione pelo menos um produto no catálogo para preencher o pedido e calcular o valor estimado.', 'error');
            return;
        }
        if (!config.encomendasFormUrl || entryKeys.some(key => !/^\d+$/.test(String(entries[key] || '')))) {
            setSubmissionStatus('O formulário de encomendas ainda não foi configurado. Aguarde a configuração do link e das perguntas pela confeitaria.', 'error');
            return;
        }

        const formData = new FormData(form);
        const additionalDetails = formData.get('details').trim();
        const paymentValues = {
            'Pix': 'pix',
            'Dinheiro/espécie': 'dinheiro em especie',
            'Cartão de crédito': 'cartão de credito'
        };
        const values = {
            name: formData.get('customerName').trim(),
            whatsapp: formData.get('customerWhatsapp').trim(),
            products: [
                formData.get('products').trim(),
                additionalDetails ? `Detalhes adicionais: ${additionalDetails}` : ''
            ].filter(Boolean).join('\n\n'),
            orderDate: orderDateInput.value,
            payment: paymentValues[formData.get('payment')]
        };

        try {
            const responseUrl = new URL(config.encomendasFormUrl);
            responseUrl.pathname = responseUrl.pathname.replace(/\/viewform\/?$/, '/formResponse');
            responseUrl.search = '';
            if (!responseUrl.pathname.endsWith('/formResponse')) {
                throw new Error('URL do formulário de encomendas inválida.');
            }
            googleForm.action = responseUrl.toString();
            const fbzx = `${Date.now()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
            const answers = entryKeys.map(key => [
                null,
                Number(entries[key]),
                [values[key]],
                0
            ]);

            entryKeys.forEach(key => setGoogleFormValue(key, values[key]));
            setGoogleSystemValue('fvv', '1');
            setGoogleSystemValue('partialResponse', JSON.stringify([answers, null, fbzx]));
            setGoogleSystemValue('pageHistory', '0');
            setGoogleSystemValue('fbzx', fbzx);
            setGoogleSystemValue('submissionTimestamp', '-1');
        } catch (error) {
            console.error('Não foi possível preparar o envio do formulário de encomendas:', error);
            setSubmissionStatus('Não foi possível preparar a solicitação. Avise a confeitaria.', 'error');
            return;
        }

        waitingForResponse = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando solicitação…';
        setSubmissionStatus('Enviando sua solicitação ao formulário de encomendas…', 'pending');
        responseTimeout = window.setTimeout(() => {
            if (!waitingForResponse) return;
            waitingForResponse = false;
            submitButton.disabled = false;
            submitButton.innerHTML = 'Tentar enviar novamente <span aria-hidden="true">♡</span>';
            setSubmissionStatus('Ainda não recebemos resposta do Google Forms. Verifique a conexão; uma nova tentativa pode gerar uma solicitação duplicada.', 'error');
        }, 20000);
        googleForm.submit();
    });
});
