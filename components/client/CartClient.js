"use client";
import React, { useEffect, useMemo, useState } from "react";
import { 
	Card, 
	List, 
	Button, 
	Image, 
	Space, 
	Typography, 
	Empty, 
	Spin, 
	message,
	Popconfirm,
	Divider
} from "antd";
import { ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	calculateDiscountPrice as resolveDiscountPrice,
	calculateOriginalTotal,
	calculateTotal,
	formatPrice
} from "./checkout/utils/pricing";

const { Title, Text } = Typography;

export default function CartClient({ onStartShopping }) {
	const [cartItems, setCartItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [updating, setUpdating] = useState({});
	const [discounts, setDiscounts] = useState([]);
	const router = useRouter();

	useEffect(() => {
		fetchCartItems();
		fetchDiscounts();
	}, []);

	async function fetchCartItems() {
		setLoading(true);
		try {
			const res = await fetch("/api/cart");
			const data = await res.json();
			if (data.success) {
				setCartItems(data.data || []);
			} else {
				message.error(data.error || "Gagal mengambil data keranjang");
			}
		} catch (err) {
			console.error("Error fetching cart:", err);
			message.error("Gagal mengambil data keranjang");
		} finally {
			setLoading(false);
		}
	}

	async function fetchDiscounts() {
	    try {
	        const res = await fetch("/api/product/discount");
	        const data = await res.json();
	        if (data.success) {
	            setDiscounts((data.data || []).filter((d) => d.is_active_now ?? d.active) || []);
	        }
	    } catch (err) {
	        console.error('Error fetching discounts:', err);
	    }
	}

	async function updateQuantity(cartId, newQuantity) {
		if (updating[cartId]) return;
    
		setUpdating(prev => ({ ...prev, [cartId]: true }));
		try {
			const res = await fetch("/api/cart", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cart_id: cartId, quantity: newQuantity })
			});
      
			const data = await res.json();
			if (data.success) {
				if (newQuantity === 0) {
					setCartItems(prev => prev.filter(item => item.id !== cartId));
				} else {
					setCartItems(prev => 
						prev.map(item => 
							item.id === cartId ? { ...item, quantity: newQuantity } : item
						)
					);
				}
			} else {
				message.error(data.error || "Gagal mengupdate keranjang");
			}
		} catch (err) {
			console.error("Error updating cart:", err);
			message.error("Gagal mengupdate keranjang");
		} finally {
			setUpdating(prev => ({ ...prev, [cartId]: false }));
		}
	}

	async function removeItem(cartId) {
		try {
			const res = await fetch(`/api/cart?cart_id=${cartId}`, {
				method: "DELETE"
			});
      
			const data = await res.json();
			if (data.success) {
				setCartItems(prev => prev.filter(item => item.id !== cartId));
				message.success("Item dihapus dari keranjang");
			} else {
				message.error(data.error || "Gagal menghapus item");
			}
		} catch (err) {
			console.error("Error removing item:", err);
			message.error("Gagal menghapus item");
		}
	}

	async function clearCart() {
		try {
			const res = await fetch("/api/cart", {
				method: "DELETE"
			});
      
			const data = await res.json();
			if (data.success) {
				setCartItems([]);
				message.success("Keranjang dikosongkan");
			} else {
				message.error(data.error || "Gagal mengosongkan keranjang");
			}
		} catch (err) {
			console.error("Error clearing cart:", err);
			message.error("Gagal mengosongkan keranjang");
		}
	}

	const aggregateCache = useMemo(() => new Map(), [cartItems, discounts]);
	const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
	const totalOriginalPrice = calculateOriginalTotal(cartItems);
	const totalPrice = calculateTotal(cartItems, discounts, { aggregateCache });
	const hasTotalDiscount = totalOriginalPrice !== totalPrice;

	const handleCheckout = () => {
		if (cartItems.length === 0) {
			message.warning("Keranjang kosong");
			return;
		}
		// Navigate to checkout page with cart source
		router.push('/checkout?source=cart');
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[400px]">
				<Spin size="large" />
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-6">
			{/* Header */}
			<div className="mb-6">
				<div className="flex items-center justify-between">
					<Title level={2} className="m-0 flex items-center gap-2">
						<ShoppingCart className="w-6 h-6" />
						Keranjang Belanja
					</Title>
          
					{cartItems.length > 0 && (
						<Popconfirm
							title="Kosongkan keranjang?"
							description="Semua item akan dihapus dari keranjang"
							onConfirm={clearCart}
							okText="Ya"
							cancelText="Batal"
						>
							<Button danger type="text" icon={<Trash2 className="w-4 h-4" />}>
								Kosongkan Keranjang
							</Button>
						</Popconfirm>
					)}
				</div>
			</div>

			{cartItems.length === 0 ? (
				<Card>
					<Empty 
						image={Empty.PRESENTED_IMAGE_SIMPLE}
						description="Keranjang belanja kosong"
					>
						<Button type="primary" onClick={onStartShopping}>Mulai Belanja</Button>
					</Empty>
				</Card>
			) : (
				<div className="space-y-4">
					{/* Cart Items */}
					<Card>
						<List
							dataSource={cartItems}
							renderItem={(item) => {
								const originalPrice = Number(item.price || 0);
								const discountPrice = resolveDiscountPrice(originalPrice, item.product_id, item.unit_id, discounts, {
									items: cartItems,
									aggregateCache
								});
								const finalPrice = discountPrice || originalPrice;
								const hasDiscount = discountPrice !== null;
								const lineTotal = item.quantity * finalPrice;
								const originalLineTotal = item.quantity * originalPrice;

								return (
									<List.Item
										key={item.id}
										actions={[
											<Popconfirm
												key="delete"
												title="Hapus item ini?"
												onConfirm={() => removeItem(item.id)}
												okText="Ya"
												cancelText="Batal"
											>
												<Button 
													danger 
													type="text" 
													icon={<Trash2 className="w-4 h-4" />}
													size="small"
												/>
											</Popconfirm>
										]}
									>
										<div className="flex items-center space-x-4 w-full">
											{/* Product Image */}
											<div className="flex-shrink-0">
												{item.image_path ? (
													<Image
														src={`/api/product?filename=${item.image_path}`}
														alt={item.product_name}
														width={80}
														height={80}
														className="rounded-md object-cover"
													/>
												) : (
													<div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs">
														No Image
													</div>
												)}
											</div>

											{/* Product Info */}
											<div className="flex-grow">
												<div className="font-medium text-lg">{item.product_name}</div>
												<div className="text-gray-500 text-sm">
													{item.unit_name} • Isi: {item.qty_per_unit}
												</div>
												<div className="text-gray-500 text-sm">
													Stok: {Number(item.stock || 0).toLocaleString('id-ID')}
												</div>
                        
												{/* Price */}
												<div className="mt-2">
													{hasDiscount ? (
														<div>
															<div className="text-gray-400 line-through text-sm">
																{formatPrice(originalPrice)}
															</div>
															<div className="text-green-600 font-medium">
																{formatPrice(finalPrice)}
															</div>
														</div>
													) : (
														<div className="font-medium">{formatPrice(finalPrice)}</div>
													)}
												</div>
											</div>

											{/* Quantity Controls */}
											<div className="flex flex-col items-end space-y-2">
												<div className="flex items-center gap-2">
													<Button
														size="small"
														onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
														disabled={updating[item.id]}
													>
														-
													</Button>
													<div className="w-10 text-center">{item.quantity}</div>
													<Button
														size="small"
														type="primary"
														onClick={() => updateQuantity(item.id, Math.min(item.stock, item.quantity + 1))}
														disabled={updating[item.id] || item.quantity >= item.stock}
													>
														+
													</Button>
												</div>
                        
												{/* Line Total */}
												<div className="text-right">
													{hasDiscount ? (
														<div>
															<div className="text-gray-400 line-through text-xs">
																{formatPrice(originalLineTotal)}
															</div>
															<div className="font-medium text-green-600">
																{formatPrice(lineTotal)}
															</div>
														</div>
													) : (
														<div className="font-medium">{formatPrice(lineTotal)}</div>
													)}
												</div>
											</div>
										</div>
									</List.Item>
								);
							}}
						/>
					</Card>

					{/* Cart Summary */}
					<Card>
						<div className="space-y-3">
							<Title level={4}>Ringkasan Belanja</Title>
              
							<div className="flex justify-between">
								<Text>Total Item:</Text>
								<Text>{totalItems} item</Text>
							</div>
              
							{hasTotalDiscount && (
								<div className="flex justify-between">
									<Text>Subtotal:</Text>
									<Text className="line-through text-gray-400">
										{formatPrice(totalOriginalPrice)}
									</Text>
								</div>
							)}
              
							<Divider className="my-3" />
              
							<div className="flex justify-between items-center">
								<Text strong className="text-lg">Total:</Text>
								<div className="text-right">
									{hasTotalDiscount ? (
										<div>
											<div className="text-gray-400 line-through text-sm">
												{formatPrice(totalOriginalPrice)}
											</div>
											<Text strong className="text-lg text-green-600">
												{formatPrice(totalPrice)}
											</Text>
										</div>
									) : (
										<Text strong className="text-lg">{formatPrice(totalPrice)}</Text>
									)}
								</div>
							</div>
              
							{hasTotalDiscount && (
								<div className="text-right">
									<Text type="success" className="text-sm">
										Hemat {formatPrice(totalOriginalPrice - totalPrice)}
									</Text>
								</div>
							)}
              
							<div className="pt-4">
								<Button 
									type="primary" 
									size="large" 
									block
									onClick={handleCheckout}
									disabled={cartItems.length === 0}
								>
									Checkout ({totalItems} item)
								</Button>
							</div>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
