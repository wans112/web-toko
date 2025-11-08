import React from "react";
import { init, get, all } from "@/lib/db";
import ProductDetailClient from "./ProductDetailClient";

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

	// Process discount data
	const processedDiscounts = (discounts || []).map(d => ({
		...d,
		product_ids: d.product_ids ? d.product_ids.split(',').map(id => parseInt(id)) : [],
		unit_ids: d.unit_ids ? d.unit_ids.split(',').map(id => parseInt(id)) : []
	}));

	return (
		<div className="p-6 max-w-5xl mx-auto">
			<ProductDetailClient product={product} discounts={processedDiscounts} />
		</div>
	);
}