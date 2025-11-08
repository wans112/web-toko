import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select,
  Upload,
  Space, 
  Popconfirm, 
  notification,
  Card,
  Typography,
  Divider
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CreditCardOutlined, InboxOutlined, EyeOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { Option, OptGroup } = Select;

// Payment method options for Indonesia
const paymentOptions = [
  // Banks
  { value: 'BCA', label: 'Bank Central Asia (BCA)', category: 'Bank' },
  { value: 'BRI', label: 'Bank Rakyat Indonesia (BRI)', category: 'Bank' },
  { value: 'BNI', label: 'Bank Negara Indonesia (BNI)', category: 'Bank' },
  { value: 'Mandiri', label: 'Bank Mandiri', category: 'Bank' },
  { value: 'CIMB Niaga', label: 'CIMB Niaga', category: 'Bank' },
  { value: 'Danamon', label: 'Bank Danamon', category: 'Bank' },
  { value: 'Permata', label: 'Bank Permata', category: 'Bank' },
  { value: 'OCBC NISP', label: 'OCBC NISP', category: 'Bank' },
  { value: 'Maybank', label: 'Maybank Indonesia', category: 'Bank' },
  { value: 'BSI', label: 'Bank Syariah Indonesia (BSI)', category: 'Bank' },
  { value: 'Jenius', label: 'Jenius (BTPN)', category: 'Bank' },
  { value: 'Digibank', label: 'Digibank by DBS', category: 'Bank' },
  { value: 'Kaltimtara', label: 'Bank Kaltimtara', category: 'Bank' },
  
  // E-Wallets
  { value: 'GoPay', label: 'GoPay', category: 'E-Wallet' },
  { value: 'OVO', label: 'OVO', category: 'E-Wallet' },
  { value: 'DANA', label: 'DANA', category: 'E-Wallet' },
  { value: 'ShopeePay', label: 'ShopeePay', category: 'E-Wallet' },
  { value: 'LinkAja', label: 'LinkAja', category: 'E-Wallet' },
  { value: 'Flip', label: 'Flip', category: 'E-Wallet' },
  { value: 'SeaBank', label: 'SeaBank', category: 'E-Wallet' },
  { value: 'Jago', label: 'Bank Jago', category: 'E-Wallet' },
  
  // Other Payment Methods
  { value: 'Cash', label: 'Cash (Tunai)', category: 'Other' },
  { value: 'QRIS', label: 'QRIS (Scan QR)', category: 'Other' },
];

