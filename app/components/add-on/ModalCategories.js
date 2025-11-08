"use client";

import React, { useEffect, useState } from "react";
import { 
  Modal, 
  Button, 
  Table, 
  Form, 
  Input, 
  Space, 
  Popconfirm, 
  notification,
  Card,
  Typography,
  Divider
} from "antd";
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  TagOutlined,
  SaveOutlined,
  CloseOutlined
} from "@ant-design/icons";

const { Title } = Typography;

export default function ModalCategories({ open, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      api.error({ message: 'Gagal mengambil kategori' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
  setEditing(null);
  form.resetFields();
  setShowCreateForm(true);
  }

  function openEdit(record) {
    // open form-based edit (kept for backward compatibility)
    setEditing(record);
    form.setFieldsValue({ name: record.name });
  setShowCreateForm(true);
  }

  function openInlineEdit(record) {
    setEditingId(record.id);
    setEditingName(record.name || "");
  }

  function cancelInlineEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        api.success({ message: 'Kategori dihapus' });
        fetchCategories();
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('categories:updated')); } catch (e) {}
  onSaved && onSaved();
      } else {
        const body = await res.json().catch(() => ({}));
        api.error({ message: body.error || 'Gagal menghapus kategori' });
      }
    } catch (err) {
      console.error(err);
      api.error({ message: 'Gagal menghapus kategori' });
    }
  }

  async function handleSave(values) {
    try {
      if (editing) {
        const payload = { id: editing.id, name: values.name };
        const res = await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Gagal memperbarui kategori');
        api.success({ message: 'Kategori diperbarui' });
      } else {
        const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name }) });
        if (res.status !== 201) throw new Error('Gagal membuat kategori');
        api.success({ message: 'Kategori dibuat' });
      }
  form.resetFields();
  // if we were editing, close the create/edit form; if creating, keep the form open to allow multiple adds
  const wasEditing = !!editing;
  setEditing(null);
  if (wasEditing) setShowCreateForm(false);
  fetchCategories();
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('categories:updated')); } catch (e) {}
  onSaved && onSaved();
    } catch (err) {
      console.error(err);
      api.error({ message: String(err.message || err) });
    }
  }

  async function handleInlineSave() {
    if (!editingId) return;
    const name = String(editingName || "").trim();
    if (!name) { api.error({ message: 'Nama wajib diisi' }); return; }
    setInlineSaving(true);
    try {
      const payload = { id: editingId, name };
      const res = await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui kategori');
      }
      const updated = await res.json().catch(() => null);
      // update local list
      setCategories((prev) => prev.map((c) => (c.id === (updated?.id || editingId) ? (updated || { ...c, name }) : c)));
      api.success({ message: 'Kategori diperbarui' });
  cancelInlineEdit();
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('categories:updated')); } catch (e) {}
  onSaved && onSaved();
    } catch (err) {
      console.error(err);
      api.error({ message: String(err.message || err) });
    } finally {
      setInlineSaving(false);
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id
    },
    {
      title: 'Nama Kategori',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => (
        editingId === r.id ? (
          <Input 
            value={editingName} 
            onChange={(e) => setEditingName(e.target.value)} 
            onPressEnter={handleInlineSave}
            size="middle"
            placeholder="Masukkan nama kategori"
          />
        ) : (
          <Space>
            {v}
          </Space>
        )
      )
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, r) => (
        editingId === r.id ? (
          <Space size="small">
            <Button 
              size="small" 
              type="primary" 
              loading={inlineSaving} 
              onClick={handleInlineSave}
              icon={<SaveOutlined />}
            >
              Simpan
            </Button>
            <Button 
              size="small" 
              onClick={cancelInlineEdit}
              icon={<CloseOutlined />}
            >
              Batal
            </Button>
          </Space>
        ) : (
          <Space size="small">
            <Button 
              type="primary"
              ghost
              size="small" 
              onClick={() => openInlineEdit(r)}
              icon={<EditOutlined />}
            >
            </Button>
            <Popconfirm 
              title="Hapus Kategori"
              description="Apakah Anda yakin ingin menghapus kategori ini?"
              onConfirm={() => handleDelete(r.id)} 
              okText="Ya" 
              cancelText="Tidak"
            >
              <Button 
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
              </Button>
            </Popconfirm>
          </Space>
        )
      )
    }
  ];

  return (
    <Modal 
      title={
        <Space>
          <TagOutlined />
          Manajemen Kategori
        </Space>
      }
      open={open} 
      onCancel={onClose} 
      footer={null} 
      width={800}
    >
      {contextHolder}
      <div style={{ marginBottom: 16 }}>
        {!showCreateForm && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            size="middle"
          >
            Tambah Kategori Baru
          </Button>
        )}
      </div>
      {(showCreateForm || editing) && (
        <div style={{ marginBottom: 16, padding: 16, border: '1px solid #d9d9d9', borderRadius: 6 }}>
          <Title level={5}>Formulir Kategori</Title>
          <Form form={form} layout="vertical" onFinish={handleSave} autoComplete="off">
            <Form.Item 
              label="Nama Kategori" 
              name="name" 
              rules={[
                { required: true, message: 'Nama kategori wajib diisi' },
                { max: 100, message: 'Nama kategori maksimal 100 karakter' },
                { whitespace: true, message: 'Nama kategori tidak boleh kosong' }
              ]}
            >
              <Input 
                placeholder="Masukkan nama kategori"
                prefix={<TagOutlined />}
                size="middle"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  onClick={() => form.submit()}
                  icon={<SaveOutlined />}
                  size="middle"
                >
                  Simpan Kategori
                </Button>
                <Button 
                  onClick={() => { 
                    form.resetFields(); 
                    setEditing(null); 
                    setShowCreateForm(false); 
                  }}
                  icon={<CloseOutlined />}
                  size="middle"
                >
                  Batal
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}
      <Table 
        dataSource={categories} 
        columns={columns} 
        rowKey="id" 
        loading={loading} 
        pagination={{
          // use defaultPageSize so the table isn't fully controlled and the size chooser works
          defaultPageSize: 10,
          pageSizeOptions: ['10','20','50','100'],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} dari ${total} kategori`,
        }}
        scroll={{ x: 600 }}
      />
    </Modal>
  );
}
