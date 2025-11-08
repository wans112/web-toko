"use client";

import React from 'react';
import { Card, Button, Upload, Image } from 'antd';
import { CopyOutlined, UploadOutlined } from '@ant-design/icons';
import { formatPrice } from '../utils/pricing';

export default function SuccessNonCash({
  contextHolder,
  order,
  selectedPaymentMethod,
  proofFile,
  setProofFile,
  uploadingProof,
  sendingMessage,
  onUploadProof,
  onCancelProof,
  onContinueShopping,
  onViewOrders,
  onConfirmToAdmin,
  api,
}) {
  return (
    <div className="max-w-3xl mx-auto p-6">
      {contextHolder}

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pesanan Menunggu Pembayaran</h1>
        <div className="space-y-1">
          <p className="text-gray-600">
            Nomor Pesanan: <strong className="text-gray-800">{order.order_number}</strong>
          </p>
          <p className="text-gray-600">
            Total Pembayaran: <strong className="text-2xl text-yellow-600">{formatPrice(order.total_amount)}</strong>
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mb-8">
        <Card title="Instruksi Pembayaran" className="shadow-lg">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
              <span className="font-medium text-gray-700">Metode Pembayaran:</span>
              <span className="text-green-600 font-semibold text-lg">{selectedPaymentMethod?.payment}</span>
            </div>
            {/* Show QRIS image when available */}
            {selectedPaymentMethod?.image_url && (
              <div className="flex justify-center items-center p-4 bg-white rounded-lg border border-gray-200">
                <Image src={selectedPaymentMethod.image_url} alt="QRIS" width={200} />
              </div>
            )}

            {selectedPaymentMethod?.no_payment && (
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
                <span className="font-medium text-gray-700">Transfer ke:</span>
                <button
                  type="button"
                  className="flex items-center gap-2 font-mono text-xl font-bold text-green-600 hover:bg-green-100 px-2 py-1 rounded focus:outline-none"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPaymentMethod.no_payment);
                    api.success({ message: 'Nomor berhasil dicopy!' });
                  }}
                  title="Copy nomor"
                >
                  {selectedPaymentMethod.no_payment}
                  <CopyOutlined style={{ fontSize: 16 }} />
                </button>
              </div>
            )}

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="font-semibold text-yellow-800 mb-3 text-center">Langkah-langkah pembayaran:</p>
              <ol className="text-yellow-700 space-y-2 list-decimal list-inside">
                <li>
                  Transfer sejumlah <strong className="text-yellow-500">{formatPrice(order.total_amount)}</strong>
                </li>
                <li>Ke nomor rekening/e-wallet di atas</li>
                <li>Upload bukti transfer</li>
                <li>Konfirmasi pembayaran ke admin</li>
                {order.shipping_type === 'delivery' ? (
                  <li>Pesanan akan dikirim ke alamat yang Anda berikan</li>
                ) : (
                  <li>Pesanan akan disiapkan untuk diambil di toko</li>
                )}
              </ol>
            </div>

            <div className="mt-4 flex flex-col items-center justify-center">
              <div className="w-full flex justify-center">
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setProofFile(e.target.result);
                      api.info({ message: 'File siap untuk diupload' });
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                  maxCount={1}
                >
                  <Button>
                    <UploadOutlined />Unggah Bukti Transfer
                  </Button>
                </Upload>
              </div>

              {proofFile && (
                <div className="mt-2 flex justify-center">
                  <img src={proofFile} alt="preview" className="max-h-36 object-contain border" />
                </div>
              )}
              {!proofFile && order?.proof_payment_path && (
                <div className="mt-2 flex justify-center">
                  <Image src={`/api/product?filename=${order.proof_payment_path}`} alt="bukti" width={160} />
                </div>
              )}
              {proofFile && (
                <div className="mt-3 flex gap-2 justify-center">
                  <Button type="primary" loading={uploadingProof} onClick={onUploadProof}>
                    Kirim Bukti Pembayaran
                  </Button>
                  <Button onClick={onCancelProof}>Batal</Button>
                </div>
              )}
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Setelah transfer berhasil, pesanan akan diproses dalam 1x24 jam</p>
            </div>
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
