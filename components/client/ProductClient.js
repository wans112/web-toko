"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, Spin, Empty, Input, notification, Select, Button, Checkbox, Divider } from "antd";

const { Option } = Select;

/**
 * ProductCustomer
 * - Menampilkan produk dalam bentuk card untuk pelanggan
 * - Props:
 *   - onAddToCart(product, unit) optional callback ketika user menekan Beli
 */
export default function ProductClient({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]); // Changed to array for multiple selection
  const [sortBy, setSortBy] = useState("name"); // name, price-low, price-high
  const [api, contextHolder] = notification.useNotification();
  const [discounts, setDiscounts] = useState([]);
  const categorySet = useMemo(() => {
    if (!selectedCategories.length) return null;
    return new Set(selectedCategories);
  }, [selectedCategories]);

  const handleSearchChange = useCallback((event) => {
    const value = event?.target?.value ?? "";
    setSearchInput(value);
    if (value === "") {
      setQ("");
    }
  }, []);

  const handleSearchSubmit = useCallback((value) => {
    const normalized = (value ?? "").trim();
    setSearchInput(normalized);
    setQ(normalized);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchDiscounts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/product");
      const data = await res.json();
      if (Array.isArray(data)) {
        const normalized = data.map((product) => {
          const units = Array.isArray(product.units)
            ? product.units.map((unit) => ({
              ...unit,
              price: Number(unit?.price) || 0,
              stock: Number(unit?.stock) || 0,
            }))
            : [];

          const name = String(product?.name || "");
          const description = String(product?.description || "");
          const totalStockValue = units.reduce((sum, unit) => sum + unit.stock, 0);
          return {
            ...product,
            units,
            _searchName: name.toLowerCase(),
            _searchDescription: description.toLowerCase(),
            _searchCombined: `${name} ${description}`.toLowerCase(),
            _totalStock: totalStockValue,
          };
        });
        setProducts(normalized);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
      api.error({ message: "Gagal mengambil produk" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  async function fetchDiscounts() {
    try {
      const res = await fetch("/api/product/discount");
      const data = await res.json();
      if (data.success) {
        const discountList = Array.isArray(data.data) ? data.data : [];
        const activeDiscounts = discountList.filter((d) => Boolean(d?.is_active_now ?? d?.active));
        setDiscounts(activeDiscounts);
      }
    } catch (err) {
      console.error('Error fetching discounts:', err);
    }
  }

  // Pre-compute discount lookup tables for faster pricing calculations
  const discountLookup = useMemo(() => {
    const byProduct = new Map();
    const byUnit = new Map();

    (discounts || []).forEach((discount) => {
      if (discount?.type === 'product' && Array.isArray(discount.product_ids)) {
        discount.product_ids.forEach((productId) => {
          if (!byProduct.has(productId)) byProduct.set(productId, []);
          byProduct.get(productId).push(discount);
        });
      }
      if (discount?.type === 'unit' && Array.isArray(discount.unit_ids)) {
        discount.unit_ids.forEach((unitId) => {
          if (!byUnit.has(unitId)) byUnit.set(unitId, []);
          byUnit.get(unitId).push(discount);
        });
      }
    });

    return { byProduct, byUnit };
  }, [discounts]);

  // Helper function to calculate discount price with memoized discount lookup
  const calculateDiscountPrice = useCallback((originalPrice, productId, unitId) => {
    const basePrice = Number(originalPrice);
    if (!Number.isFinite(basePrice)) return null;

    const productDiscounts = discountLookup.byProduct.get(productId) || [];
    const unitDiscounts = discountLookup.byUnit.get(unitId) || [];
    if (productDiscounts.length === 0 && unitDiscounts.length === 0) return null;

    let finalPrice = basePrice;
    [...productDiscounts, ...unitDiscounts].forEach((discount) => {
      const value = Number(discount?.value) || 0;
      if (discount?.value_type === 'percentage') {
        finalPrice -= finalPrice * (value / 100);
      } else if (discount?.value_type === 'nominal') {
        finalPrice -= value;
      }
    });

    if (finalPrice < 0) finalPrice = 0;
    return finalPrice !== basePrice ? finalPrice : null;
  }, [discountLookup]);

  // Cache pricing metadata per product so UI renders stay lightweight
  const pricingByProduct = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      const units = Array.isArray(product.units) ? product.units : [];
      let minOriginal = Infinity;
      let minFinal = Infinity;
      let hasDiscount = false;

      units.forEach((unit) => {
        const original = Number(unit?.price);
        if (!Number.isFinite(original)) return;
        const discounted = calculateDiscountPrice(original, product.id, unit.id);
        const finalPrice = discounted !== null ? discounted : original;

        if (original < minOriginal) minOriginal = original;
        if (finalPrice < minFinal) minFinal = finalPrice;
        if (discounted !== null && finalPrice < original) {
          hasDiscount = true;
        }
      });

      if (!Number.isFinite(minOriginal)) minOriginal = 0;
      if (!Number.isFinite(minFinal)) minFinal = minOriginal;
      const effectiveHasDiscount = hasDiscount;
     		const formattedOriginal = `Rp ${Number(minOriginal || 0).toLocaleString('id-ID')}`;
     		const formattedFinal = `Rp ${Number(minFinal || 0).toLocaleString('id-ID')}`;

      map.set(product.id, {
        minOriginal,
        minFinal,
        hasDiscount: effectiveHasDiscount,
     			formattedOriginal,
     			formattedFinal,
      });
    });
    return map;
  }, [products, calculateDiscountPrice]);

  // Return objects for displaying original and final prices (cached min values)
  const priceDisplay = useCallback((_units = [], productId) => {
    const pricing = pricingByProduct.get(productId);
    if (!pricing) {
      return { original: 'Rp 0', final: 'Rp 0', hasDiscount: false };
    }

    const hasDiscount = pricing.hasDiscount && pricing.minFinal < pricing.minOriginal;

    return {
      original: pricing.formattedOriginal,
      final: pricing.formattedFinal,
      hasDiscount,
    };
  }, [pricingByProduct]);

  function handleBuy(product, unit) {
    if (typeof onAddToCart === "function") {
      onAddToCart(product, unit);
      return;
    }
    api.info({ message: `Tambah ke keranjang: ${product.name} — ${unit.unit_name}` });
  }

  const filtered = useMemo(() => {
    const normalizedQuery = q.trim().toLowerCase();
    const hasCategoryFilter = categorySet && categorySet.size > 0;
    return products.filter((p) => {
      if (normalizedQuery) {
        const haystack = p?._searchCombined ?? `${String(p?.name || "")} ${String(p?.description || "")}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }

      if (hasCategoryFilter && !categorySet.has(p.category_id)) {
        return false;
      }

      return true;
    });
  }, [products, q, categorySet]);

  // Sort products, prioritizing discounted items first
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const aPricing = pricingByProduct.get(a.id) || { minOriginal: 0, minFinal: 0, hasDiscount: false };
      const bPricing = pricingByProduct.get(b.id) || { minOriginal: 0, minFinal: 0, hasDiscount: false };

      if (aPricing.hasDiscount !== bPricing.hasDiscount) {
        return aPricing.hasDiscount ? -1 : 1;
      }

      switch (sortBy) {
        case "name": {
          const aName = a._searchName || "";
          const bName = b._searchName || "";
          const nameCompare = aName.localeCompare(bName);
          if (nameCompare !== 0) return nameCompare;
          return String(a.name || "").localeCompare(String(b.name || ""));
        }
        case "price-low": {
          const aPrice = aPricing.minFinal ?? aPricing.minOriginal ?? 0;
          const bPrice = bPricing.minFinal ?? bPricing.minOriginal ?? 0;
          return aPrice - bPrice;
        }
        case "price-high": {
          const aPrice = aPricing.minFinal ?? aPricing.minOriginal ?? 0;
          const bPrice = bPricing.minFinal ?? bPricing.minOriginal ?? 0;
          return bPrice - aPrice;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [filtered, sortBy, pricingByProduct]);

    const productCardData = useMemo(() => {
      return sorted.map((p) => {
        const stock = Number.isFinite(p._totalStock) ? p._totalStock : 0;
        const isOos = stock <= 0;
        const pd = priceDisplay(p.units, p.id);
        const cardClass = `rounded-lg min-h-[300px] ${isOos ? 'opacity-50 pointer-events-none' : ''}`;
        const cardElement = (
          <Card
            hoverable={!isOos}
            className={cardClass}
            cover={
              p.image_path ? (
                <div className="w-full h-40 relative bg-gray-100 overflow-hidden rounded-t-lg">
                  <Image
                    src={`/api/product?filename=${p.image_path}`}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-center bg-gray-100 text-gray-400">No Image</div>
              )
            }
          >
            <h3 className="mb-1 text-base font-semibold">{p.name}</h3>
            <div className="flex justify-between items-center mt-3">
              <div>
                {pd.hasDiscount ? (
                  <div>
                    <div className="text-sm text-gray-500 line-through">{pd.original}</div>
                    <div className="text-sm font-bold text-green-600">{pd.final}</div>
                  </div>
                ) : (
                  <div className="text-sm font-bold">{pd.final}</div>
                )}
                <div className="text-xs mt-1">
                  {stock > 0 ? (
                    <span className="text-gray-500">Stok: {stock.toLocaleString("id-ID")}</span>
                  ) : (
                    <span className="text-red-600 font-semibold">Stok: Habis</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
        const clickable = isOos ? (
          <div className="block" aria-disabled="true">
            {cardElement}
          </div>
        ) : (
          <Link href={`/product/${p.id}`} className="block">
            {cardElement}
          </Link>
        );
        return { id: p.id, clickable };
      });
    }, [sorted, priceDisplay]);

    const mobileProductContent = useMemo(() => {
      if (productCardData.length === 0) {
        return (
          <Empty 
            description="Tidak ada produk yang sesuai dengan filter"
            className="py-10"
          />
        );
      }
      return (
        <div className="flex flex-wrap -mx-2">
          {productCardData.map(({ id, clickable }) => (
            <div key={id} className="px-2 w-1/2 mb-4">
              {clickable}
            </div>
          ))}
        </div>
      );
    }, [productCardData]);

    const desktopProductContent = useMemo(() => {
      if (productCardData.length === 0) {
        return (
          <Empty 
            description="Tidak ada produk yang sesuai dengan filter"
            className="py-10"
          />
        );
      }
      return (
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
          {productCardData.map(({ id, clickable }) => (
            <div key={id}>
              {clickable}
            </div>
          ))}
        </div>
      );
    }, [productCardData]);

  // Handle category checkbox change
  const handleCategoryChange = (categoryId, checked) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, categoryId]);
    } else {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId));
    }
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSearchInput("");
    setQ("");
    setSortBy("name");
  };

  if (loading) return <div className="flex justify-center py-10"><Spin /></div>;
  if (!products.length) return <Empty description="Belum ada produk" />;

  return (
    <div>
      {contextHolder}
      
      {/* Mobile Layout */}
      <div className="block lg:hidden">
        {/* Mobile Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <Input.Search
                placeholder="Cari produk..."
                allowClear
                value={searchInput}
                onChange={handleSearchChange}
                onSearch={handleSearchSubmit}
                className="w-full"
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="min-w-[200px]">
                <Select
                  placeholder="Semua Kategori"
                  allowClear
                  mode="multiple"
                  value={selectedCategories}
                  onChange={setSelectedCategories}
                  className="w-full"
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.name}
                    </Option>
                  ))}
                </Select>
              </div>
              
              <div className="min-w-[160px]">
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-full"
                >
                  <Option value="name">Urutkan A-Z</Option>
                  <Option value="price-low">Harga Terendah</Option>
                  <Option value="price-high">Harga Tertinggi</Option>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Mobile Filter Info */}
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <span>Menampilkan {sorted.length} dari {products.length} produk</span>
            {selectedCategories.length > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {selectedCategories.length} kategori dipilih
              </span>
            )}
            {q && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                Pencarian: "{q}"
              </span>
            )}
          </div>
        </div>

        {/* Mobile Products Grid */}
        {mobileProductContent}
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:flex gap-6">
        {/* Sidebar Filter - 10% */}
        <div className="w-[10%] min-w-[200px]">
          <div className="sticky top-6 bg-white rounded-lg p-4">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-3">Filter</h3>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Kategori</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center">
                      <Checkbox
                        checked={selectedCategories.includes(cat.id)}
                        onChange={(e) => handleCategoryChange(cat.id, e.target.checked)}
                        className="text-sm"
                      >
                        {cat.name}
                      </Checkbox>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Urutkan</h4>
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-full"
                  size="small"
                >
                  <Option value="name">A-Z</Option>
                  <Option value="price-low">Harga ↑</Option>
                  <Option value="price-high">Harga ↓</Option>
                </Select>
              </div>

              <Button
                onClick={clearAllFilters}
                className="w-full text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1"
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content - 90% */}
        <div className="flex-1">
          {/* Desktop Search */}
          <div className="mb-6">
            <Input.Search
              placeholder="Cari produk..."
              allowClear
              value={searchInput}
              onChange={handleSearchChange}
              onSearch={handleSearchSubmit}
              className="w-full"
              size="large"
            />
          </div>

          {/* Desktop Filter Info */}
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-gray-600">
            {selectedCategories.length > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {selectedCategories.length} kategori dipilih
              </span>
            )}
            {q && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                Pencarian: "{q}"
              </span>
            )}
          </div>

          {/* Desktop Products Grid */}
          {desktopProductContent}
        </div>
      </div>
    </div>
  );
}