export default function ManagementPayment() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [qrisFile, setQrisFile] = useState(null);
  const [qrisPreview, setQrisPreview] = useState(null);

  // Fetch payment methods
  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payment-method');
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(result.data);
      } else {
        api.error({
          message: 'Error',
          description: result.error || 'Failed to fetch payment methods'
        });
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      api.error({
        message: 'Error',
        description: 'Network error while fetching payment methods'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Handle form submission
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Determine final payment method name
      const finalPaymentMethod = values.payment === 'Custom' 
        ? values.custom_payment 
        : values.payment;

      const url = '/api/payment-method';
      const method = editingPayment ? 'PATCH' : 'POST';
      let response;

      // If QRIS selected and a file is present, send as FormData
      if (finalPaymentMethod === 'QRIS' && (qrisFile || (editingPayment && editingPayment.image_path))) {
        const formData = new FormData();
        formData.append('payment', finalPaymentMethod);
        formData.append('no_payment', values.no_payment || '');
        if (editingPayment) formData.append('id', editingPayment.id);
        if (qrisFile) {
          formData.append('qris_image', qrisFile);
        }

        response = await fetch(url, {
          method,
          body: formData
        });
      } else {
        const body = editingPayment 
          ? { 
              ...values, 
              id: editingPayment.id,
              payment: finalPaymentMethod
            }
          : { 
              ...values, 
              payment: finalPaymentMethod
            };

        // Remove custom_payment from body as it's not needed in API
        delete body.custom_payment;

        response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      const result = await response.json();

      if (result.success) {
        api.success({
          message: 'Success',
          description: result.message
        });
        
        setModalVisible(false);
        setEditingPayment(null);
        form.resetFields();
        fetchPaymentMethods();
      } else {
        api.error({
          message: 'Error',
          description: result.error || 'Operation failed'
        });
      }
    } catch (error) {
      console.error('Error saving payment method:', error);
      api.error({
        message: 'Error',
        description: 'Network error while saving payment method'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payment-method?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        api.success({
          message: 'Success',
          description: result.message
        });
        fetchPaymentMethods();
      } else {
        api.error({
          message: 'Error',
          description: result.error || 'Failed to delete payment method'
        });
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      api.error({
        message: 'Error',
        description: 'Network error while deleting payment method'
      });
    } finally {
      setLoading(false);
    }
  };

  // Open modal for create/edit
  const openModal = (payment = null) => {
    setEditingPayment(payment);
    setModalVisible(true);
    
    if (payment) {
      const selectedOption = paymentOptions.find(opt => opt.value === payment.payment);
      const isCustom = !selectedOption;
      
      setShowCustomInput(isCustom);
      setSelectedPayment(isCustom ? 'Custom' : payment.payment);
      
      form.setFieldsValue({
        payment: isCustom ? 'Custom' : payment.payment,
        custom_payment: isCustom ? payment.payment : '',
        no_payment: payment.no_payment || ''
      });
      // set QRIS preview when editing existing payment
      if (payment.image_path) {
        setQrisPreview(`/api/payment-method?image=${encodeURIComponent(payment.image_path)}`);
      } else {
        setQrisPreview(null);
      }
    } else {
      form.resetFields();
      setShowCustomInput(false);
      setSelectedPayment(null);
      setQrisFile(null);
      setQrisPreview(null);
    }
  };

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setEditingPayment(null);
    setShowCustomInput(false);
    setSelectedPayment(null);
    form.resetFields();
  };

  // Handle payment method change
  const handlePaymentChange = (value) => {
    setSelectedPayment(value);
    
    if (value === 'Custom') {
      setShowCustomInput(true);
      form.setFieldsValue({ custom_payment: '' });
    } else {
      setShowCustomInput(false);
      form.setFieldsValue({ custom_payment: undefined });
    }
    
    // Clear payment number if Cash is selected
    if (value === 'Cash') {
      form.setFieldsValue({ no_payment: '' });
    }
    // reset QRIS file/preview when changing away
    if (value !== 'QRIS') {
      setQrisFile(null);
      setQrisPreview(null);
    }
    // clear no_payment when selecting QRIS
    if (value === 'QRIS') {
      form.setFieldsValue({ no_payment: '' });
    }
  };

  const uploadProps = {
    name: 'qris_image',
    multiple: false,
    beforeUpload: (file) => {
      // prevent auto upload, store file in state
      setQrisFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setQrisPreview(e.target.result);
      reader.readAsDataURL(file);
      return false;
    },
    onRemove: () => {
      setQrisFile(null);
      setQrisPreview(null);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Metode Pembayaran',
      dataIndex: 'payment',
      key: 'payment',
      sorter: (a, b) => a.payment.localeCompare(b.payment),
      render: (text) => text
    },
    {
      title: 'Nomor Pembayaran',
      dataIndex: 'no_payment',
      key: 'no_payment',
      render: (text) => text || (
        <span style={{ color: '#999', fontStyle: 'italic' }}>-</span>
      )
    },
    {
      title: 'Aksi',
      key: 'actions',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            className="w-full sm:w-auto"
            onClick={() => openModal(record)}
          >
            <EditOutlined />
          </Button>
          <Popconfirm
            title="Delete Payment Method"
            description="Are you sure you want to delete this payment method?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              danger
              size="small"
              className="w-full sm:w-auto"
            >
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

    return (
    <div className="w-full">
      {contextHolder}
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold m-0">
          Manajemen Metode Pembayaran
        </h2>
        <Button
          type="primary"
          onClick={() => openModal()}
        >
          <PlusOutlined /> Tambah Metode Pembayaran
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={paymentMethods}
        rowKey="id"
        loading={loading}
        pagination={{
          // use defaultPageSize instead of pageSize so the table isn't fully controlled
          defaultPageSize: 10,
          // allow chooser options (strings required by antd)
          pageSizeOptions: ['10', '20', '50', '100'],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} metode pembayaran`
        }}
        scroll={{ x: 800 }}
      />

      <Modal
        title={
          <Space>
            <CreditCardOutlined />
            {editingPayment ? 'Edit Metode Pembayaran' : 'Add New Metode Pembayaran'}
          </Space>
        }
        open={modalVisible}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="Metode Pembayaran"
            name="payment"
            rules={[
              { required: true, message: 'Silakan pilih metode pembayaran' }
            ]}
          >
            <Select
              placeholder="Pilih metode pembayaran"
              size="large"
              onChange={handlePaymentChange}
              showSearch
              optionFilterProp="children"
            >
              <OptGroup label="Bank">
                {paymentOptions.filter(opt => opt.category === 'Bank').map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </OptGroup>
              
              <OptGroup label="E-Wallets">
                {paymentOptions.filter(opt => opt.category === 'E-Wallet').map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </OptGroup>

              <OptGroup label="Metode Lainnya">
                {paymentOptions.filter(opt => opt.category === 'Other').map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </OptGroup>
            </Select>
          </Form.Item>

          {modalVisible && showCustomInput && (
            <Form.Item
              label="Custom Payment Method Name"
              name="custom_payment"
              rules={[
                { required: true, message: 'Please enter custom payment method name' },
                { max: 100, message: 'Payment method name cannot exceed 100 characters' },
                { whitespace: true, message: 'Payment method name cannot be empty' }
              ]}
            >
              <Input
                placeholder="Enter custom payment method name"
                size="large"
              />
            </Form.Item>
          )}

          {selectedPayment === 'QRIS' && (
            <Form.Item label="QRIS Image" name="qris_image">
              <Upload.Dragger {...uploadProps} accept="image/*" listType="picture">
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">Klik atau seret file ke sini untuk meng-upload QRIS</p>
                <p className="ant-upload-hint">PNG/JPEG/WebP disarankan. Maks ukuran: 5MB</p>
              </Upload.Dragger>

              {qrisPreview && (
                <div className="mt-2">
                  <a href={qrisPreview} target="_blank" rel="noopener noreferrer"><EyeOutlined /> Preview</a>
                </div>
              )}
            </Form.Item>
          )}

          {selectedPayment !== 'QRIS' && (
            <Form.Item
              label="Nomor Pembayaran"
              name="no_payment"
              rules={[
                { max: 50, message: 'Nomor pembayaran tidak boleh lebih dari 50 karakter' }
              ]}
            >
              <Input
                placeholder={
                  selectedPayment === 'Cash' 
                    ? "Pembayar Cash tidak memerlukan nomor pembayaran"
                    : "Enter payment number or account"
                }
                size="large"
                disabled={selectedPayment === 'Cash'}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}