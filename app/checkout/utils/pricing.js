"use client";

// Price formatting utility
export const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

// Calculate discounted price for a single unit based on active discounts
// discounts: array of discount objects with { type: 'product'|'unit', product_ids, unit_ids, value_type, value, active }
export function calculateDiscountPrice(originalPrice, productId, unitId, discounts = []) {
  if (!Array.isArray(discounts) || discounts.length === 0) return null;
  const activeDiscounts = discounts.filter((d) => {
    if (!d?.active) return false;
    if (d.type === 'product' && Array.isArray(d.product_ids)) {
      return d.product_ids.includes(productId);
    }
    if (d.type === 'unit' && Array.isArray(d.unit_ids)) {
      return d.unit_ids.includes(unitId);
    }
    return false;
  });
  if (activeDiscounts.length === 0) return null;
  let finalPrice = Number(originalPrice || 0);
  activeDiscounts.forEach((discount) => {
    if (discount.value_type === 'percentage') {
      finalPrice = finalPrice - (finalPrice * Number(discount.value || 0) / 100);
    } else if (discount.value_type === 'nominal') {
      finalPrice = Math.max(0, finalPrice - Number(discount.value || 0));
    }
  });
  return finalPrice !== Number(originalPrice || 0) ? finalPrice : null;
}

// Calculate total for a list of items applying discounts
export function calculateTotal(items = [], discounts = []) {
  return (items || []).reduce((sum, item) => {
    const originalPrice = Number(item?.price || 0);
    const discountPrice = calculateDiscountPrice(originalPrice, item?.product_id, item?.unit_id, discounts);
    const finalPrice = discountPrice ?? originalPrice;
    return sum + (finalPrice * Number(item?.quantity || 1));
  }, 0);
}

// Calculate original total without discounts
export function calculateOriginalTotal(items = []) {
  return (items || []).reduce((sum, item) => {
    const originalPrice = Number(item?.price || 0);
    return sum + (originalPrice * Number(item?.quantity || 1));
  }, 0);
}

// Build grouped subtotals by unit_name (fallback to product_name)
export function buildSubtotalsByUnit(items = [], discounts = []) {
  const subtotalsByUnit = (items || []).reduce((acc, item) => {
    const key = item?.unit_name || item?.product_name || 'Lainnya';
    const originalPrice = Number(item?.price || 0);
    const discountPrice = calculateDiscountPrice(originalPrice, item?.product_id, item?.unit_id, discounts);
    const finalPrice = discountPrice ?? originalPrice;
    const lineTotal = Number(item?.quantity || 0) * finalPrice;
    acc[key] = (acc[key] || 0) + lineTotal;
    return acc;
  }, {});
  return Object.entries(subtotalsByUnit);
}
