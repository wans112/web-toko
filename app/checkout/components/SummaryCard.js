"use client";

import React from 'react';
import { Card, Divider, Typography, Button } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { buildSubtotalsByUnit, formatPrice } from '../utils/pricing';

const { Text } = Typography;

export default function SummaryCard({ items = [], discounts = [], onSubmit, submitting = false }) {
  const subtotalEntries = buildSubtotalsByUnit(items, discounts);
  const originalTotalAmount = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const discountedTotalAmount = items.reduce((sum, item) => {
    const originalPrice = Number(item.price || 0);
    const discountPrice = (() => {
      // local import to avoid circular, rely on util via subtotal builder would be fine but explicit here
      const { calculateDiscountPrice } = require('../utils/pricing');
      return calculateDiscountPrice(originalPrice, item.product_id, item.unit_id, discounts);
    })();
    const finalPrice = discountPrice ?? originalPrice;
    return sum + finalPrice * Number(item.quantity || 1);
  }, 0);
  const totalDiscount = originalTotalAmount - discountedTotalAmount;
  const hasDiscount = totalDiscount > 0;

  return (
    <Card title="Ringkasan Pesanan" className="sticky top-6">
      <div className="space-y-2">
        {subtotalEntries.map(([unit, amount]) => (
          <div className="flex justify-between" key={unit}>
            <Text>Subtotal ({unit}):</Text>
            <Text>{formatPrice(amount)}</Text>
          </div>
        ))}

        {hasDiscount && (
          <>
            <div className="flex justify-between">
              <Text>Subtotal Asli:</Text>
              <Text className="line-through text-gray-400">{formatPrice(originalTotalAmount)}</Text>
            </div>
            <div className="flex justify-between">
              <Text type="success">Hemat:</Text>
              <Text type="success">-{formatPrice(totalDiscount)}</Text>
            </div>
          </>
        )}

        <Divider className="my-3" />
        <div className="flex justify-between items-center">
          <Text strong className="text-lg">Total:</Text>
          <div className="text-right">
            {hasDiscount ? (
              <div>
                <div className="text-gray-400 line-through text-sm">{formatPrice(originalTotalAmount)}</div>
                <Text strong className="text-lg text-green-600">{formatPrice(discountedTotalAmount)}</Text>
              </div>
            ) : (
              <Text strong className="text-lg text-green-600">{formatPrice(discountedTotalAmount)}</Text>
            )}
          </div>
        </div>

        <div className="pt-4">
          <Button
            type="primary"
            size="large"
            block
            loading={submitting}
            onClick={onSubmit}
            icon={<ShoppingCartOutlined style={{ fontSize: 16 }} />}
          >
            Order Sekarang
          </Button>
        </div>
        <div className="text-center pt-2">
          <Text type="secondary" className="text-xs">
            Dengan menekan tombol "Order Sekarang", Anda menyetujui Syarat & Ketentuan kami.
          </Text>
        </div>
      </div>
    </Card>
  );
}
