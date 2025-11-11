"use client";

import React from 'react';
import { Card, Form, Select, Input } from 'antd';
import { CreditCardOutlined, EnvironmentOutlined, FileTextOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function PaymentForm({ form, paymentMethods = [], onFinish }) {
  return (
    <Card title="Informasi Pembayaran & Pengiriman">
      <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off" initialValues={{ shipping_type: 'pickup' }}>
        <Form.Item
          label={
            <span className="flex items-center gap-2">
              <CreditCardOutlined className="w-4 h-4" />
              Metode Pembayaran
            </span>
          }
          name="payment_method"
          rules={[{ required: true, message: 'Silakan pilih metode pembayaran' }]}
        >
          <Select placeholder="Pilih metode pembayaran" size="large" showSearch optionFilterProp="children">
            {paymentMethods.map((method) => (
              <Select.Option key={method.id} value={method.id}>
                {method.payment}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="shipping_type"
          label={
            <span className="flex items-center gap-2">
              <EnvironmentOutlined style={{ fontSize: 16 }} />
              Metode Pengiriman
            </span>
          }
          rules={[{ required: true, message: 'Silakan pilih metode pengiriman' }]}
        >
          <Select placeholder="Pilih metode pengiriman" size="large">
            <Select.Option value="pickup">Ambil ke Toko</Select.Option>
            <Select.Option value="delivery">Antar</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.shipping_type !== cur.shipping_type}>
          {() => {
            return form.getFieldValue('shipping_type') === 'delivery' ? (
              <Form.Item
                label={
                  <span className="flex items-center gap-2">
                    <EnvironmentOutlined style={{ fontSize: 16 }} />
                    Alamat Pengiriman
                  </span>
                }
                name="shipping_address"
                rules={[{ required: true, message: 'Harap masukkan alamat pengiriman' }]}
              >
                <TextArea rows={3} placeholder="Masukkan alamat lengkap pengiriman" size="large" />
              </Form.Item>
            ) : (
              <Form.Item name="shipping_address" style={{ margin: 0 }}>
                <Input type="hidden" />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item
          label={
            <span className="flex items-center gap-2">
              <FileTextOutlined style={{ fontSize: 16 }} />
              Catatan (Opsional)
            </span>
          }
          name="notes"
        >
          <TextArea rows={2} placeholder="Catatan tambahan untuk pesanan Anda" size="large" />
        </Form.Item>
      </Form>
    </Card>
  );
}
