"use client";

import React, { useEffect, useState } from "react";
import { Table, Button, Form, notification, Popconfirm, Image, Space, Tag, Input } from "antd";
import ProductForm from "@/components/add-on/FormProduct";
import ModalCategories from "@/components/add-on/ModalCategories";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, TagOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

export default function ManagementProduct() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();
  const [fileData, setFileData] = useState(null);
  const [q, setQ] = useState("");
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const router = useRouter();

  useEffect(() => { 
    fetchProducts(); 
    fetchDiscounts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/product");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      api.error({ message: "Gagal memuat produk" });
    } finally { setLoading(false); }
  }

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

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const openCreate = () => {
    setEditing(null);
    setFileData(null);
    form.resetFields();
    form.setFieldsValue({ units: [{ unit_name: "pcs", qty_per_unit: 1, price: 0, stock: 0 }] });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setFileData(null);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      category: record.category,
      units: Array.isArray(record.units) && record.units.length > 0
        ? record.units.map((u) => ({ unit_name: u.unit_name || "unit", qty_per_unit: u.qty_per_unit ?? 1, price: u.price ?? 0, stock: u.stock ?? 0, id: u.id }))
        : [{ unit_name: "pcs", qty_per_unit: 1, price: 0, stock: 0 }],
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch("/api/product", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }), credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { api.error({ message: data.error || "Gagal menghapus produk" }); return; }
      api.success({ message: "Produk dihapus" });
      fetchProducts();
    } catch (err) {
      console.error(err);
      api.error({ message: "Gagal menghapus produk" });
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const units = (values.units || []).map((u) => ({ unit_name: String(u.unit_name || "unit"), qty_per_unit: Number(u.qty_per_unit || 1), price: Number(u.price || 0), stock: Number(u.stock || 0), id: u.id }));
      const payload = { name: values.name, description: values.description || null, category: values.category || null, units };
      if (fileData) payload.base64 = fileData;

      let res;
      if (editing) {
        payload.id = editing.id;
        res = await fetch("/api/product", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      } else {
        res = await fetch("/api/product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { api.error({ message: data.error || "Gagal menyimpan produk" }); return; }
      api.success({ message: editing ? 'Produk diperbarui' : 'Produk ditambahkan' });
      setModalOpen(false); form.resetFields(); setFileData(null); 
      fetchProducts();
      fetchDiscounts(); // Refresh discounts when product changes
    } catch (err) {
      console.error(err);
      api.error({ message: 'Terjadi kesalahan' });
    } finally { setLoading(false); }
  };

  const handleFileChange = async (e) => { const file = e.target.files?.[0]; if (!file) { setFileData(null); return; } setFileData(await fileToBase64(file)); };

  const handleViewProduct = (productId) => {
    router.push(`/product/${productId}`);
  };

  // Helper function to calculate discount price
  const calculateDiscountPrice = (originalPrice, productId, unitId) => {
    const activeDiscounts = discounts.filter(d => {
      if (d.type === 'product' && Array.isArray(d.product_ids)) {
        return d.product_ids.includes(productId);
      }
      if (d.type === 'unit' && Array.isArray(d.unit_ids)) {
        return d.unit_ids.includes(unitId);
      }
      return false;
    });

    if (activeDiscounts.length === 0) return null;

    let finalPrice = originalPrice;
    activeDiscounts.forEach(discount => {
      if (discount.value_type === 'percentage') {
        finalPrice = finalPrice - (finalPrice * discount.value / 100);
      } else if (discount.value_type === 'nominal') {
        finalPrice = Math.max(0, finalPrice - discount.value);
      }
    });

    return finalPrice !== originalPrice ? finalPrice : null;
  };

  const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;

  const columns = [
    { 
      title: 'Gambar', 
      dataIndex: 'image_path', 
      key: 'image_path', 
      width: 100, 
      render: (v) => v ? 
        <Image src={`/api/product?filename=${v}`} alt="img" width={72} height={72} /> : 
        <div className="w-18 h-18 bg-gray-100 flex items-center justify-center text-sm text-gray-400">No</div> 
    },
    { 
      title: 'Nama', 
      dataIndex: 'name', 
      key: 'name', 
      ellipsis: { showTitle: true }, 
      sorter: (a, b) => a.name.localeCompare(b.name),
      onCell: () => ({ style: { minWidth: 160, maxWidth: 380 } }), 
      render: (v) => <div className="truncate">{v}</div> 
    },
    { 
      title: 'Units', 
      key: 'units', 
      render: (_, record) => { 
        const units = record.units || []; 
        if (!units.length) return <span className="text-gray-500">-</span>; 
        return (
          <div className="flex flex-col gap-2">
            {units.map((u) => (
              <div key={u.id || u.unit_name} className="flex flex-col text-sm">
                <span className="font-semibold text-green-600">{u.unit_name}</span>
                <span className="text-xs text-gray-500">Isi: {Number(u.qty_per_unit || 0)}</span>
              </div>
            ))}
          </div>
        ); 
      } 
    },
    { 
      title: 'Stok', 
      key: 'stock', 
      sorter: (a, b) => {
        const totalA = (a.units || []).reduce((s, u) => s + (Number(u.stock) || 0), 0);
        const totalB = (b.units || []).reduce((s, u) => s + (Number(u.stock) || 0), 0);
        return totalA - totalB;
      },
      render: (_, record) => { 
        const units = record.units || []; 
        if (!units.length) return <span className="text-gray-500">0</span>; 
        const total = units.reduce((s, u) => s + (Number(u.stock) || 0), 0); 
        return (
          <div className="flex flex-col gap-2">
            {units.map((u) => (
              <div key={u.id || u.unit_name} className="flex flex-col text-sm">
                <span className="font-semibold text-green-600">{u.unit_name}</span>
                <span className="text-xs text-gray-500">{Number(u.stock || 0).toLocaleString('id-ID')}</span>
              </div>
            ))}
            <span className="mt-1 text-xs">
              Total: <span className="font-bold ml-1">{total.toLocaleString('id-ID')}</span>
            </span>
          </div>
        ); 
      } 
    },
    { 
      title: 'Harga', 
      key: 'price', 
      sorter: (a, b) => {
        const avgPriceA = (a.units || []).reduce((sum, u, i, arr) => sum + (Number(u.price) || 0), 0) / Math.max((a.units || []).length, 1);
        const avgPriceB = (b.units || []).reduce((sum, u, i, arr) => sum + (Number(u.price) || 0), 0) / Math.max((b.units || []).length, 1);
        return avgPriceA - avgPriceB;
      },
      render: (_, record) => { 
        const units = record.units || []; 
        if (!units.length) return 'Rp 0'; 
        return (
          <div className="flex flex-col gap-2">
            {units.map((u) => {
              const originalPrice = Number(u.price || 0);
              const discountPrice = calculateDiscountPrice(originalPrice, record.id, u.id);
              
              return (
                <div key={u.id || `${u.unit_name}_${u.price}`} className="flex flex-col text-sm">
                  <span className="font-semibold text-green-600">{u.unit_name}</span>
                  <span className={`text-xs ${discountPrice !== null ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {formatPrice(originalPrice)}
                  </span>
                  {discountPrice !== null && (
                    <span className="text-xs font-bold text-green-600">{formatPrice(discountPrice)}</span>
                  )}
                </div>
              );
            })}
          </div>
        ); 
      } 
    },
    {
      title: 'Aksi', 
      key: 'actions', 
      width: 150, 
      align: 'center', 
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            className="w-full sm:w-auto" 
            onClick={() => handleViewProduct(record.id)}
            icon={<EyeOutlined />}
          />
          <Button 
            size="small" 
            className="w-full sm:w-auto" 
            onClick={() => openEdit(record)}
            icon={<EditOutlined />}
          />
          <Popconfirm 
            title="Hapus produk ini?" 
            onConfirm={() => handleDelete(record.id)} 
            okText="Ya" 
            cancelText="Batal"
          >
            <Button 
              danger 
              size="small" 
              className="w-full sm:w-auto"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="w-full">
      {contextHolder}
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold m-0">Manajemen Produk</h2>
      </header>

      <div className="mb-4 w-full flex justify-between gap-5 items-center">
        <Input.Search placeholder="Cari produk..." allowClear onChange={(e)=>setQ(e.target.value)} onSearch={(val)=>setQ(val)} className="max-w-[520px]" />
        <div className="flex flex-col gap-2">
          <Button onClick={()=>setCatModalOpen(true)} icon={<TagOutlined />}>Kategori</Button>
          <Button type="primary" onClick={openCreate} icon={<PlusOutlined />}>Tambah Produk</Button>
        </div>
      </div>

      {(() => {
        const needle = String(q||"").trim().toLowerCase();
        const filteredProducts = !needle ? products : products.filter((p)=> String(p.name||"").toLowerCase().includes(needle) || String(p.description||"").toLowerCase().includes(needle));
        return (
          <Table 
            columns={columns} 
            dataSource={filteredProducts} 
            loading={loading} 
            rowKey="id" 
            pagination={{
              // use defaultPageSize so the table isn't fully controlled and the size chooser works
              defaultPageSize: 10,
              pageSizeOptions: ['10','20','50','100'],
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} products`
            }}
            scroll={{ x: 800 }}
          />
        );
      })()}

      <ProductForm open={modalOpen} onClose={()=>{ setModalOpen(false); form.resetFields(); setFileData(null); }} onSave={handleOk} form={form} editing={editing} fileData={fileData} onFileChange={handleFileChange} />

      <ModalCategories open={catModalOpen} onClose={()=>setCatModalOpen(false)} onSaved={()=>{ fetchProducts(); /* keep modal open to allow more edits/adds */ }} />
    </div>
  );
}