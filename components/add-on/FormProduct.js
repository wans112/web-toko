"use client";
import React, { useEffect, useState } from "react";
import { Modal, Form, Input, InputNumber, Button, Image, Card, Upload, Select, Space } from "antd";
import { DeleteOutlined, AppstoreAddOutlined } from "@ant-design/icons";

/**
 * ProductForm
 * props:
 * - open: boolean
 * - onClose: () => void
 * - onSave: () => Promise<void>   // dipanggil saat user klik Simpan (parent melakukan validate & submit)
 * - form: antd form instance (passed from parent)
 * - editing: produk yang diedit atau null
 * - fileData: base64 string (preview)
 * - onFileChange: (e) => void
 */
export default function ProductForm({ open, onClose, onSave, form, editing, fileData, onFileChange }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (!mounted) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed loading categories', e);
      }
    }
    load();
  // listen for external updates to categories (so Select can refresh without page reload)
  function onUpdated() { load(); }
  if (typeof window !== 'undefined') window.addEventListener('categories:updated', onUpdated);
  return () => { mounted = false; if (typeof window !== 'undefined') window.removeEventListener('categories:updated', onUpdated); };
  }, []);

  useEffect(() => {
    // when editing and categories loaded, try to set category field to matching id
    if (editing && categories.length > 0) {
      const found = categories.find((c) => String(c.id) === String(editing.category) || c.name === editing.category);
      if (found) form.setFieldsValue({ category: found.id });
      else form.setFieldsValue({ category: editing.category || undefined });
    }
  }, [editing, categories]);
  return (
    <Modal
      title={
        <Space>
          <AppstoreAddOutlined />
          {editing ? "Edit Produk" : "Tambah Produk"}
        </Space>
      }
      open={open}
      onOk={onSave}
      onCancel={() => {
        onClose();
        form.resetFields();
      }}
      okText="Simpan"
      cancelText="Batal"
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Gambar">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                // kirim file ke parent sebagai event agar handler yang ada (fileToBase64) dipakai
                if (typeof onFileChange === "function") {
                  onFileChange({ target: { files: [file] } });
                }
                // kembalikan false agar Antd tidak melakukan upload otomatis
                return false;
              }}
            >
              <Button>Click to Upload</Button>
            </Upload>
          {fileData && (
            <div className="mt-2">
              <img src={`data:image;base64,${fileData}`} alt="preview" className="max-h-36 object-contain border" />
            </div>
          )}
          {!fileData && editing?.image_path && (
            <div className="mt-2">
              <Image src={`/api/product?filename=${editing.image_path}`} alt="preview" width={120} />
            </div>
          )}
        </Form.Item>

        <Form.Item name="name" label="Nama" rules={[{ required: true, message: "Nama diperlukan" }]}>
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea
            rows={5}
            onKeyDown={(e) => {
              // Prevent Enter from bubbling to the Modal/Form which may trigger submit.
              // Allow Shift+Enter (or default) to insert newline; stopPropagation so Enter is saved as newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.stopPropagation();
              }
            }}
          />
        </Form.Item>

        <Form.Item name="category" label="Kategori">
          <Select placeholder="Pilih kategori" allowClear>
            {categories.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.List name="units">
          {(fields, { add, remove }) => (
            <>
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium">Units</label>
                <Button type="link" onClick={() => add({ unit_name: "pcs", qty_per_unit: 1, price: 0, stock: 0 })}>
                  + Tambah unit
                </Button>
              </div>

              {fields.map(({ key, name, ...restField }, index) => (
                <Card key={key} size="small" className="mb-3" title={`Unit ${index + 1}`}>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="">
                      <Form.Item
                        {...restField}
                        name={[name, "unit_name"]}
                        label="Nama Unit"
                        rules={[{ required: true, message: "Nama varian diperlukan" }]}
                      >
                        <Input placeholder="contoh: pcs, paket, karton" />
                      </Form.Item>
                    </div>

                    <div className="">
                      <Form.Item
                        {...restField}
                        name={[name, "qty_per_unit"]}
                        label="Isi"
                        rules={[{ required: true, message: "Isi diperlukan" }]}
                      >
                        <InputNumber 
                          min={1} 
                          className="w-full"
                          formatter={(value) => {
                            if (value === undefined || value === null) return "";
                            const str = String(value);
                            const parts = str.split(",");
                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                            return parts.join(",");
                          }}
                          parser={(value) => {
                            if (!value) return "";
                            return String(value).replace(/\./g, "");
                          }}
                        />
                      </Form.Item>
                    </div>

                    <div className="">
                      <Form.Item
                        {...restField}
                        name={[name, "price"]}
                        label="Harga"
                        rules={[{ required: true, message: "Harga varian diperlukan" }]}
                      >
                        <InputNumber
                          className="w-full"
                          min={0}
                          formatter={(value) => {
                            if (value === undefined || value === null) return "";
                            const str = String(value);
                            const parts = str.split(",");
                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                            return parts.join(",");
                          }}
                          parser={(value) => {
                            if (!value) return "";
                            return String(value).replace(/\./g, "");
                          }}
                        />
                      </Form.Item>
                    </div>

                    <div className="">
                      <Form.Item
                        {...restField}
                        name={[name, "stock"]}
                        label="Stok"
                        rules={[{ required: true, message: "Stok diperlukan" }]}
                      >
                        <InputNumber 
                          min={0} 
                          className="w-full"
                          formatter={(value) => {
                            if (value === undefined || value === null) return "";
                            const str = String(value);
                            const parts = str.split(",");
                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                            return parts.join(",");
                          }}
                          parser={(value) => {
                            if (!value) return "";
                            return String(value).replace(/\./g, "");
                          }}
                        />
                      </Form.Item>
                    </div>

                    <div className="flex items-center">
                      <Button 
                        icon={<DeleteOutlined />} 
                        onClick={() => remove(name)} 
                        danger
                      >
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}