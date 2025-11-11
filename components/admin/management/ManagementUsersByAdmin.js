"use client";

import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Space, Popconfirm, notification } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined } from "@ant-design/icons";

export default function ManagementUsersByAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
  // only manage users with role === 'user'
  setUsers(Array.isArray(data) ? data.filter((u) => u.role === 'user') : []);
    } catch (err) {
      console.error(err);
      api.error({ message: 'Gagal mengambil users' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
  form.resetFields();
  form.setFieldsValue({ role: 'user' });
    setModalOpen(true);
  }

  function openEdit(record) {
    // fetch full user (including password) then open modal with values
    (async () => {
      try {
        const res = await fetch(`/api/users?id=${record.id}`);
        const data = await res.json();
  setEditing(data);
  form.setFieldsValue({ ...data, password: data.password || '', role: 'user' });
        setModalOpen(true);
      } catch (err) {
        console.error(err);
        api.error({ message: 'Gagal memuat data user' });
      }
    })();
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        api.success({ message: 'User dihapus' });
        fetchUsers();
      } else {
        const body = await res.json().catch(() => ({}));
        api.error({ message: body.error || 'Gagal menghapus user' });
      }
    } catch (err) {
      console.error(err);
      api.error({ message: 'Gagal menghapus user' });
    }
  }

  async function handleSubmit(values) {
    try {
      if (editing) {
  // ensure role remains 'user'
  const payload = { id: editing.id, ...values, role: 'user' };
        const res = await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal memperbarui user');
        }
        api.success({ message: 'User diperbarui' });
      } else {
        // force role to 'user' for created accounts in this admin view
        const createPayload = { ...values, role: 'user' };
        const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
        if (res.status !== 201) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Gagal membuat user');
        }
        api.success({ message: 'User dibuat' });
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      api.error({ message: String(err.message || err) });
    }
  }

  const columns = [
    { 
      title: 'Nama', 
      dataIndex: 'name', 
      key: 'name',
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
    },
    { 
      title: 'Username', 
      dataIndex: 'username', 
      key: 'username',
      sorter: (a, b) => a.username.localeCompare(b.username)
    },
    { 
      title: 'Role', 
      dataIndex: 'role', 
      key: 'role',
      width: 80,
      sorter: (a, b) => a.role.localeCompare(b.role)
    },
    { 
      title: 'No. HP', 
      dataIndex: 'no_hp', 
      key: 'no_hp',
      render: (text) => text || (
        <span style={{ color: '#999', fontStyle: 'italic' }}>-</span>
      )
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
            onClick={() => openEdit(record)}
            icon={<EditOutlined />}
          />
          <Popconfirm 
            title="Hapus user ini?" 
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
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold m-0">Manajemen Users</h2>
        <Button type="primary" onClick={openCreate} icon={<PlusOutlined />}>Buat User</Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={users} 
        loading={loading} 
        rowKey="id" 
        pagination={{
          // use defaultPageSize so the table isn't fully controlled and the size chooser works
          defaultPageSize: 10,
          pageSizeOptions: ['10','20','50','100'],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} users`
        }}
        scroll={{ x: 800 }}
      />

      <Modal 
        title={
          <Space>
            <UserAddOutlined />
            {editing ? 'Edit User' : 'Buat User'}
          </Space>
        } 
        open={modalOpen} 
        onCancel={() => setModalOpen(false)} 
        onOk={() => form.submit()} 
        okText={editing ? 'Simpan' : 'Buat'}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: 'user' }}>
          <Form.Item label="Nama" name="name">
            <Input />
          </Form.Item>

          <Form.Item label="Username" name="username" rules={[{ required: true, message: 'Username wajib diisi' }]}>
            <Input />
          </Form.Item>

          <Form.Item label="Password" name="password" rules={[{ required: (editing ? false : true), message: 'Password wajib diisi' }]}>
            <Input.Password />
          </Form.Item>

          {/* Role is fixed to 'user' in this admin view */}
          <Form.Item name="role" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="No. HP" name="no_hp">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
