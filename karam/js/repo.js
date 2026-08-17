/**
 * KARAM · repo.js — Capa Repository
 * -----------------------------------------------------------------------
 * Punto único de acceso a datos. Hoy usa IndexedDB (KaramDB). El día de
 * mañana, para migrar a Supabase, solo hay que reescribir el cuerpo de
 * estas funciones (mismo contrato: mismos nombres, mismos parámetros,
 * siguen devolviendo Promesas) — el resto de la app (views/calc) no
 * debería tocarse.
 * -----------------------------------------------------------------------
 */
(function (global) {
  const { uid, nowISO } = KaramUtils;
  const DB = KaramDB;

  // ---------------------------------------------------------------- CRUD genérico
  function makeRepo(store) {
    return {
      all: () => DB.getAll(store),
      get: (id) => DB.get(store, id),
      remove: (id) => DB.delete(store, id),
      async create(data) {
        const record = Object.assign({ id: uid(), createdAt: nowISO(), updatedAt: nowISO() }, data);
        return DB.put(store, record);
      },
      async update(id, patch) {
        const current = await DB.get(store, id);
        if (!current) throw new Error('Registro no encontrado: ' + id);
        const record = Object.assign({}, current, patch, { id, updatedAt: nowISO() });
        return DB.put(store, record);
      },
      async put(record) {
        return DB.put(store, record);
      },
    };
  }

  const Repo = {
    users: makeRepo('users'),
    products: makeRepo('products'),
    ingredients: makeRepo('ingredients'),
    recipes: makeRepo('recipes'),
    orders: makeRepo('orders'),
    sales: makeRepo('sales'),
    purchases: makeRepo('purchases'),
    expenses: makeRepo('expenses'),
    inventoryMovements: makeRepo('inventory_movements'),
    promotions: makeRepo('promotions'),
    cashMovements: makeRepo('cash_movements'),
    partners: makeRepo('partners'),
    withdrawals: makeRepo('withdrawals'),
    dailyClosings: makeRepo('daily_closings'),

    // -------------------------------------------------------------- settings (doc único)
    async getSettings() {
      let s = await DB.get('settings', 'main');
      if (!s) {
        s = defaultSettings();
        await DB.put('settings', s);
      }
      return s;
    },
    async updateSettings(patch) {
      const current = await Repo.getSettings();
      const next = Object.assign({}, current, patch, { updatedAt: nowISO() });
      await DB.put('settings', next);
      return next;
    },

    // -------------------------------------------------------------- movimientos de caja (helper)
    async addCashMovement({ type, amount, concept, method, reference }) {
      return Repo.cashMovements.create({
        type, // income | purchase | expense | withdrawal | salary | contribution
        amount: Number(amount) || 0,
        concept: concept || '',
        method: method || 'efectivo',
        reference: reference || null,
        date: nowISO(),
      });
    },

    // -------------------------------------------------------------- movimientos de inventario (helper)
    async addInventoryMovement({ ingredientId, type, qty, note, reference }) {
      return Repo.inventoryMovements.create({
        ingredientId,
        type, // entrada | consumo | ajuste | merma
        qty: Number(qty) || 0,
        note: note || '',
        reference: reference || null,
        date: nowISO(),
      });
    },

    async adjustIngredientStock(ingredientId, deltaQty) {
      const ing = await Repo.ingredients.get(ingredientId);
      if (!ing) return null;
      const stock = Math.max(0, (Number(ing.stock) || 0) + Number(deltaQty));
      return Repo.ingredients.update(ingredientId, { stock });
    },
  };

  function defaultSettings() {
    return {
      id: 'main',
      businessName: 'KARAM Shawarma & Grill',
      currency: 'COP',
      priceNormal: 29000,
      pricePromo: 40000,
      promoQty: 2,
      costPerProduct: 12000,
      dailySalesTarget: 200000,
      operatingDays: [2, 3, 4, 5, 6, 0], // martes(2) a domingo(0); lunes(1) cerrado
      promoDays: [2, 3, 4], // martes-jueves
      capitalProtected: 500000,
      reserveAmount: 0,
      whatsappNumber: '',
      payment: {
        bank: '',
        accountNumber: '',
        accountType: 'ahorros',
        holder: '',
        qrDataUrl: '',
      },
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  }

  // -------------------------------------------------------------- seed inicial
  async function seedIfEmpty() {
    const userCount = await DB.count('users');
    if (userCount === 0) {
      const { hashPassword } = KaramAuth;
      const { hash, salt } = await hashPassword('karam2026');
      await Repo.users.create({ username: 'admin', passwordHash: hash, salt, role: 'admin', name: 'Administrador' });
    }

    await Repo.getSettings();

    const prodCount = await DB.count('products');
    if (prodCount === 0) {
      const settings = await Repo.getSettings();

      const ing1 = await Repo.ingredients.create({ name: 'Pan árabe', unit: 'unidad', costPerUnit: 800, stock: 100, minStock: 20 });
      const ing2 = await Repo.ingredients.create({ name: 'Carne shawarma', unit: 'g', costPerUnit: 22, stock: 5000, minStock: 1000 });
      const ing3 = await Repo.ingredients.create({ name: 'Salsa ajo', unit: 'g', costPerUnit: 10, stock: 2000, minStock: 300 });
      const ing4 = await Repo.ingredients.create({ name: 'Vegetales mixtos', unit: 'g', costPerUnit: 6, stock: 3000, minStock: 500 });
      const ing5 = await Repo.ingredients.create({ name: 'Papa francesa', unit: 'g', costPerUnit: 8, stock: 4000, minStock: 800 });

      const product = await Repo.products.create({
        name: 'Shawarma Karam',
        priceNormal: settings.priceNormal,
        pricePromo: settings.pricePromo,
        active: true,
      });

      await Repo.recipes.create({
        productId: product.id,
        items: [
          { ingredientId: ing1.id, qty: 1 },
          { ingredientId: ing2.id, qty: 250 },
          { ingredientId: ing3.id, qty: 40 },
          { ingredientId: ing4.id, qty: 80 },
          { ingredientId: ing5.id, qty: 150 },
        ],
      });

      await Repo.promotions.create({
        name: 'Promo entre semana (2x1 combo)',
        productIds: [product.id],
        price: settings.pricePromo,
        qty: settings.promoQty,
        days: settings.promoDays,
        startDate: null,
        endDate: null,
        active: true,
      });

      await Repo.partners.create({ name: 'Socio 1' });
    }
  }

  global.KaramRepo = Repo;
  global.KaramRepo.seedIfEmpty = seedIfEmpty;
  global.KaramRepo.defaultSettings = defaultSettings;
})(window);
