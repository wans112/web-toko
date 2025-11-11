"use client";

import React, { useMemo } from 'react';
import { List } from 'antd';
import Image from 'next/image';
import { calculateDiscountPrice, formatPrice } from '../utils/pricing';

export default function ItemsList({ items = [], discounts = [] }) {
  const aggregateCache = useMemo(() => new Map(), [items, discounts]);

  return (
    <List
      dataSource={items}
      renderItem={(item) => {
        const originalPrice = Number(item.price || 0);
        const discountPrice = calculateDiscountPrice(
          originalPrice,
          item.product_id,
          item.unit_id,
          discounts,
          {
            items,
            aggregateCache
          }
        );
        const finalPrice = discountPrice ?? originalPrice;
        const hasDiscount = discountPrice !== null;
        const lineTotal = Number(item.quantity || 0) * finalPrice;
        const originalLineTotal = Number(item.quantity || 0) * originalPrice;

        return (
          <List.Item className="px-0">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-4">
                {item.image_path && (
                  // Using next/image for optimization, fallback to img if needed
                  <img
                    src={`/api/product?filename=${item.image_path}`}
                    alt={item.product_name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div>
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-sm text-gray-500">
                    {item.unit_name} {item.quantity}x
                  </div>
                  {hasDiscount && (
                    <div className="text-xs text-green-600">
                      Hemat {formatPrice((originalPrice - finalPrice) * Number(item.quantity || 0))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                {hasDiscount ? (
                  <div>
                    <div className="text-gray-400 line-through text-sm">
                      {formatPrice(originalLineTotal)}
                    </div>
                    <div className="font-medium text-green-600">
                      {formatPrice(lineTotal)}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="line-through">{formatPrice(originalPrice)}</span>
                      <span className="text-green-600 ml-1">{formatPrice(finalPrice)}</span>
                      <span className="ml-1">per {item.unit_name}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{formatPrice(lineTotal)}</div>
                    <div className="text-sm text-gray-500">
                      {formatPrice(originalPrice)} per {item.unit_name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </List.Item>
        );
      }}
    />
  );
}
