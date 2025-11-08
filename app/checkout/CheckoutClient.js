"use client";

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Input, 
  Select, 
  Typography, 
  notification, 
  Spin,
  Empty
} from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, CreditCardOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { getCurrentUserClient } from "@/lib/auth";
import ItemsList from './components/ItemsList';
import SummaryCard from './components/SummaryCard';
import PaymentForm from './components/PaymentForm';
import SuccessCash from './components/SuccessCash';
import SuccessNonCash from './components/SuccessNonCash';
import { calculateDiscountPrice, calculateTotal, calculateOriginalTotal, formatPrice, buildSubtotalsByUnit } from './utils/pricing';

const { Title } = Typography;
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
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get checkout source and token from URL params
  const source = searchParams.get('source') || 'cart';
  const directToken = searchParams.get('token');

  useEffect(() => {
    // Get user from JWT token, then load items depending on source
    async function loadUser() {
      const user = await getCurrentUserClient();
      if (!user) {
        // If no valid token, redirect to login
        router.replace("/login");
        return;
      }
      setCurrentUser(user);
      
      if (source === 'direct') {
        // direct checkout must have a valid token
        if (!directToken) {
          api.error({ message: 'Token checkout tidak ditemukan' });
          router.replace('/');
          return;
        }
        await loadDirectItemsFromToken(directToken);
      } else {
        fetchCartItems();
      }
      fetchPaymentMethods();
    }
    
    loadUser();
  }, [source, directToken]);

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
      } else if (source === 'direct') {
        if (directToken) {
          loadDirectItemsFromToken(directToken);
        } else {
          api.error({ message: 'Token checkout tidak ditemukan' });
          router.replace('/');
        }
      }
    }
    fetchPaymentMethods();
  }, [source, directToken]);

  async function loadDirectItemsFromToken(token) {
    try {
      setLoading(true);
      const resp = await fetch(`/api/checkout/direct?token=${encodeURIComponent(token)}`, { credentials: 'include' });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        api.error({ message: data.error || 'Token tidak valid' });
        router.replace('/');
        return;
      }
      setDirectItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error('Failed resolving direct checkout token:', e);
      api.error({ message: 'Gagal memuat data checkout' });
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCartItems() {
    setLoading(true);
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.data)) {
        setCartItems(data.data);
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

  // Diskon
  const [discounts, setDiscounts] = useState([]);

  useEffect(() => {
    // ...existing code...
    fetchDiscounts();
  }, [source, directToken]);

  async function fetchDiscounts() {
    try {
      const res = await fetch("/api/product/discount");
      const data = await res.json();
      if (data.success) {
        setDiscounts(data.data.filter(d => d.active) || []);
      }
    } catch (err) {
      console.error('Error fetching discounts:', err);
    }
  }

  // Helper moved to utils/pricing

  // moved to utils/pricing

  // Calculate total price with discounts
  // moved to utils/pricing

  // Calculate original total without discounts
  // moved to utils/pricing

  const handleSubmit = async (values) => {
    if (!currentUser) {
      api.error({ message: 'Anda belum login. Silakan login terlebih dahulu.' });
      return;
    }
    
    setOrderLoading(true);
    try {
      const cartResponse = await fetch('/api/cart');
      const data = await cartResponse.json();
      if (cartResponse.ok && data.success && Array.isArray(data.data)) {
        setCartItems(data.data);
      } else if (cartResponse.status === 401) {
        api.error({ message: 'Anda belum login. Silakan login terlebih dahulu.' });
        setOrderLoading(false);
        return;
      } else {
        api.error({ message: data.error || 'Gagal mengambil data keranjang', description: JSON.stringify(data) });
        setOrderLoading(false);
        return;
      }

      // Determine shipping address and type
      let shipping_address = values.shipping_address;
      const shipping_type = values.shipping_type || 'pickup';
      if (shipping_type === 'pickup') {
        // leave shipping_address empty when customer picks up
        shipping_address = null;
      } else if (!shipping_address) {
        // fallback if delivery selected but no address provided
        shipping_address = null;
      }

      const orderData = {
        user_id: currentUser?.id, // Get from auth context
        payment_id: values.payment_method,
        shipping_type,
        shipping_address,
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
        // Clear cart after successful checkout
        if (source === 'cart') {
          await fetch('/api/cart', { method: 'DELETE' });
          setCartItems([]);
        }
        const selectedPayment = paymentMethods.find(pm => pm.id === values.payment_method);
        const orderWithPayment = {
          ...result.data,
          payment_method_info: selectedPayment,
          shipping_type: shipping_type
        };
        setOrderSuccess(orderWithPayment);
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
  const totalAmount = calculateTotal(items, discounts);
  const originalTotalAmount = calculateOriginalTotal(items);
  const totalDiscount = originalTotalAmount - totalAmount;
  const hasDiscount = totalDiscount > 0;
  
  // group subtotals by unit_name (fallback to product_name)
  const subtotalEntries = buildSubtotalsByUnit(items, discounts);

  if (orderSuccess) {
    const selectedPaymentMethod = orderSuccess.payment_method_info || paymentMethods.find(pm => pm.id === orderSuccess.payment_id);
    const isCashPayment = selectedPaymentMethod?.payment?.toLowerCase().includes('cash') || selectedPaymentMethod?.payment?.toLowerCase().includes('tunai');

    // Helper to clear localStorage and state
    const clearOrderSuccess = () => {
      localStorage.removeItem('orderSuccess');
      setOrderSuccess(null);
    };

    if (isCashPayment) {
      const handleConfirm = async () => {
        setSendingMessage(true);
        try {
          const response = await fetch('/api/users?role=admin&online=true');
          const onlineAdmins = await response.json();
          if (!Array.isArray(onlineAdmins) || onlineAdmins.length === 0) {
            api.warning({ message: 'Tidak ada admin yang sedang online. Silakan coba lagi nanti.' });
            return;
          }
          const message = `Halo admin, mohon proses pesanan ${orderSuccess.order_number} sebesar ${formatPrice(orderSuccess.total_amount)} dengan metode ${selectedPaymentMethod?.payment}. Terima kasih.`;
          const results = await Promise.all(
            onlineAdmins.map((admin) =>
              fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_user_id: admin.id, message })
              })
            )
          );
          const successCount = results.filter((r) => r.ok).length;
          if (successCount > 0) api.success({ message: `Pesan berhasil dikirim ke ${successCount} admin yang sedang online.` });
          else api.error({ message: 'Gagal mengirim pesan.' });
        } catch (error) {
          console.error('Error sending confirmation:', error);
          api.error({ message: 'Terjadi kesalahan saat mengirim konfirmasi.' });
        } finally {
          setSendingMessage(false);
        }
      };
      return (
        <SuccessCash
          contextHolder={contextHolder}
          order={orderSuccess}
          sendingMessage={sendingMessage}
          onContinueShopping={() => { clearOrderSuccess(); router.push('/dashboard?tab=home'); }}
          onViewOrders={() => { clearOrderSuccess(); router.push('/dashboard?tab=order'); }}
          onConfirmToAdmin={handleConfirm}
        />
      );
    }
    // Transfer/E-wallet
    // non-cash flow
    const handleConfirm = async () => {
      setSendingMessage(true);
      try {
        const response = await fetch('/api/users?role=admin&online=true');
        const onlineAdmins = await response.json();
        if (!Array.isArray(onlineAdmins) || onlineAdmins.length === 0) {
          api.warning({ message: 'Tidak ada admin yang sedang online. Silakan coba lagi nanti.' });
          return;
        }
        const message = `Halo admin, saya sudah melakukan transfer untuk pesanan ${orderSuccess.order_number} sebesar ${formatPrice(orderSuccess.total_amount)} melalui ${selectedPaymentMethod?.payment}. Mohon konfirmasinya. Terima kasih.`;
        const results = await Promise.all(
          onlineAdmins.map((admin) =>
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to_user_id: admin.id, message })
            })
          )
        );
        const successCount = results.filter((r) => r.ok).length;
        if (successCount > 0) api.success({ message: `Pesan konfirmasi berhasil dikirim ke ${successCount} admin yang sedang online.` });
        else api.error({ message: 'Gagal mengirim pesan konfirmasi.' });
      } catch (error) {
        console.error('Error sending confirmation:', error);
        api.error({ message: 'Terjadi kesalahan saat mengirim konfirmasi.' });
      } finally {
        setSendingMessage(false);
      }
    };
    const handleUploadProof = async () => {
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
          setOrderSuccess((prev) => {
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
    };
    return (
      <SuccessNonCash
        contextHolder={contextHolder}
        order={orderSuccess}
        selectedPaymentMethod={selectedPaymentMethod}
        proofFile={proofFile}
        setProofFile={setProofFile}
        uploadingProof={uploadingProof}
        sendingMessage={sendingMessage}
        onUploadProof={handleUploadProof}
        onCancelProof={() => setProofFile(null)}
        onContinueShopping={() => { clearOrderSuccess(); router.push('/dashboard?tab=home'); }}
        onViewOrders={() => { clearOrderSuccess(); router.push('/dashboard?tab=order'); }}
        onConfirmToAdmin={handleConfirm}
        api={api}
      />
    );
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
        <div className="lg:col-span-2">
          <Card title="Item Pesanan" className="mb-6">
            <ItemsList items={items} discounts={discounts} />
          </Card>
          <PaymentForm form={form} paymentMethods={paymentMethods} onFinish={handleSubmit} />
        </div>
        <div className="lg:col-span-1">
          <SummaryCard
            items={items}
            discounts={discounts}
            submitting={orderLoading}
            onSubmit={() => form.submit()}
          />
        </div>
      </div>
    </div>
  );
}
