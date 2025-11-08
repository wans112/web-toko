"use client";

import React from 'react';
import { Card, Button, Image } from 'antd';
import { formatPrice } from '../utils/pricing';

export default function SuccessCash({ contextHolder, order, onContinueShopping, onViewOrders, onConfirmToAdmin, sendingMessage }) {
  return (
    <div className="max-w-3xl mx-auto p-6">
      {contextHolder}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pesanan Berhasil Dibuat!</h1>
        <div className="space-y-1">
          <p className="text-gray-600">
            Nomor Pesanan: <strong className="text-gray-800">{order.order_number}</strong>
          </p>
          <p className="text-gray-600">
            Total Pembayaran: <strong className="text-2xl text-green-600">{formatPrice(order.total_amount)}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mb-8">
        <Card className="shadow-lg border-green-200">
          <div className="text-center p-6">
            <h3 className="text-xl font-semibold text-green-700 mb-2">Pembayaran Tunai</h3>
            {order.shipping_type === 'delivery' ? (
              <>
                <p className="text-green-600 text-lg">Pembayaran tunai akan dilakukan saat pengiriman.</p>
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    Pesanan Anda telah dikonfirmasi
                    <br />
                    Tim kami akan segera memproses pengiriman ke alamat yang Anda berikan
                    <br />
                    Siapkan uang tunai sejumlah <strong>{formatPrice(order.total_amount)}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-green-600 text-lg">Pesanan akan disiapkan untuk diambil di toko.</p>
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    Pesanan Anda telah dikonfirmasi dan siap diambil di toko kami.
                    <br />
                    Silakan datang dengan menunjukkan nomor pesanan <strong>{order.order_number}</strong> dan lakukan pembayaran saat pengambilan.
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-2xl mx-auto">
        <Button type="primary" size="large" className="min-w-[160px]" onClick={onContinueShopping}>
          Lanjut Berbelanja
        </Button>
        <Button size="large" className="min-w-[160px]" onClick={onViewOrders}>
          Lihat Pesanan
        </Button>
        <Button
          type="default"
          size="large"
          className="min-w-[160px] bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          loading={sendingMessage}
          onClick={onConfirmToAdmin}
        >
          Konfirmasi ke Admin
        </Button>
      </div>
    </div>
  );
}
