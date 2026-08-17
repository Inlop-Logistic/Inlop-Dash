/**
 * KARAM · app.js — bootstrap, router y navegación
 */
(function () {
  const ROUTES = [
    { path: '/dashboard', title: 'Inicio', icon: '🏠', view: 'dashboard', group: 'main' },
    { path: '/pedidos', title: 'Pedidos', icon: '🧾', view: 'orders', group: 'main' },
    { path: '/ventas', title: 'Ventas', icon: '💰', view: 'ventas', group: 'main' },
    { path: '/caja', title: 'Caja', icon: '🏦', view: 'caja', group: 'main' },
    { path: '/inventario', title: 'Inventario', icon: '📦', view: 'inventario', group: 'main' },
    { path: '/productos', title: 'Productos', icon: '🍽️', view: 'productos', group: 'more' },
    { path: '/compras', title: 'Compras', icon: '🛒', view: 'compras', group: 'more' },
    { path: '/gastos', title: 'Gastos', icon: '💸', view: 'gastos', group: 'more' },
    { path: '/promociones', title: 'Promociones', icon: '🏷️', view: 'promociones', group: 'more' },
    { path: '/pagos', title: 'Pagos', icon: '💳', view: 'pagos', group: 'more' },
    { path: '/capital', title: 'Capital', icon: '🧮', view: 'capital', group: 'more' },
    { path: '/socios', title: 'Socios', icon: '🤝', view: 'socios', group: 'more' },
    { path: '/reportes', title: 'Reportes', icon: '📊', view: 'reportes', group: 'more' },
    { path: '/configuracion', title: 'Configuración', icon: '⚙️', view: 'configuracion', group: 'more' },
  ];

  const main = document.getElementById('appMain');
  const viewTitle = document.getElementById('viewTitle');
  let currentPath = '/dashboard';

  function routeFor(path) {
    return ROUTES.find((r) => r.path === path) || ROUTES[0];
  }

  async function render(path) {
    const route = routeFor(path);
    currentPath = route.path;
    viewTitle.textContent = route.title;
    highlightNav(route.path);
    try {
      await window.KaramViews[route.view](main);
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="card"><p>Ocurrió un error al cargar esta sección.</p><pre class="err-pre">${(err && err.message) || err}</pre></div>`;
    }
    await refreshAlertsDot();
  }

  function highlightNav(path) {
    document.querySelectorAll('#bottomNav a[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === path));
    document.querySelectorAll('#sidebarNav a').forEach((a) => a.classList.toggle('active', a.dataset.route === path));
  }

  function navigate(path) {
    location.hash = '#' + path;
  }

  function buildSidebar() {
    const nav = document.getElementById('sidebarNav');
    nav.innerHTML = ROUTES.map((r) => `<a href="#${r.path}" data-route="${r.path}"><span>${r.icon}</span>${r.title}</a>`).join('')
      + `<a href="#" id="sidebarLogout"><span>⎋</span>Cerrar sesión</a>`;
    nav.querySelector('#sidebarLogout').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  }

  function buildMoreSheet() {
    const grid = document.getElementById('moreGrid');
    grid.innerHTML = ROUTES.filter((r) => r.group === 'more').map((r) => `
      <a href="#${r.path}" class="more-tile" data-route="${r.path}"><span class="more-icon">${r.icon}</span>${r.title}</a>
    `).join('');
    grid.addEventListener('click', () => closeSheet());
  }

  function openSheet() { document.getElementById('moreSheet').classList.add('open'); }
  function closeSheet() { document.getElementById('moreSheet').classList.remove('open'); }

  async function refreshAlertsDot() {
    const ingredients = await KaramRepo.ingredients.all();
    const low = ingredients.some((i) => Number(i.stock) <= Number(i.minStock || 0));
    document.getElementById('alertsDot').hidden = !low;
  }

  function logout() {
    KaramAuth.logout();
    location.hash = '';
    showLogin();
  }

  function showLogin() {
    document.getElementById('loginScreen').hidden = false;
    document.getElementById('appShell').hidden = true;
  }

  async function showApp() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('appShell').hidden = false;
    buildSidebar();
    buildMoreSheet();
    const path = (location.hash || '#/dashboard').replace('#', '') || '/dashboard';
    await render(path);
  }

  window.addEventListener('hashchange', () => {
    const path = location.hash.replace('#', '') || '/dashboard';
    render(path);
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('moreBtn').addEventListener('click', (e) => { e.preventDefault(); openSheet(); });
  document.getElementById('moreClose').addEventListener('click', closeSheet);
  document.getElementById('moreSheet').addEventListener('click', (e) => { if (e.target.id === 'moreSheet') closeSheet(); });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('alertsBtn').addEventListener('click', () => navigate('/inventario'));

  document.getElementById('fabNewOrder').addEventListener('click', async () => {
    if (currentPath !== '/pedidos') navigate('/pedidos');
    setTimeout(() => document.getElementById('btnNewOrderTop')?.click(), currentPath !== '/pedidos' ? 200 : 0);
  });

  // -------------------------------------------------------------- Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.hidden = true;
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const result = await KaramAuth.login(username, password);
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.hidden = false;
      return;
    }
    await showApp();
  });

  // -------------------------------------------------------------- Bootstrap
  window.KaramApp = {
    refresh: () => render(currentPath),
    navigate,
  };

  async function boot() {
    await KaramRepo.seedIfEmpty();
    if (KaramAuth.getSession()) {
      await showApp();
    } else {
      showLogin();
    }
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
    }
  }

  boot();
})();
