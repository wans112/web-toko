"use client";
import React, { useEffect, useState } from "react";
import { Card, List, Button, Space, Tag, notification, InputNumber } from "antd";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProductDetailClient({ product, discounts = [] }) {
  const [qtyByUnit, setQtyByUnit] = useState({});
  const router = useRouter();
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    const initial = {};
    (product.units || []).forEach((u) => {
      initial[u.id] = 0;
    });
    setQtyByUnit(initial);
  }, [product]);

  // Helper function to calculate discount price
  const calculateDiscountPrice = (originalPrice, productId, unitId) => {
    const activeDiscounts = discounts.filter(d => {
      if (d.type === 'product' && Array.isArray(d.product_ids)) {
        return d.product_ids.includes(productId);
      }
      if (d.type === 'unit' && Array.isArray(d.unit_ids)) {
        return d.unit_ids.includes(unitId);
      }
      return false;
    });

    if (activeDiscounts.length === 0) return null;

    let finalPrice = originalPrice;
    activeDiscounts.forEach(discount => {
      if (discount.value_type === 'percentage') {
        finalPrice = finalPrice - (finalPrice * discount.value / 100);
      } else if (discount.value_type === 'nominal') {
        finalPrice = Math.max(0, finalPrice - discount.value);
      }
    });

    return finalPrice !== originalPrice ? finalPrice : null;
  };

  const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

  const handleBack = () => {
    router.back();
  };

  function inc(unitId) {
    // prevent incrementing beyond available stock
    const unit = (product.units || []).find(u => u.id === unitId);
    const stock = Number(unit?.stock || 0);
    setQtyByUnit((s) => {
      const current = s[unitId] || 0;
      if (stock <= 0) return s;
      if (current >= stock) return s;
      return { ...s, [unitId]: current + 1 };
    });
  }

  function dec(unitId) {
    setQtyByUnit((s) => {
      const next = Math.max(0, (s[unitId] || 0) - 1);
      return { ...s, [unitId]: next };
    });
  }

  // Handle manual input change for a unit's quantity
  function handleManualChange(unitId, value) {
    // value can be null/undefined when cleared; treat as 0
    let v = Number(value || 0);
    if (!Number.isFinite(v) || Number.isNaN(v)) v = 0;
    // enforce integer
    v = Math.floor(v);

    const unit = (product.units || []).find((u) => u.id === unitId);
    const stock = Number(unit?.stock || 0);
    if (v < 0) v = 0;
    if (stock > 0 && v > stock) v = stock;

    setQtyByUnit((s) => ({ ...s, [unitId]: v }));
  }

  async function addToCart() {
    const items = [];
    (product.units || []).forEach((u) => {
      const q = qtyByUnit[u.id] || 0;
      if (q > 0) {
        items.push({ 
          unit_id: u.id, 
          quantity: q
        });
      }
    });
    
    if (items.length === 0) {
      api.warning({ message: "Pilih jumlah unit terlebih dahulu" });
      return;
    }

    try {
      // Add items to cart via API
      for (const item of items) {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item)
        });
        
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Gagal menambahkan ke keranjang");
        }
      }
      
      api.success({ message: "Berhasil ditambahkan ke keranjang" });
      // Reset quantities after successful add
      const resetQty = {};
      (product.units || []).forEach((u) => {
        resetQty[u.id] = 0;
      });
      setQtyByUnit(resetQty);
    } catch (err) {
      console.error("Error adding to cart:", err);
      api.error({ message: err.message || "Gagal menambahkan ke keranjang" });
    }
  }

  async function buyNow() {
    // Collect all selected units for direct checkout
    const items = [];
    (product.units || []).forEach((u) => {
      const q = qtyByUnit[u.id] || 0;
      if (q > 0) {
        items.push({
          unit_id: u.id,
          product_name: product.name,
          unit_name: u.unit_name,
          quantity: q,
          price: u.price,
          image_path: product.image_path
        });
      }
    });
    
    if (items.length === 0) {
      api.warning({ message: "Pilih jumlah unit terlebih dahulu" });
      return;
    }
    
    try {
      const resp = await fetch('/api/checkout/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: items.map(i => ({ unit_id: i.unit_id, quantity: i.quantity })) })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Gagal memulai checkout langsung');
      router.push(`/checkout?source=direct&token=${encodeURIComponent(data.token)}`);
    } catch (e) {
      console.error('Direct checkout token error:', e);
      api.error({ message: e.message || 'Gagal memulai checkout langsung' });
    }
  }

  const totalPrice = (product.units || []).reduce((sum, u) => {
    const q = qtyByUnit[u.id] || 0;
    const originalPrice = Number(u.price || 0);
    const discountPrice = calculateDiscountPrice(originalPrice, product.id, u.id);
    const finalPrice = discountPrice || originalPrice;
    return sum + q * finalPrice;
  }, 0);

  const totalOriginalPrice = (product.units || []).reduce((sum, u) => {
    const q = qtyByUnit[u.id] || 0;
    const originalPrice = Number(u.price || 0);
    return sum + q * originalPrice;
  }, 0);

  const hasTotalDiscount = totalOriginalPrice !== totalPrice;

  return (
    <Card className="p-4">
      {contextHolder}
        {/* Back Button */}
        <div className="mb-4">
          <Button 
            onClick={handleBack} 
            icon={<ArrowLeft className="w-4 h-4" />}
            type="text"
            className="flex items-center gap-2"
          >
            Kembali
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-stretch">
        {/* Left: 35% image */}
        <div className="w-full md:w-[40%] p-3">
          <div className="w-full h-64 md:h-full overflow-hidden bg-gray-100">
            {product.image_path ? (
              <img
                src={`/api/product?filename=${product.image_path}`}
                alt={product.name || "Produk"}
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
            )}
          </div>
        </div>

        {/* Right: 65% content */}
        <div className="w-full md:w-[60%] p-3">
        <h1 className="text-2xl font-bold m-0">{product.name}</h1>
        <div className="mt-2 flex items-center gap-3">
          {product.category && <Tag color="blue">{product.category}</Tag>}
        </div>
        <p className="text-gray-700 mt-2 whitespace-pre-wrap">{product.description || "-"}</p>

        <div className="mt-4">
          {product.units?.length === 0 ? (
            <div className="text-sm text-gray-500">Tidak ada unit</div>
          ) : (
            <List>
              {product.units?.map((u) => (
                <List.Item key={u.id || u.unit_name} className="p-0">
                  <div className="p-3 rounded-md flex items-center justify-between w-full">
                    <div>
                      <div className="font-semibold">{u.unit_name}</div>
                      <div className="text-xs text-gray-600">Isi: {u.qty_per_unit}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {(() => {
                          const originalPrice = Number(u.price || 0);
                          const discountPrice = calculateDiscountPrice(originalPrice, product.id, u.id);
                          
                          if (discountPrice !== null) {
                            return (
                              <div>
                                <div className="text-xs text-gray-400 line-through">{formatPrice(originalPrice)}</div>
                                <div className="font-medium text-green-600">{formatPrice(discountPrice)}</div>
                              </div>
                            );
                          }
                          
                          return <div className="font-medium">{formatPrice(originalPrice)}</div>;
                        })()}
                        <div className="text-xs mt-1">
                          {Number(u.stock || 0) > 0 ? (
                            <span className="text-gray-600">Stok: {Number(u.stock || 0).toLocaleString("id-ID")}</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Stok: Habis</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="small" onClick={() => dec(u.id)} disabled={(qtyByUnit[u.id] || 0) <= 0}>-</Button>
                        <InputNumber
                          size="small"
                          min={0}
                          max={Number(u.stock || 0)}
                          value={qtyByUnit[u.id] || 0}
                          onChange={(val) => handleManualChange(u.id, val)}
                          controls={false}
                          className="w-16 text-center"
                        />
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => inc(u.id)}
                          disabled={Number(u.stock || 0) <= 0 || (qtyByUnit[u.id] || 0) >= Number(u.stock || 0)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                </List.Item>
              ))}
            </List>
          )}
        </div>

        </div>
      </div>

      {/* Summary and actions: full width below image + content */}
      <div className="w-full mt-4 p-3">
        <h3 className="font-medium mb-2">Ringkasan</h3>
        <div className="space-y-2">
          {((product.units || []).filter((u) => (qtyByUnit[u.id] || 0) > 0)).length === 0 ? (
            <div className="text-sm text-gray-400">Belum ada item yang dipilih</div>
          ) : (
            (product.units || [])
              .filter((u) => (qtyByUnit[u.id] || 0) > 0)
              .map((u) => {
                const originalPrice = Number(u.price || 0);
                const discountPrice = calculateDiscountPrice(originalPrice, product.id, u.id);
                const finalPrice = discountPrice || originalPrice;
                const originalLineTotal = qtyByUnit[u.id] * originalPrice;
                const finalLineTotal = qtyByUnit[u.id] * finalPrice;
                const hasDiscount = discountPrice !== null;
                
                return (
                  <div key={u.id} className="flex justify-between">
                    <div className="text-sm">
                      {u.unit_name} {qtyByUnit[u.id]}x
                    </div>
                    <div className="text-sm font-medium text-right">
                      {hasDiscount ? (
                        <div>
                          <div className="text-gray-400 line-through text-xs">{formatPrice(originalLineTotal)}</div>
                          <div className="text-green-600">{formatPrice(finalLineTotal)}</div>
                        </div>
                      ) : (
                        <div>{formatPrice(finalLineTotal)}</div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-lg font-semibold">
            {hasTotalDiscount ? (
              <div>
                <div className="text-gray-400 line-through text-sm">Total: {formatPrice(totalOriginalPrice)}</div>
                <div className="text-green-600">Total: {formatPrice(totalPrice)}</div>
              </div>
            ) : (
              <div>Total: {formatPrice(totalPrice)}</div>
            )}
          </div>
          <div className="w-full sm:w-auto">
            <Space className="w-full sm:w-auto" size="middle">
              <Button type="primary" onClick={buyNow} className="flex-1 sm:flex-initial">Beli Sekarang</Button>
              <Button onClick={addToCart} className="flex-1 sm:flex-initial"><ShoppingCart className="w-5"/></Button>
            </Space>
          </div>
        </div>
      </div>
  </Card>
  );
}
