"use client";

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Tag, 
  Button, 
  Spin, 
  Empty, 
  Modal,
  notification
} from 'antd';
import { useRouter } from 'next/navigation';
import { FileTextOutlined, ArrowLeftOutlined, ShoppingOutlined, EyeOutlined, CalendarOutlined, CreditCardOutlined, EnvironmentOutlined, CopyOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function OrderCustomer() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [api, contextHolder] = notification.useNotification();
  const router = useRouter();

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      // TODO: Get actual user_id from auth context
      const userId = 1; 
      const response = await fetch(`/api/order?user_id=${userId}`);
      const result = await response.json();
      
      if (result.success) {
        setOrders(result.data || []);
      } else {
        console.error('Failed to fetch orders:', result.error);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      menunggu: 'orange',
      processing: 'blue',
      diproses: 'blue',
      shipped: 'cyan',
      dikirim: 'cyan',
      delivered: 'green',
      diterima: 'green',
      cancelled: 'red',
      dibatalkan: 'red'
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      unpaid: 'red',
      belum_bayar: 'red',
      paid: 'green',
      lunas: 'green',
      refunded: 'orange',
      dikembalikan: 'orange'
    };
    return colors[status] || 'default';
  };

  const displayStatus = (status) => {
    if (!status) return '';
    const map = {
      pending: 'MENUNGGU',
      menunggu: 'MENUNGGU',
      processing: 'DIPROSES',
      diproses: 'DIPROSES',
      shipped: 'DIKIRIM',
      dikirim: 'DIKIRIM',
      delivered: 'DITERIMA',
      diterima: 'DITERIMA',
      cancelled: 'DIBATALKAN',
      dibatalkan: 'DIBATALKAN'
    };
    return map[status] || String(status).toUpperCase();
  };

  const displayPaymentStatus = (status) => {
    if (!status) return '';
    const map = {
      unpaid: 'BELUM BAYAR',
      belum_bayar: 'BELUM BAYAR',
      paid: 'SUDAH BAYAR',
      lunas: 'SUDAH BAYAR',
      refunded: 'REFUND',
      dikembalikan: 'REFUND'
    };
    return map[status] || String(status).toUpperCase();
  };

  const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

  const handleViewOrder = async (order) => {
    try {
      const response = await fetch(`/api/order?id=${order.id}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedOrder(result.data);
        setViewModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
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
      {contextHolder}
      
      {/* Header */}
      <div className="mb-6">
        <Button 
          onClick={() => router.back()} 
          icon={<ArrowLeftOutlined />}
          type="text"
          className="mb-4"
        >
          Kembali
        </Button>
        
          <Title level={2} className="m-0 flex items-center gap-2">
          <ShoppingOutlined />
          Pesanan Saya
        </Title>
      </div>

      {orders.length === 0 ? (
        <Card>
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Belum ada pesanan"
          >
            <Link href="/">
              <Button type="primary">Mulai Berbelanja</Button>
            </Link>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="hover:shadow-lg transition-shadow cursor-pointer p-0"
              bodyStyle={{ padding: 0 }}
              onClick={() => handleViewOrder(order)}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 p-4">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <Text strong className="text-lg">{order.order_number}</Text>
                    <Tag color={getStatusColor(order.status)}>
                      {displayStatus(order.status)}
                    </Tag>
                    <Tag color={getPaymentStatusColor(order.payment_status)}>
                      {displayPaymentStatus(order.payment_status)}
                    </Tag>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CalendarOutlined />
                      <span>{dayjs(order.created_at).format('DD MMM YYYY, HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCardOutlined />
                      <span>{order.payment}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Text strong className="text-yellow-600">
                        {formatPrice(order.total_amount)}
                      </Text>
                    </div>
                  </div>
                  {order.shipping_address && (
                    <div className="flex items-start gap-2 mt-2 text-sm text-gray-600">
                      <EnvironmentOutlined />
                      <span className="line-clamp-2">{order.shipping_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <EyeOutlined />
            Detail Pesanan
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Tutup
          </Button>
        ]}
        width={800}
      >
        {selectedOrder && (
          <div className="space-y-4">
            {/* Order Info - Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-gray-700">Nomor Pesanan:</span>
                  <span className="font-mono text-base text-gray-900">{selectedOrder.order_number}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-gray-700">Status:</span>
                  <Tag color={getStatusColor(selectedOrder.status)}>
                    {displayStatus(selectedOrder.status)}
                  </Tag>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-gray-700">Status Pembayaran:</span>
                  <Tag color={getPaymentStatusColor(selectedOrder.payment_status)}>
                    {displayPaymentStatus(selectedOrder.payment_status)}
                  </Tag>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-semibold text-gray-700">Tanggal Pesanan:</span>
                  <CalendarOutlined />
                  <span>{dayjs(selectedOrder.created_at).format('DD MMMM YYYY, HH:mm')}</span>
                </div>
              </div>
              {selectedOrder.shipping_address && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <Title level={5} className="mb-2">
                    <EnvironmentOutlined />
                    Alamat Pengiriman
                  </Title>
                  <Text>{selectedOrder.shipping_address}</Text>
                </div>
              )}
            </div>

            {/* Order Items - Responsive List */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <Title level={5} className="mb-2">
                <ShoppingOutlined />
                Item Pesanan
              </Title>
              <ul className="divide-y divide-gray-100">
                {(selectedOrder.items || []).map(item => (
                  <li key={item.id} className="py-3 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-gray-800">{item.product_name}</span>
                      <span className="text-sm text-green-600">{item.unit_name}</span>
                      <span className="text-xs text-gray-500">Jumlah Barang: {item.quantity}</span>
                    </div>
          {item.discount_amount > 0 && (
                      <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-green-600 font-semibold">Diskon: -{formatPrice(item.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-center">
                      {item.discount_amount > 0 && (
                        <span className="text-sm text-gray-400 line-through">{formatPrice(item.unit_price * item.quantity)}</span>
                      )}
                      <span className="text-sm text-yellow-600 font-bold">{formatPrice(item.total_price)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <hr className="my-1 border-t border-gray-200" />
              <div className="pt-2 text-right">
                <span className="text-lg font-semibold text-gray-700">Total Semua:&nbsp;</span>
                <span className="text-xl font-bold text-green-600">{formatPrice(selectedOrder.total_amount)}</span>
              </div>
            </div>

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <Title level={5} className="mb-2">
                  <FileTextOutlined /> Catatan
                </Title>
                <Text>{selectedOrder.notes}</Text>
              </div>
            )}

            {/* Payment Instructions for unpaid orders */}
            {(selectedOrder.payment_status === 'unpaid' || selectedOrder.payment_status === 'belum_bayar') && 
             !selectedOrder.payment?.toLowerCase().includes('cash') && 
             !selectedOrder.payment?.toLowerCase().includes('tunai') && (
              <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 mt-2">
                <Title level={5} className="text-yellow-600 mb-2">
                  Instruksi Pembayaran
                </Title>
                <div className="space-y-2">
                  <p>Silakan transfer ke:</p>
                  <div className="p-2 bg-white rounded border border-gray-300">
                    <Text strong>{selectedOrder.payment}</Text>
                    {selectedOrder.no_payment && (
                      <button
                        type="button"
                        className="block font-mono text-lg text-green-600 hover:text-green-700 cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.no_payment);
                          api.success({ message: 'Nomor berhasil dicopy!' });
                        }}
                        title="Copy nomor"
                      >
                        {selectedOrder.no_payment}
                        <CopyOutlined />
                      </button>
                    )}
                  </div>
                  <p className="text-sm">
                    Total: <Text strong className="text-yellow-500">{formatPrice(selectedOrder.total_amount)}</Text>
                  </p>
                  <Button 
                    type="primary"
                    onClick={() => {
                      const message = `Halo admin, saya sudah melakukan transfer untuk pesanan ${selectedOrder.order_number} sebesar ${formatPrice(selectedOrder.total_amount)} melalui ${selectedOrder.payment}. Mohon konfirmasinya. Terima kasih.`;
                      window.open(`https://wa.me/081234567890?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                  >
                    Konfirmasi Pembayaran via WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
