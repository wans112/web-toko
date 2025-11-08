"use client";

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Input, 
  Select, 
  List, 
  Typography, 
  Divider, 
  notification, 
  Spin,
  Empty,
  Upload,
  Image
} from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, ShoppingCartOutlined, CreditCardOutlined, EnvironmentOutlined, FileTextOutlined, CopyOutlined, UploadOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function CheckoutClient() {
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [directItems, setDirectItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get checkout source and data from URL params
  const source = searchParams.get('source') || 'cart';
  const directData = searchParams.get('data');

  useEffect(() => {
    // Restore orderSuccess from localStorage if exists
    const storedOrder = localStorage.getItem('orderSuccess');
    if (storedOrder) {
      try {
        setOrderSuccess(JSON.parse(storedOrder));
      } catch (e) {
        localStorage.removeItem('orderSuccess');
      }
    }

    if (!storedOrder) {
      if (source === 'cart') {
        fetchCartItems();
      } else if (source === 'direct' && directData) {
        try {
          const parsed = JSON.parse(decodeURIComponent(directData));
          setDirectItems(parsed);
        } catch (error) {
          console.error('Error parsing direct checkout data:', error);
          api.error({ message: 'Invalid checkout data' });
          router.push('/');
        }
      }
    }
    fetchPaymentMethods();
  }, [source, directData]);

  async function fetchCartItems() {
    setLoading(true);
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        setCartItems(data);
      } else {
        throw new Error(data.error || 'Failed to fetch cart items');
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      api.error({ message: 'Failed to load cart items' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchPaymentMethods() {
    try {
      const response = await fetch('/api/payment-method');
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      api.error({ message: 'Failed to load payment methods' });
    }
  }

  // Calculate total price with discounts (placeholder - implement your discount logic)
  const calculateTotal = (items) => {
    return items.reduce((sum, item) => {
      const price = Number(item.price || 0);
      const quantity = item.quantity || 1;
      return sum + (price * quantity);
    }, 0);
  };

  const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

  const handleSubmit = async (values) => {
    setOrderLoading(true);
    try {
      const items = source === 'cart' ? cartItems : directItems;
      if (items.length === 0) {
        api.error({ message: 'No items to checkout' });
        return;
      }
      // Prepare order data
      const shippingAddress = values.delivery_method === 'ambil' ? 'ambil ke toko' : values.shipping_address;
      const orderData = {
        user_id: 1, // TODO: Get from auth context
        payment_id: values.payment_method,
        delivery_method: values.delivery_method,
        shipping_address: shippingAddress,
        notes: values.notes,
        source: source,
        items: items.map(item => ({
          unit_id: item.unit_id || item.id,
          quantity: item.quantity
        }))
      };
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const result = await response.json();
      if (result.success) {
        const selectedPayment = paymentMethods.find(pm => pm.id === values.payment_method);
        const orderWithPayment = {
          ...result.data,
          payment_method_info: selectedPayment,
          delivery_method: values.delivery_method
        };
        setOrderSuccess(orderWithPayment);
        // Save to localStorage
        localStorage.setItem('orderSuccess', JSON.stringify(orderWithPayment));
        const isCashPayment = selectedPayment?.payment?.toLowerCase().includes('cash') || 
                             selectedPayment?.payment?.toLowerCase().includes('tunai');
        if (isCashPayment) {
          api.success({ 
            message: 'Pesanan berhasil dibuat!',
            description: `Nomor pesanan: ${result.data.order_number}. Pembayaran tunai saat pengiriman.`
          });
        } else {
          api.info({ 
            message: 'Pesanan berhasil dibuat!',
            description: `Nomor pesanan: ${result.data.order_number}. Silakan lakukan pembayaran sesuai instruksi.`
          });
        }
      } else {
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      api.error({ 
        message: 'Failed to create order',
        description: error.message 
      });
    } finally {
      setOrderLoading(false);
    }
  };

  const items = source === 'cart' ? cartItems : directItems;
  const totalAmount = calculateTotal(items);
  
  // group subtotals by unit_name (fallback to product_name)
  const subtotalsByUnit = items.reduce((acc, item) => {
    const key = item.unit_name || item.product_name || 'Lainnya';
    const lineTotal = Number(item.price || 0) * (item.quantity || 0);
    acc[key] = (acc[key] || 0) + lineTotal;
    return acc;
  }, {});
  const subtotalEntries = Object.entries(subtotalsByUnit);

  if (orderSuccess) {
    const selectedPaymentMethod = orderSuccess.payment_method_info || paymentMethods.find(pm => pm.id === orderSuccess.payment_id);
    const isCashPayment = selectedPaymentMethod?.payment?.toLowerCase().includes('cash') || selectedPaymentMethod?.payment?.toLowerCase().includes('tunai');

    // Helper to clear localStorage and state
    const clearOrderSuccess = () => {
      localStorage.removeItem('orderSuccess');
      setOrderSuccess(null);
    };

    if (isCashPayment) {
      // Cash payment - direct success
      return (
        <div className="max-w-3xl mx-auto p-6">
          {contextHolder}
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Pesanan Berhasil Dibuat!</h1>
            <div className="space-y-1">
              <p className="text-gray-600">Nomor Pesanan: <strong className="text-gray-800">{orderSuccess.order_number}</strong></p>
              <p className="text-gray-600">Total Pembayaran: <strong className="text-2xl text-green-600">{formatPrice(orderSuccess.total_amount)}</strong></p>
            </div>
          </div>
          {/* Success Message Card */}
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="shadow-lg border-green-200">
              <div className="text-center p-6">
                <h3 className="text-xl font-semibold text-green-700 mb-2">Pembayaran Tunai</h3>
                {orderSuccess.delivery_method === 'antar' ? (
                  <>
                    <p className="text-green-600 text-lg">Pembayaran tunai akan dilakukan saat pengiriman.</p>
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700">
                        Pesanan Anda telah dikonfirmasi<br/>
                        Tim kami akan segera memproses pengiriman ke alamat yang Anda berikan<br/>
                        Siapkan uang tunai sejumlah <strong>{formatPrice(orderSuccess.total_amount)}</strong>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-green-600 text-lg">Pesanan akan disiapkan untuk diambil di toko.</p>
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700">
                        Pesanan Anda telah dikonfirmasi dan siap diambil di toko kami.<br/>
                        Silakan datang dengan menunjukkan nomor pesanan <strong>{orderSuccess.order_number}</strong> dan lakukan pembayaran saat pengambilan.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-2xl mx-auto">
            <Button 
              type="primary" 
              size="large"
              className="min-w-[160px]"
              onClick={() => { clearOrderSuccess(); router.push('/'); }}
            >
              Lanjut Berbelanja
            </Button>
            <Button 
              size="large"
              className="min-w-[160px]"
              onClick={() => { clearOrderSuccess(); router.push('/orders'); }}
            >
              Lihat Pesanan
            </Button>
          </div>
        </div>
      );
    } else {
      // Transfer/E-wallet payment - show transfer instructions
      return (
        <div className="max-w-3xl mx-auto p-6">
          {contextHolder}
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Pesanan Menunggu Pembayaran</h1>
            <div className="space-y-1">
              <p className="text-gray-600">Nomor Pesanan: <strong className="text-gray-800">{orderSuccess.order_number}</strong></p>
              <p className="text-gray-600">Total Pembayaran: <strong className="text-2xl text-yellow-600">{formatPrice(orderSuccess.total_amount)}</strong></p>
            </div>
          </div>
          {/* Payment Instructions Card */}
          <div className="max-w-2xl mx-auto mb-8">
            <Card title="Instruksi Pembayaran" className="shadow-lg">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <span className="font-medium text-gray-700">Metode Pembayaran:</span>
                  <span className="text-green-600 font-semibold text-lg">{selectedPaymentMethod?.payment}</span>
                </div>
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
                    <li>Transfer sejumlah <strong className="text-yellow-500">{formatPrice(orderSuccess.total_amount)}</strong></li>
                    <li>Ke nomor rekening/e-wallet di atas</li>
                    <li>Upload bukti transfer</li>
                    <li>Konfirmasi pembayaran ke admin</li>
                    {orderSuccess.delivery_method === 'antar' ? (
                      <li>Pesanan akan dikirim ke alamat yang Anda berikan</li>
                    ) : (
                      <li>Pesanan akan disiapkan untuk diambil di toko</li>
                    )}
                  </ol>
                </div>
                {/* Upload proof UI */}
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
                      <Button><UploadOutlined />Unggah Bukti Transfer</Button>
                    </Upload>
                  </div>
                  {proofFile && (
                    <div className="mt-2 flex justify-center">
                      <img src={proofFile} alt="preview" className="max-h-36 object-contain border" />
                    </div>
                  )}
                  {!proofFile && orderSuccess?.proof_payment_path && (
                    <div className="mt-2 flex justify-center">
                      <Image src={`/api/product?filename=${orderSuccess.proof_payment_path}`} alt="bukti" width={160} />
                    </div>
                  )}
                  {proofFile && (
                    <div className="mt-3 flex gap-2 justify-center">
                      <Button
                        type="primary"
                        loading={uploadingProof}
                        onClick={async () => {
                          if (!orderSuccess?.id) return api.error({ message: 'Order ID tidak tersedia' });
                          setUploadingProof(true);
                          try {
                            const resp = await fetch('/api/order', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: orderSuccess.id, proof_base64: proofFile })
                            });
                            const res = await resp.json();
                            if (res.success) {
                              api.success({ message: 'Bukti pembayaran berhasil diupload' });
                              setOrderSuccess(prev => {
                                const updated = { ...prev, ...res.data };
                                localStorage.setItem('orderSuccess', JSON.stringify(updated));
                                return updated;
                              });
                              setProofFile(null);
                            } else {
                              throw new Error(res.error || 'Upload failed');
                            }
                          } catch (e) {
                            console.error('Upload proof failed:', e);
                            api.error({ message: 'Gagal mengupload bukti pembayaran' });
                          } finally {
                            setUploadingProof(false);
                          }
                        }}
                      >
                        Kirim Bukti Pembayaran
                      </Button>
                      <Button onClick={() => setProofFile(null)}>Batal</Button>
                    </div>
                  )}
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Setelah transfer berhasil, pesanan akan diproses dalam 1x24 jam</p>
                </div>
              </div>
            </Card>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-2xl mx-auto">
            <Button 
              type="primary" 
              size="large"
              className="min-w-[160px]"
              onClick={() => { clearOrderSuccess(); router.push('/'); }}
            >
              Lanjut Berbelanja
            </Button>
            <Button 
              size="large"
              className="min-w-[160px]"
              onClick={() => { clearOrderSuccess(); router.push('/orders'); }}
            >
              Lihat Pesanan
            </Button>
            <Button 
              type="default"
              size="large"
              className="min-w-[160px] bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => {
                const message = `Halo admin, saya sudah melakukan transfer untuk pesanan ${orderSuccess.order_number} sebesar ${formatPrice(orderSuccess.total_amount)} melalui ${selectedPaymentMethod?.payment}. Mohon konfirmasinya. Terima kasih.`;
                window.open(`https://wa.me/081234567890?text=${encodeURIComponent(message)}`, '_blank');
              }}
            >
              Konfirmasi via WhatsApp
            </Button>
          </div>
        </div>
      );
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        {contextHolder}
        <Card>
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No items to checkout"
          >
            <Link href="/">
              <Button type="primary">Start Shopping</Button>
            </Link>
          </Empty>
        </Card>
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
          icon={<ArrowLeftOutlined style={{ fontSize: 16 }} />}
          type="text"
          className="mb-4"
        >
          Kembali
        </Button>
        
        <Title level={2} className="m-0 flex items-center gap-2">
          <CreditCardOutlined style={{ fontSize: 24 }} />
          Checkout
        </Title>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item Pesanan */}
        <div className="lg:col-span-2">
          <Card title="Item Pesanan" className="mb-6">
            <List
              dataSource={items}
              renderItem={(item) => (
                <List.Item className="px-0">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                      {item.image_path && (
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
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatPrice(Number(item.price || 0) * item.quantity)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatPrice(item.price)} per {item.unit_name}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          {/* Checkout Form */}
          <Card title="Informasi Pembayaran & Pengiriman">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
             initialValues={{ delivery_method: 'ambil' }}
            >
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
                <Select
                  placeholder="Pilih metode pembayaran"
                  size="large"
                  showSearch
                  optionFilterProp="children"
                >
                  {paymentMethods.map(method => (
                    <Select.Option key={method.id} value={method.id}>
                      {method.payment}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Delivery method: select pickup or delivery */}
              <Form.Item
                name="delivery_method"
                label={
                  <span className="flex items-center gap-2">
                    <EnvironmentOutlined style={{ fontSize: 16 }} />
                    Metode Pengiriman
                  </span>
                }
                rules={[{ required: true, message: 'Silakan pilih metode pengiriman' }]}
              >
                <Select placeholder="Pilih metode pengiriman" size="large">
                  <Select.Option value="ambil">Ambil ke Toko</Select.Option>
                  <Select.Option value="antar">Antar</Select.Option>
                </Select>
              </Form.Item>
              
              {/* Show shipping address only when delivery_method === 'antar' */}
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.delivery_method !== cur.delivery_method}>
                {() => {
                  return form.getFieldValue('delivery_method') === 'antar' ? (
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
                      <TextArea
                        rows={3}
                        placeholder="Masukkan alamat lengkap pengiriman"
                        size="large"
                      />
                    </Form.Item>
                  ) : (
                    // keep the field in the form but not required when pickup selected
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
                <TextArea
                  rows={2}
                  placeholder="Catatan tambahan untuk pesanan Anda"
                  size="large"
                />
              </Form.Item>
            </Form>
          </Card>
        </div>

        {/* Ringkasan Pesanan */}
        <div className="lg:col-span-1">
          <Card title="Ringkasan Pesanan" className="sticky top-6">
            <div className="space-y-3">
              {subtotalEntries.map(([unit, amount]) => (
                <div className="flex justify-between" key={unit}>
                  <Text>Subtotal ({unit}):</Text>
                  <Text>{formatPrice(amount)}</Text>
                </div>
              ))}
              
              <Divider className="my-3" />
              
              <div className="flex justify-between items-center">
                <Text strong className="text-lg">Total:</Text>
                <Text strong className="text-lg text-green-600">
                  {formatPrice(totalAmount)}
                </Text>
              </div>
              
              <div className="pt-4">
                <Button 
                  type="primary" 
                  size="large" 
                  block
                  loading={orderLoading}
                  onClick={() => form.submit()}
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
        </div>
      </div>
    </div>
  );
}
