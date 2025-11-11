import React from "react";
import { init, get, all } from "@/lib/db";
import ProductDetailClient from "./ProductDetailClient";

function computeIsActiveNow(discount) {
	if (!discount) return 0;
	const now = Date.now();

	if (discount.start_at) {
		const startTime = Date.parse(discount.start_at);
		if (Number.isNaN(startTime) || startTime > now) {
			return 0;
		}
	}

	if (discount.end_at) {
		const endTime = Date.parse(discount.end_at);
		if (Number.isNaN(endTime) || endTime < now) {
			return 0;
		}
	}

	return 1;
}

// Server component: fetch data and render client UI
export default async function Page({ params }) {
	const { id } = await params;
	await init();

	// Fetch product
	const product = await get("SELECT * FROM products WHERE id = ?", [id]);
	if (!product) {
		return <div className="p-6">Produk tidak ditemukan</div>;
	}

	// Fetch units
	const units = await all("SELECT * FROM product_units WHERE product_id = ? ORDER BY id", [id]);
	product.units = units || [];

	// Fetch active discounts
	const discounts = await all(`
		SELECT d.*, 
			GROUP_CONCAT(dp.product_id) as product_ids,
			GROUP_CONCAT(du.unit_id) as unit_ids
		FROM discount d
		LEFT JOIN discount_products dp ON d.id = dp.discount_id
		LEFT JOIN discount_units du ON d.id = du.discount_id
		WHERE d.active = 1
		GROUP BY d.id
	`);

	let tiersByDiscount = new Map();

	if (discounts?.length) {
		const discountIds = discounts.map(d => d.id).filter(Boolean);
		if (discountIds.length) {
			try {
				const placeholders = discountIds.map(() => '?').join(',');
				const tierRows = await all(`
					SELECT id, discount_id, label, min_quantity, max_quantity, min_amount, max_amount, value_type, value, priority
					FROM discount_tiers
					WHERE discount_id IN (${placeholders})
					ORDER BY discount_id, priority, id
				`, discountIds);

				tierRows.forEach((tier) => {
					if (!tiersByDiscount.has(tier.discount_id)) {
						tiersByDiscount.set(tier.discount_id, []);
					}
					tiersByDiscount.get(tier.discount_id).push({
						id: tier.id,
						label: tier.label,
						min_quantity: tier.min_quantity,
						max_quantity: tier.max_quantity,
						min_amount: tier.min_amount,
						max_amount: tier.max_amount,
						value_type: tier.value_type,
						value: tier.value,
						priority: tier.priority
					});
				});
			} catch (err) {
				console.error("Failed to load discount tiers", err);
			}
		}
	}

	// Process discount data
	const processedDiscounts = (discounts || []).map(d => ({
		...d,
		product_ids: d.product_ids ? d.product_ids.split(',').map(id => parseInt(id, 10)) : [],
		unit_ids: d.unit_ids ? d.unit_ids.split(',').map(id => parseInt(id, 10)) : [],
		tiers: tiersByDiscount.get(d.id) || [],
		is_active_now: computeIsActiveNow(d)
	}));

	return (
		<div className="p-6 max-w-5xl mx-auto">
			<ProductDetailClient product={product} discounts={processedDiscounts} />
		</div>
	);
}