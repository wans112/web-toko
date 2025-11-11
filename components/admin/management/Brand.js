"use client";

import React, { useEffect, useState } from "react";
import { Form, Input, Upload, Avatar, Button, notification } from "antd";
import { SaveOutlined, UploadOutlined } from "@ant-design/icons";

export default function ManagementBrand() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [api, contextHolder] = notification.useNotification();
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    fetchBrands();
  }, []);

  async function fetchBrands() {
    setLoading(true);
    try {
      const res = await fetch("/api/brand");
      const data = await res.json();
      setBrands(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        // select first brand by default
        const first = data[0];
        setEditing(first);
        form.setFieldsValue({ name: first.name });
  setAvatarPreview(first.logo ? `/api/brand/logo?filename=${first.logo}&t=${Date.now()}` : null);
        setAvatarFile(null);
      }
    } catch (err) {
      console.error(err);
      api.error({
        message: "Gagal memuat brand",
        description: err?.message || "Terjadi kesalahan saat memuat brand",
      });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(brand) {
  setEditing(brand);
  form.setFieldsValue({ name: brand.name });
  setAvatarPreview(brand.logo ? `/api/brand/logo?filename=${brand.logo}&t=${Date.now()}` : null);
  setAvatarFile(null);
  }

  function normalizeFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSave() {
    try {
      setLoading(true);
      // show a persistent "saving" notification and replace it later
      api.info({
        message: "Menyimpan perubahan",
        description: "Sedang menyimpan perubahan brand...",
        key: "brand-saving",
        duration: 0,
      });

      if (!editing || !editing.id) {
        api.error({
          message: "Tidak ada brand yang dipilih",
          description: "Pilih brand terlebih dahulu atau tunggu pemuatan.",
          key: "brand-saving",
        });
        return;
      }
      const values = await form.validateFields();
      const payload = { id: editing.id, name: values.name };

      if (avatarFile) {
        const b64 = await normalizeFileToBase64(avatarFile);
        payload.logo_base64 = b64;
      }

      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // replace the saving notification with success
      api.success({
        message: "Brand diperbarui",
        description: "Perubahan berhasil disimpan, refresh untuk melihat perubahan.",
        key: "brand-saving",
        duration: 3,
      });
      // update local state & form with returned brand data so the name input stays filled
      const updated = data.data || data;
      if (updated) {
        setEditing(updated);
        form.setFieldsValue({ name: updated.name });
  setAvatarPreview(updated.logo ? `/api/brand/logo?filename=${updated.logo}&t=${Date.now()}` : avatarPreview);
        setAvatarFile(null);
      }
      // broadcast updated brand so other parts of the app can refresh without a full reload
      try {
        if (typeof window !== 'undefined' && updated) {
          window.dispatchEvent(new CustomEvent('brandUpdated', { detail: updated }));
        }
      } catch (e) {
        // noop
      }
      // refresh list in background
      fetchBrands();
    } catch (err) {
      console.error(err);
      // replace saving notification with error
      api.error({
        message: "Gagal menyimpan",
        description: err?.message || "Terjadi kesalahan saat menyimpan",
        key: "brand-saving",
      });
    }
    finally {
      setLoading(false);
    }
  }

  return (
    <div>
  {contextHolder}
      <div className="mb-6 flex justify-center mt-2">
        <Form form={form} layout="vertical" onFinish={handleSave} className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3">
            <Avatar size={120} src={avatarPreview} className="mb-4" />

            <Form.Item className="w-full text-center">
              <div className="flex flex-col items-center gap-3">
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setAvatarPreview(e.target.result);
                      setAvatarFile(file);
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Pilih Logo</Button>
                </Upload>
              </div>
            </Form.Item>

            <Form.Item label="Nama" name="name" rules={[{ required: true, message: 'Nama wajib diisi' }]} className="w-full text-center">
              <Input />
            </Form.Item>

            <div className="flex justify-end mt-4 w-full">
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" disabled={!editing || loading}>Simpan Perubahan</Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
