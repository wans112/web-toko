"use client";
import { useState, useEffect, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Tag,
  Space,
  message,
  notification,
  Typography,
  Card,
  Image,
  Row,
  Col,
  Divider,
  Select,
  Input,
  DatePicker,
  Popover,
  Badge,
  Descriptions,
  Statistic,
  Popconfirm
} from "antd";
import {
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  InboxOutlined,
  RollbackOutlined
} from "@ant-design/icons";
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function ManagementOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportDateRange, setExportDateRange] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [api, contextHolder] = notification.useNotification();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0
  });
  const lastPendingRef = useRef(null);
  const lastLatestOrderIdRef = useRef(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    dateRange: null,
    search: ''
  });

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // Poll for new orders (pending) and notify
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const resp = await fetch('/api/order?status=menunggu');
        if (!resp.ok) return;
        const data = await resp.json();
        const pendingCount = data?.stats?.pending ?? (Array.isArray(data?.orders) ? data.orders.length : 0);
        const latestOrder = Array.isArray(data?.orders) && data.orders.length > 0 ? data.orders[0] : null;

        if (lastPendingRef.current == null) {
          lastPendingRef.current = pendingCount;
          if (latestOrder?.id) lastLatestOrderIdRef.current = latestOrder.id;
          return;
        }

        // If pending increased or a new top order appears, notify
        const hasNew = pendingCount > (lastPendingRef.current || 0) || (latestOrder?.id && latestOrder.id !== lastLatestOrderIdRef.current);
        if (hasNew && latestOrder) {
          lastPendingRef.current = pendingCount;
          lastLatestOrderIdRef.current = latestOrder.id;
          api.info({
            message: 'Order baru masuk',
            description: `Pesanan ${latestOrder.order_number || latestOrder.id} menunggu diproses`,
            placement: 'topRight'
          });
          // Optional: refresh current table if viewing menunggu filter
          if ((filters.status || '') === 'menunggu' || !filters.status) {
            fetchOrders();
          }
        }
      } catch (e) {
        // silent
      }
    };
    timer = setInterval(poll, 10000);
    // First run
    poll();
    return () => clearInterval(timer);
  }, [filters]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.paymentStatus) queryParams.append('paymentStatus', filters.paymentStatus);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.append('startDate', filters.dateRange[0].format('YYYY-MM-DD'));
        queryParams.append('endDate', filters.dateRange[1].format('YYYY-MM-DD'));
      }

      const response = await fetch(`/api/order?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setStats(data.stats || {});
      } else {
        message.error("Gagal memuat data pesanan");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      message.error("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setViewModalVisible(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const res = await fetch('/api/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, payment_status: 'lunas' })
      });

      const data = await res.json();
      if (!res.ok) {
        api.error({
          message: 'Gagal mengonfirmasi pembayaran',
          description: data?.error || 'Terjadi kesalahan saat mengonfirmasi pembayaran',
          placement: 'topRight'
        });
      } else {
        api.success({
          message: 'Pembayaran dikonfirmasi',
          description: `Pesanan ${selectedOrder?.order_number || selectedOrder?.id} telah ditandai LUNAS.`,
          placement: 'topRight'
        });
        const updated = (data && data.data) ? data.data : data;
        // preserve items if response doesn't include them
        const merged = {
          ...(selectedOrder || {}),
          ...(updated || {}),
          items: (updated && updated.items && updated.items.length) ? updated.items : (selectedOrder?.items || [])
        };
        setSelectedOrder(merged);
        fetchOrders();
      }
      } catch (e) {
      console.error('Confirm payment error', e);
      api.error({
        message: 'Terjadi kesalahan',
        description: 'Gagal mengonfirmasi pembayaran',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const res = await fetch('/api/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, status: 'diproses' })
      });

      const data = await res.json();
      if (!res.ok) {
        api.error({
          message: 'Gagal memperbarui pesanan',
          description: data?.error || 'Terjadi kesalahan saat memperbarui status pesanan',
          placement: 'topRight'
        });
      } else {
        api.success({
          message: 'Status pesanan diperbarui',
          description: `Pesanan ${selectedOrder?.order_number || selectedOrder?.id} status diubah ke Diproses.`,
          placement: 'topRight'
        });
        const updated = (data && data.data) ? data.data : data;
        const merged = {
          ...(selectedOrder || {}),
          ...(updated || {}),
          items: (updated && updated.items && updated.items.length) ? updated.items : (selectedOrder?.items || [])
        };
        setSelectedOrder(merged);
        fetchOrders();
      }
    } catch (e) {
      console.error('Confirm order error', e);
      api.error({
        message: 'Terjadi kesalahan',
        description: 'Gagal memperbarui status pesanan',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  };

    // Advance order status to next step depending on delivery method
    const handleAdvanceStatus = async (targetStatus) => {
      // targetStatus should be one of: 'processing' | 'shipped' | 'delivered'
      if (!selectedOrder) return;
      setLoading(true);
      try {
        const res = await fetch('/api/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedOrder.id, status: targetStatus })
        });

        const data = await res.json();
        if (!res.ok) {
          api.error({
            message: 'Gagal memperbarui status pesanan',
            description: data?.error || 'Terjadi kesalahan saat memperbarui status pesanan',
            placement: 'topRight'
          });
        } else {
          const displayMap = {
            processing: 'Disiapkan',
            shipped: 'Dikirim',
            delivered: 'Selesai'
          };
          api.success({
            message: 'Status pesanan diperbarui',
            description: `Pesanan ${selectedOrder?.order_number || selectedOrder?.id} status diubah ke ${displayMap[targetStatus] || targetStatus}.`,
            placement: 'topRight'
          });
          const updated = (data && data.data) ? data.data : data;
          const merged = {
            ...(selectedOrder || {}),
            ...(updated || {}),
            items: (updated && updated.items && updated.items.length) ? updated.items : (selectedOrder?.items || [])
          };
          setSelectedOrder(merged);
          fetchOrders();
        }
      } catch (e) {
        console.error('Advance status error', e);
        api.error({
          message: 'Terjadi kesalahan',
          description: 'Gagal memperbarui status pesanan',
          placement: 'topRight'
        });
      } finally {
        setLoading(false);
      }
    };

  // Handle order refund/return
  const handleRefundOrder = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      // update both payment_status and order status (cancelled)
      const res = await fetch('/api/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, payment_status: 'dikembalikan', status: 'cancelled' })
      });

      const data = await res.json();
      if (!res.ok) {
        api.error({
          message: 'Gagal memproses pengembalian',
          description: data?.error || 'Terjadi kesalahan saat memproses pengembalian',
          placement: 'topRight'
        });
      } else {
        api.success({
          message: 'Pengembalian berhasil diproses',
          description: `Pesanan ${selectedOrder?.order_number || selectedOrder?.id} telah dibatalkan dan pembayaran dikembalikan.`,
          placement: 'topRight'
        });
        const updated = (data && data.data) ? data.data : data;
        const merged = {
          ...(selectedOrder || {}),
          ...(updated || {}),
          items: (updated && updated.items && updated.items.length) ? updated.items : (selectedOrder?.items || [])
        };
        setSelectedOrder(merged);
        fetchOrders();
      }
    } catch (e) {
      console.error('Refund order error', e);
      api.error({
        message: 'Terjadi kesalahan',
        description: 'Gagal memproses pengembalian',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  };

  // Modal footer computed to follow two flows:
  // pickup: menunggu -> disiapkan -> selesai
  // delivery: menunggu -> disiapkan -> dikirim -> selesai
  const modalFooter = [];
  // show payment confirmation when needed
  if (selectedOrder && (selectedOrder.payment_status === 'belum_bayar' || selectedOrder.payment_status === 'menunggu_konfirmasi')) {
    modalFooter.push(
      <Button key="confirmPayment" type="primary" onClick={handleConfirmPayment} icon={<CheckCircleOutlined />}>
        Konfirmasi Pembayaran
      </Button>
    );
  }

  // determine delivery method (pickup vs delivery)
  const isDelivery = (() => {
  if (!selectedOrder) return false;
  // prefer new field `shipping_type` ('delivery'|'pickup')
  const st = selectedOrder.shipping_type || (selectedOrder.delivery_method === 'antar' ? 'delivery' : (selectedOrder.delivery_method === 'ambil' ? 'pickup' : null));
  if (st === 'delivery') return true;
  if (st === 'pickup') return false;
  // fallback to heuristic based on shipping_address
  if (selectedOrder.shipping_address && selectedOrder.shipping_address === 'ambil ke toko') return false;
  if (selectedOrder.shipping_address) return true;
  return false;
  })();

  const status = selectedOrder?.status;
  // helper checks for possible stored variants
  const isStatus = (s) => {
    if (!status) return false;
    const st = String(status).toLowerCase();
    return st === s || st === ({ pending: 'menunggu', processing: 'diproses', shipped: 'dikirim', delivered: 'diterima', cancelled: 'dibatalkan' }[s] || '') ;
  };

  // show next action based on current status and delivery method
  if (selectedOrder && (isStatus('pending') || isStatus('menunggu'))) {
    modalFooter.push(
      <Button key="markPrepared" type="primary" onClick={() => handleAdvanceStatus('processing')} icon={<InboxOutlined />}>
        Siapkan
      </Button>
    );
  } else if (selectedOrder && (isStatus('processing') || isStatus('diproses'))) {
    if (isDelivery) {
      modalFooter.push(
        <Button key="markShipped" type="primary" onClick={() => handleAdvanceStatus('shipped')} icon={<InboxOutlined />}>
          Kirim
        </Button>
      );
    } else {
      modalFooter.push(
        <Button key="markDelivered" type="primary" onClick={() => handleAdvanceStatus('delivered')} icon={<CheckCircleOutlined />}>
          Selesai
        </Button>
      );
    }
  } else if (selectedOrder && (isStatus('shipped') || isStatus('dikirim'))) {
    modalFooter.push(
      <Button key="markDelivered2" type="primary" onClick={() => handleAdvanceStatus('delivered')} icon={<CheckCircleOutlined />}>
        Selesai
      </Button>
    );
  }

  // add refund button for completed orders that are paid
  if (selectedOrder && (isStatus('delivered') || isStatus('diterima')) && selectedOrder.payment_status === 'lunas') {
    modalFooter.push(
      <Popconfirm
        key="refundPopconfirm"
        title="Konfirmasi Pengembalian"
        description="Apakah Anda yakin ingin memproses pengembalian untuk pesanan ini?"
        onConfirm={handleRefundOrder}
        okText="Ya, Kembalikan"
        cancelText="Batal"
        okType="danger"
      >
        <Button key="refund" danger icon={<RollbackOutlined />}>
          Pengembalian
        </Button>
      </Popconfirm>
    );
  }

  // always provide a close button
  modalFooter.push(
    <Button key="close" onClick={() => setViewModalVisible(false)}>
      Tutup
    </Button>
  );

  const getStatusColor = (status) => {
    const colors = {
      menunggu: 'orange',
      diproses: 'blue',
      dikirim: 'cyan',
      diterima: 'green',
      dibatalkan: 'red'
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      belum_bayar: 'red',
      menunggu_konfirmasi: 'orange',
      lunas: 'green',
      dikembalikan: 'red'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const columns = [
    {
      title: 'Nomor Pesanan',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 150,
      sorter: (a, b) => a.order_number.localeCompare(b.order_number),
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Pelanggan',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 150,
      sorter: (a, b) => a.customer_name.localeCompare(b.customer_name),
      render: (text) => (
        <div>
          <UserOutlined /> {text}
        </div>
      )
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      sorter: (a, b) => a.total_amount - b.total_amount,
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          {formatCurrency(amount)}
        </Text>
      )
    },
    {
      title: 'Status Pesanan',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Menunggu', value: 'menunggu' },
        { text: 'Diproses', value: 'diproses' },
        { text: 'Dikirim', value: 'dikirim' },
        { text: 'Diterima', value: 'diterima' },
        { text: 'Dibatalkan', value: 'dibatalkan' }
      ],
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Status Pembayaran',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 140,
      filters: [
        { text: 'Belum Bayar', value: 'belum_bayar' },
        { text: 'Lunas', value: 'lunas' },
        { text: 'Refund', value: 'refunded' }
      ],
      render: (status) => (
        <Tag color={getPaymentStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Metode Pembayaran',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 150,
      render: (method) => (
        <div>
          <CreditCardOutlined /> {method}
        </div>
      )
    },
    {
      title: 'Tanggal',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      render: (date) => (
        <div>
          <CalendarOutlined /> {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </div>
      )
    },
  // removed action column — rows are clickable to view details
  ];

  return (
    <div>
      {contextHolder}
      {/* Statistics Cards (flex wrap) */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <Card>
            <Statistic
              title="Total Pesanan"
              value={stats.total}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Card>
            <Statistic
              title="Menunggu"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Card>
            <Statistic
              title="Diproses"
              value={stats.processing}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Card>
            <Statistic
              title="Diterima"
              value={stats.delivered}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Card>
            <Statistic
              title="Dibatalkan"
              value={stats.cancelled}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </div>
      </div>

      {/* Filters (flex layout) */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <Select
              placeholder="Filter Status Pesanan"
              style={{ width: '100%' }}
              allowClear
              value={filters.status || undefined}
              onChange={(value) => setFilters({...filters, status: value || ''})}
            >
              <Option value="menunggu">Menunggu</Option>
              <Option value="diproses">Diproses</Option>
              <Option value="dikirim">Dikirim</Option>
              <Option value="diterima">Diterima</Option>
              <Option value="dibatalkan">Dibatalkan</Option>
            </Select>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 160 }}>
            <Select
              placeholder="Filter Status Pembayaran"
              style={{ width: '100%' }}
              allowClear
              value={filters.paymentStatus || undefined}
              onChange={(value) => setFilters({...filters, paymentStatus: value || ''})}
            >
              <Option value="belum_bayar">Belum Bayar</Option>
              <Option value="lunas">Lunas</Option>
              <Option value="refunded">Refunded</Option>
            </Select>
          </div>

          <div style={{ flex: '1 1 200px', minWidth: 160 }}>
            <Input
              placeholder="Cari nomor pesanan..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>

          <div style={{ flex: '1 1 240px', minWidth: 180 }}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) => setFilters({...filters, dateRange: dates})}
              format="DD/MM/YYYY"
            />
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <Button type="default" onClick={() => setExportModalVisible(true)} icon={<FileTextOutlined />}>Download CSV</Button>
          </div>
        </div>
      </Card>

      {/* Export Modal */}
      <Modal
        title="Download Export Pesanan"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setExportModalVisible(false)}>Batal</Button>,
          <Button key="download" type="primary" loading={exporting} icon={<FileTextOutlined />} onClick={async () => {
            // build params using selected export range if present, otherwise fall back to filters
            setExporting(true);
            try {
              const params = new URLSearchParams();
              const range = (exportDateRange && exportDateRange.length === 2) ? exportDateRange : (filters.dateRange && filters.dateRange.length === 2 ? filters.dateRange : null);
              if (range && range.length === 2) {
                params.append('startDate', range[0].format('YYYY-MM-DD'));
                params.append('endDate', range[1].format('YYYY-MM-DD'));
              }
              if (filters.status) params.append('status', filters.status);
              if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);

              const res = await fetch(`/api/order/export?${params.toString()}`, { credentials: 'include' });
              if (!res.ok) {
                message.error('Gagal mengekspor pesanan');
                setExporting(false);
                return;
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const cd = res.headers.get('content-disposition') || '';
              const match = /filename\s*=\s*"?([^";]+)"?/.exec(cd);
              const fname = match ? match[1] : `orders-${new Date().toISOString().slice(0,10)}.csv`;
              a.download = fname;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              message.success('Download dimulai');
              setExportModalVisible(false);
            } catch (e) {
              console.error('Export error', e);
              message.error('Terjadi kesalahan saat mengekspor');
            } finally {
              setExporting(false);
            }
          }}>Download</Button>
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 8 }}>Pilih rentang tanggal (kosong = gunakan filter saat ini):</div>
            <RangePicker
              style={{ width: '100%' }}
              value={exportDateRange}
              onChange={(dates) => setExportDateRange(dates)}
              format="DD/MM/YYYY"
            />
          </div>
        </div>
      </Modal>

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} dari ${total} pesanan`,
            pageSizeOptions: ['10', '20', '50', '100'],
            defaultPageSize: 20,
          }}
          onRow={(record) => ({
            onClick: () => handleViewOrder(record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      {/* View Order Modal */}
      <Modal
        title={
          <div>
            <EyeOutlined /> Detail Pesanan
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={modalFooter}
        width={800}
      >
        {selectedOrder && (
          <div>
            {/* Order Info */}
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Pesanan">
                <Text strong>{selectedOrder.order_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedOrder.status)}>
                  {selectedOrder.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Pelanggan">
                <UserOutlined /> {selectedOrder.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label="Status Pembayaran">
                <Tag color={getPaymentStatusColor(selectedOrder.payment_status)}>
                  {selectedOrder.payment_status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Metode Pembayaran">
                <CreditCardOutlined /> {selectedOrder.payment_method}
                {selectedOrder.payment_number && (
                  <Text type="secondary"> - {selectedOrder.payment_number}</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Pengiriman">
                {(() => {
                  // prefer shipping_type, fallback to delivery_method, then shipping_address heuristic
                  const st = selectedOrder.shipping_type || (selectedOrder.delivery_method === 'antar' ? 'delivery' : (selectedOrder.delivery_method === 'ambil' ? 'pickup' : undefined));
                  if (st === 'delivery') return <Tag color="blue">ANTAR</Tag>;
                  if (st === 'pickup') return <Tag color="green">AMBIL KE TOKO</Tag>;
                  // fallback based on shipping_address
                  if (selectedOrder.shipping_address && selectedOrder.shipping_address !== 'ambil ke toko') return <Tag color="blue">ANTAR</Tag>;
                  if (selectedOrder.shipping_address && selectedOrder.shipping_address === 'ambil ke toko') return <Tag color="green">AMBIL KE TOKO</Tag>;
                  return <Text>-</Text>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong style={{ color: '#1890ff', fontSize: '16px' }}>
                  {formatCurrency(selectedOrder.total_amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Pesanan" span={1}>
                <CalendarOutlined /> {dayjs(selectedOrder.created_at).format('DD MMMM YYYY, HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {/* show shipping address only when delivery is antar */}
            {((selectedOrder.shipping_type === 'delivery') || (selectedOrder.delivery_method === 'antar') || (selectedOrder.delivery_method === undefined && selectedOrder.shipping_address && selectedOrder.shipping_address !== 'ambil ke toko')) && selectedOrder.shipping_address && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Title level={5}>
                  <EnvironmentOutlined /> Alamat Pengiriman
                </Title>
                <Text>{selectedOrder.shipping_address}</Text>
              </Card>
            )}

            {/* Proof of Payment */}
            {(selectedOrder.proof_payment_path || selectedOrder.proof) && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Title level={5}>
                  <FileTextOutlined /> Bukti Pembayaran
                </Title>
                <div>
                  <Image
                    src={`/api/product?filename=${selectedOrder.proof_payment_path || selectedOrder.proof}`}
                    alt="Bukti Pembayaran"
                    width={240}
                  />
                </div>
              </Card>
            )}

            {/* Order Items */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Title level={5}>
                <ShoppingCartOutlined /> Item Pesanan
              </Title>
              <Table
                size="small"
                dataSource={selectedOrder.items || []}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Produk',
                    dataIndex: 'product_name',
                    key: 'product_name',
                  },
                  {
                    title: 'Unit',
                    dataIndex: 'unit_name',
                    key: 'unit_name',
                  },
                  {
                    title: 'Qty',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    width: 60,
                  },
                  {
                    title: 'Harga',
                    dataIndex: 'unit_price',
                    key: 'unit_price',
                    render: (price) => formatCurrency(price),
                  },
                  {
                    title: 'Diskon',
                    dataIndex: 'discount_amount',
                    key: 'discount_amount',
                    render: (discount) => discount > 0 ? `-${formatCurrency(discount)}` : '-',
                  },
                  {
                    title: 'Subtotal',
                    dataIndex: 'total_price',
                    key: 'total_price',
                    render: (total) => <Text strong>{formatCurrency(total)}</Text>,
                  },
                ]}
              />
            </Card>

            {/* Notes */}
            {selectedOrder.notes && (
              <Card size="small">
                <Title level={5}>
                  <FileTextOutlined /> Catatan
                </Title>
                <Text>{selectedOrder.notes}</Text>
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Order Modal */}
  {/* Edit modal removed - editing handled elsewhere */}
    </div>
  );
}
