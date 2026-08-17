/**
 * KARAM · calc.js — Motor de costeo, promociones y finanzas
 * -----------------------------------------------------------------------
 * Criterio financiero central de la app:
 *   VENTA ≠ UTILIDAD ≠ CAJA ≠ DINERO DISPONIBLE
 * Cada uno se calcula por separado y nunca se mezclan como sinónimos.
 * -----------------------------------------------------------------------
 */
(function (global) {
  const { isDateInRange, todayKey } = KaramUtils;

  // ---------------------------------------------------------------- Costeo de producto
  function productCost(recipe, ingredientsById) {
    if (!recipe) return 0;
    return recipe.items.reduce((sum, it) => {
      const ing = ingredientsById.get(it.ingredientId);
      const costPerUnit = ing ? Number(ing.costPerUnit) || 0 : 0;
      return sum + costPerUnit * (Number(it.qty) || 0);
    }, 0);
  }

  function productCosting(product, recipe, ingredientsById) {
    const cost = productCost(recipe, ingredientsById);
    const price = Number(product.priceNormal) || 0;
    const utilidad = price - cost;
    const margen = price > 0 ? (utilidad / price) * 100 : 0;
    const priceProm = Number(product.pricePromo) || 0;
    const utilidadProm = priceProm - cost;
    const margenProm = priceProm > 0 ? (utilidadProm / priceProm) * 100 : 0;
    return { cost, price, utilidad, margen, priceProm, utilidadProm, margenProm };
  }

  // ---------------------------------------------------------------- Promociones
  function activePromotionForProduct(productId, promotions, date) {
    const d = date ? new Date(date) : new Date();
    const dow = d.getDay();
    return (promotions || []).find((p) => {
      if (!p.active) return false;
      if (!p.productIds || !p.productIds.includes(productId)) return false;
      if (p.days && p.days.length && !p.days.includes(dow)) return false;
      if (p.startDate && !isDateInRange(d, p.startDate, p.endDate || null)) return false;
      if (p.endDate && !p.startDate && d > new Date(p.endDate)) return false;
      return true;
    }) || null;
  }

  // ---------------------------------------------------------------- Precio de línea de pedido (con promo por combo)
  function lineTotal(product, promotion, qty) {
    const q = Number(qty) || 0;
    const normalPrice = Number(product.priceNormal) || 0;
    if (!promotion) return { total: normalPrice * q, promoApplied: false, promoUnits: 0 };
    const setSize = Number(promotion.qty) || 1;
    const setPrice = Number(promotion.price) || normalPrice * setSize;
    const sets = Math.floor(q / setSize);
    const remainder = q - sets * setSize;
    const total = sets * setPrice + remainder * normalPrice;
    return { total, promoApplied: sets > 0, promoUnits: sets * setSize };
  }

  // ---------------------------------------------------------------- Finanzas
  function sumBy(arr, fn) {
    return arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
  }

  const CASH_IN_TYPES = ['income', 'contribution'];
  const CASH_OUT_TYPES = ['purchase', 'expense', 'withdrawal', 'salary'];

  function cashBalance(cashMovements) {
    return sumBy(cashMovements, (m) => (CASH_IN_TYPES.includes(m.type) ? m.amount : -m.amount));
  }

  function pendingExpensesTotal(expenses) {
    return sumBy(expenses.filter((e) => e.paid === false), (e) => e.amount);
  }

  function capitalOverview({ cashMovements, expenses, settings }) {
    const cajaTotal = cashBalance(cashMovements);
    const capitalProtegido = Number(settings.capitalProtected) || 0;
    const gastosPendientes = pendingExpensesTotal(expenses);
    const reserva = Number(settings.reserveAmount) || 0;
    const disponible = cajaTotal - capitalProtegido - gastosPendientes - reserva;

    const bufferCaution = Math.max(capitalProtegido * 0.2, 50000);
    let semaforo = 'green';
    if (disponible < 0) semaforo = 'red';
    else if (disponible <= bufferCaution) semaforo = 'yellow';

    return { cajaTotal, capitalProtegido, gastosPendientes, reserva, disponible, semaforo };
  }

  // ---------------------------------------------------------------- Reportes agregados
  function filterByDate(arr, dateField, start, end) {
    return arr.filter((x) => isDateInRange(x[dateField], start, end));
  }

  function salesTotals(sales) {
    const total = sumBy(sales, (s) => s.total);
    const cost = sumBy(sales, (s) => s.cost);
    const margin = total - cost;
    const marginPct = total > 0 ? (margin / total) * 100 : 0;
    return { total, cost, margin, marginPct, count: sales.length };
  }

  global.KaramCalc = {
    productCost, productCosting, activePromotionForProduct, lineTotal,
    sumBy, cashBalance, pendingExpensesTotal, capitalOverview,
    filterByDate, salesTotals, CASH_IN_TYPES, CASH_OUT_TYPES,
  };
})(window);
