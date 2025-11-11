"use client";

// Price formatting utility
export const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

const normalizeValueType = (value) =>
  typeof value === 'string' ? value.toLowerCase() : value;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const discountIsActive = (discount) => {
  if (!discount) return false;
  if (discount.is_active_now !== undefined) return Boolean(discount.is_active_now);
  if (discount.active !== undefined) return Boolean(discount.active);
  return true;
};

const matchByProduct = (discount, productId) => {
  if (!productId) return false;
  const ids = Array.isArray(discount?.product_ids) ? discount.product_ids : [];
  return ids.some((id) => Number(id) === Number(productId));
};

const matchByUnit = (discount, unitId) => {
  if (!unitId) return false;
  const ids = Array.isArray(discount?.unit_ids) ? discount.unit_ids : [];
  return ids.some((id) => Number(id) === Number(unitId));
};

const isDiscountApplicableToItem = (discount, productId, unitId) => {
  const type = normalizeValueType(discount?.type);
  if (type === 'product') {
    return matchByProduct(discount, productId);
  }
  if (type === 'unit') {
    return matchByUnit(discount, unitId);
  }
  return false;
};

const cacheKeyForDiscount = (discount) => {
  if (discount?.id !== undefined) return `id:${discount.id}`;
  const type = normalizeValueType(discount?.type) || 'unknown';
  const products = Array.isArray(discount?.product_ids)
    ? discount.product_ids.slice().sort().join('-')
    : '';
  const units = Array.isArray(discount?.unit_ids)
    ? discount.unit_ids.slice().sort().join('-')
    : '';
  return `${type}|p:${products}|u:${units}`;
};

const aggregateTotalsForDiscount = (discount, items = [], aggregateCache) => {
  if (!Array.isArray(items) || !items.length) {
    return { quantity: 0, amount: 0 };
  }

  const cacheKey = cacheKeyForDiscount(discount);
  if (aggregateCache && aggregateCache.has(cacheKey)) {
    return aggregateCache.get(cacheKey);
  }

  let totalQuantity = 0;
  let totalAmount = 0;

  items.forEach((item) => {
    if (!isDiscountApplicableToItem(discount, item?.product_id, item?.unit_id)) {
      return;
    }
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    totalQuantity += qty;
    totalAmount += qty * price;
  });

  const result = { quantity: totalQuantity, amount: totalAmount };
  if (aggregateCache) {
    aggregateCache.set(cacheKey, result);
  }
  return result;
};

const tierMatches = (tier, totals) => {
  if (!tier) return false;
  const minQty = tier.min_quantity ?? null;
  const maxQty = tier.max_quantity ?? null;
  const minAmount = tier.min_amount ?? null;
  const maxAmount = tier.max_amount ?? null;

  let quantityOk = true;
  if (minQty !== null || maxQty !== null) {
    const totalQty = totals.quantity || 0;
    if (minQty !== null && totalQty < minQty) quantityOk = false;
    if (maxQty !== null && totalQty > maxQty) quantityOk = false;
  }

  let amountOk = true;
  if (minAmount !== null || maxAmount !== null) {
    const totalAmount = totals.amount || 0;
    if (minAmount !== null && totalAmount < minAmount) amountOk = false;
    if (maxAmount !== null && totalAmount > maxAmount) amountOk = false;
  }

  return quantityOk && amountOk;
};

const selectBestTier = (tiers = [], totals) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = tiers.slice().sort((a, b) => {
    const priorityA = toNumber(a?.priority) ?? 0;
    const priorityB = toNumber(b?.priority) ?? 0;
    if (priorityA === priorityB) {
      const idA = toNumber(a?.id) ?? 0;
      const idB = toNumber(b?.id) ?? 0;
      return idA - idB;
    }
    return priorityA - priorityB;
  });

  let selected = null;
  sorted.forEach((tier) => {
    if (tierMatches(tier, totals)) {
      selected = tier;
    }
  });

  return selected;
};

const applyPercentageDiscount = (currentPrice, value) =>
  currentPrice - (currentPrice * Number(value || 0)) / 100;

const applyNominalDiscount = (currentPrice, value) =>
  Math.max(0, currentPrice - Number(value || 0));

// Calculate discounted price for a single unit based on active discounts
// discounts: array of discount objects with tier support
export function calculateDiscountPrice(
  originalPrice,
  productId,
  unitId,
  discounts = [],
  options = {}
) {
  const basePrice = Number(originalPrice || 0);
  if (!Number.isFinite(basePrice)) return null;
  if (!Array.isArray(discounts) || discounts.length === 0) return null;

  const { items = [], aggregateCache } = options;

  const applicableDiscounts = discounts.filter(
    (discount) => discountIsActive(discount) && isDiscountApplicableToItem(discount, productId, unitId)
  );

  if (applicableDiscounts.length === 0) return null;

  let finalPrice = basePrice;

  applicableDiscounts.forEach((discount) => {
    const valueType = normalizeValueType(discount?.value_type);

    if (valueType === 'tiered') {
      const totals = aggregateTotalsForDiscount(discount, items, aggregateCache);
      const tier = selectBestTier(discount?.tiers, totals);
      if (!tier) return;

      const tierValueType = normalizeValueType(tier.value_type);
      const tierValue = Number(tier.value ?? 0);

      if (tierValueType === 'percentage') {
        finalPrice = applyPercentageDiscount(finalPrice, tierValue);
      } else if (tierValueType === 'nominal') {
        finalPrice = applyNominalDiscount(finalPrice, tierValue);
      }
    } else if (valueType === 'percentage') {
      finalPrice = applyPercentageDiscount(finalPrice, discount.value);
    } else if (valueType === 'nominal') {
      finalPrice = applyNominalDiscount(finalPrice, discount.value);
    }
  });

  const adjustedPrice = Number.isFinite(finalPrice) ? finalPrice : basePrice;
  return adjustedPrice !== basePrice ? adjustedPrice : null;
}

// Calculate total for a list of items applying discounts
export function calculateTotal(items = [], discounts = [], options = {}) {
  const aggregateCache = options?.aggregateCache ?? new Map();
  return (items || []).reduce((sum, item) => {
    const originalPrice = Number(item?.price || 0);
    const discountPrice = calculateDiscountPrice(
      originalPrice,
      item?.product_id,
      item?.unit_id,
      discounts,
      {
        items,
        aggregateCache
      }
    );
    const finalPrice = discountPrice ?? originalPrice;
    return sum + finalPrice * Number(item?.quantity || 1);
  }, 0);
}

// Calculate original total without discounts
export function calculateOriginalTotal(items = []) {
  return (items || []).reduce((sum, item) => {
    const originalPrice = Number(item?.price || 0);
    return sum + originalPrice * Number(item?.quantity || 1);
  }, 0);
}

// Build grouped subtotals by unit_name (fallback to product_name)
export function buildSubtotalsByUnit(items = [], discounts = []) {
  const aggregateCache = new Map();
  const subtotalsByUnit = (items || []).reduce((acc, item) => {
    const key = item?.unit_name || item?.product_name || 'Lainnya';
    const originalPrice = Number(item?.price || 0);
    const discountPrice = calculateDiscountPrice(
      originalPrice,
      item?.product_id,
      item?.unit_id,
      discounts,
      {
        items,
        aggregateCache
      }
    );
    const finalPrice = discountPrice ?? originalPrice;
    const lineTotal = Number(item?.quantity || 0) * finalPrice;
    acc[key] = (acc[key] || 0) + lineTotal;
    return acc;
  }, {});
  return Object.entries(subtotalsByUnit);
}
