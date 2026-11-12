const THEME_STORAGE_KEY = 'pedidosDjuTheme';

function initializeAdminTheme() {
    let theme = 'light';
    try {
        theme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    } catch (error) {
        console.error('Não foi possível carregar a preferência de tema:', error);
    }

    document.body.dataset.theme = theme;
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☼' : '◐';
}

document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('admin-login');
    const loginForm = document.getElementById('admin-login-form');
    const passwordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('admin-login-error');
    const dashboard = document.getElementById('admin-layout');
    const sheetLink = document.getElementById('orders-sheet-link');
    const sheetLinkHelp = document.getElementById('sheet-link-help');
    const config = window.PEDIDOS_DJU_CONFIG || {};

    if (config.ordersSheetUrl) {
        sheetLink.href = config.ordersSheetUrl;
        sheetLink.hidden = false;
        sheetLinkHelp.hidden = true;
    } else {
        sheetLink.hidden = true;
        sheetLinkHelp.hidden = false;
    }

    loginForm.addEventListener('submit', event => {
        event.preventDefault();
        if (passwordInput.value !== config.adminPassword) {
            passwordInput.value = '';
            loginError.hidden = false;
            passwordInput.setAttribute('aria-invalid', 'true');
            passwordInput.focus();
            return;
        }

        login.hidden = true;
        dashboard.hidden = false;
        initializeAdminTheme();
        const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
        document.getElementById('today-label').textContent = today.charAt(0).toUpperCase() + today.slice(1);
    });

    passwordInput.addEventListener('input', () => {
        loginError.hidden = true;
        passwordInput.removeAttribute('aria-invalid');
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        document.body.dataset.theme = theme;
        document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☼' : '◐';
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.error('Não foi possível salvar a preferência de tema:', error);
        }
    });
});
