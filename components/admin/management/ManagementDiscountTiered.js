import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Popconfirm,
  Space,
  DatePicker,
  Tag,
  Divider
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  OrderedListOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const VALUE_TYPE_OPTIONS = [
  { value: "percentage", label: "Persentase" },
  { value: "nominal", label: "Nominal (Rp)" }
];

export default function ManagementDiscountTiered() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const { RangePicker } = DatePicker;

  const formatDateTime = (value) => {
    if (!value) return null;
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("DD MMM YYYY HH:mm") : value;
  };

  const renderSchedule = (start, end) => {
    const startText = formatDateTime(start);
    const endText = formatDateTime(end);
    if (startText && endText) return `${startText} - ${endText}`;
    if (startText) return `Mulai ${startText}`;
    if (endText) return `Hingga ${endText}`;
    return "Tidak dijadwalkan";
  };

  const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString("id-ID")}`;

  const formatNumberInput = (value) => {
    if (value === undefined || value === null || value === "") return "";
    return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseNumberInput = (value) => {
    if (!value) return "";
    return value.replace(/\$\s?|,(?=\d{3})/g, "");
  };

  const describeQuantityRange = (min, max) => {
    if (min == null && max == null) return null;
    if (min != null && max != null) {
      if (min === max) return `Qty ${min}`;
      return `Qty ${min}-${max}`;
    }
    if (min != null) return `Min qty ${min}`;
    return `Max qty ${max}`;
  };

  const describeAmountRange = (min, max) => {
    if (min == null && max == null) return null;
    if (min != null && max != null) {
      if (min === max) return `Nominal ${formatPrice(min)}`;
      return `Nominal ${formatPrice(min)}-${formatPrice(max)}`;
    }
    if (min != null) return `Min nominal ${formatPrice(min)}`;
    return `Max nominal ${formatPrice(max)}`;
  };

  const renderTiers = (tiers) => {
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return <span className="text-xs text-gray-500">Tidak ada tingkat</span>;
    }

    return (
      <div className="flex flex-col gap-2">
        {tiers.map((tier, idx) => {
          const quantityRange = describeQuantityRange(tier.min_quantity, tier.max_quantity);
          const amountRange = describeAmountRange(tier.min_amount, tier.max_amount);
          const conditions = [quantityRange, amountRange].filter(Boolean).join(" • ");
          const valueText =
            tier.value_type === "percentage"
              ? `${tier.value}%`
              : formatPrice(tier.value);

          return (
            <div
              key={tier.id || `${idx}-${tier.label || "tier"}`}
              className="border border-gray-200 rounded px-3 py-2 bg-gray-50"
            >
              <div className="text-sm font-medium">
                {tier.label || `Tingkat ${idx + 1}`}
              </div>
              <div className="text-xs text-gray-600">
                {conditions || "Tanpa syarat khusus"}
              </div>
              <div className="text-xs font-semibold text-green-600">
                Diskon: {valueText}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const columns = [
    {
      title: "Tipe",
      dataIndex: "type",
      key: "type",
      width: 80,
      sorter: (a, b) => a.type.localeCompare(b.type),
      render: (val) => (val === "unit" ? "Unit" : "Produk")
    },
    {
      title: "Nama Diskon",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: "Item",
      dataIndex: "names",
      key: "names",
      render: (_, record) => {
        if (record.type === "product" && Array.isArray(record.products)) {
          return record.products.map((p) => (
            <div key={p?.id || p?.name} className="mb-1 text-sm">
              {p?.name || "-"}
            </div>
          ));
        }

        if (record.type === "unit" && Array.isArray(record.units)) {
          const unitsByProduct = {};
          record.units.forEach((u) => {
            if (!unitsByProduct[u.product_id]) {
              unitsByProduct[u.product_id] = {
                product_name: u.product_name,
                units: []
              };
            }
            unitsByProduct[u.product_id].units.push(u);
          });

          return Object.values(unitsByProduct).map((group) => (
            <div key={group.product_name} className="mb-2">
              <div className="font-medium text-green-600 text-sm">{group.product_name}</div>
              {group.units.map((u) => (
                <div key={u.id} className="ml-3 text-xs text-gray-600">
                  {u.unit_name}
                </div>
              ))}
            </div>
          ));
        }

        if (Array.isArray(record.names)) {
          return record.names.map((name) => (
            <div key={name} className="text-sm">
              {name}
            </div>
          ));
        }

        return record.names;
      }
    },
    {
      title: "Tingkatan",
      dataIndex: "tiers",
      key: "tiers",
      width: 320,
      render: (tiers) => renderTiers(tiers)
    },
    {
      title: "Periode",
      dataIndex: "start_at",
      key: "periode",
      width: 220,
      render: (_, record) => renderSchedule(record.start_at, record.end_at)
    },
    {
      title: "Status Saat Ini",
      dataIndex: "is_active_now",
      key: "status_now",
      width: 140,
      render: (val) => (
        <Tag color={val ? "green" : "red"}>{val ? "Aktif" : "Tidak Aktif"}</Tag>
      )
    },
    {
      title: "Aksi",
      key: "aksi",
      width: 150,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Button size="small" className="w-full sm:w-auto" onClick={() => handleEdit(record)}>
            <EditOutlined />
          </Button>
          <Popconfirm
            title={`Hapus diskon "${record.name}"?`}
            okText="Hapus"
            cancelText="Batal"
            onConfirm={() => handleDelete(record)}
          >
            <Button danger size="small" className="w-full sm:w-auto">
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const fetchProductsAndUnits = async () => {
    try {
      const res = await fetch("/api/product/");
      const json = await res.json();
      if (Array.isArray(json)) {
        setProducts(json.map((p) => ({ value: p.id, label: p.name })));
        const unitsArr = [];
        json.forEach((p) => {
          if (Array.isArray(p.units)) {
            p.units.forEach((u) => {
              unitsArr.push({
                value: u.id,
                label: `${p.name} - ${u.unit_name}`,
                product_id: p.id,
                product_name: p.name
              });
            });
          }
        });
        setUnits(unitsArr);
      }
    } catch (error) {
      console.error("Error fetching products and units:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [discountRes, productRes] = await Promise.all([
        fetch("/api/product/discount"),
        fetch("/api/product/")
      ]);

      const [discountJson, productJson] = await Promise.all([
        discountRes.json(),
        productRes.json()
      ]);

      const productMap = {};
      const unitMap = {};
      if (Array.isArray(productJson)) {
        productJson.forEach((p) => {
          productMap[p.id] = p;
          if (Array.isArray(p.units)) {
            p.units.forEach((u) => {
              unitMap[u.id] = { ...u, product_id: p.id, product_name: p.name };
            });
          }
        });
      }

      if (discountJson.success) {
        const dataDiskon = (discountJson.data || [])
          .filter((d) => d.value_type === "tiered")
          .map((diskon) => {
            const productsData =
              diskon.type === "product" && Array.isArray(diskon.product_ids)
                ? diskon.product_ids.map((pid) => productMap[pid]).filter(Boolean)
                : [];

            const unitsData =
              diskon.type === "unit" && Array.isArray(diskon.unit_ids)
                ? diskon.unit_ids.map((uid) => unitMap[uid]).filter(Boolean)
                : [];

            return {
              ...diskon,
              products: productsData,
              units: unitsData
            };
          });

        setData(dataDiskon);
      } else {
        message.error(discountJson.error || "Gagal mengambil data");
      }
    } catch (err) {
      console.error("Error fetching discount data:", err);
      message.error("Gagal mengambil data");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProductsAndUnits();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureDefaultTier = () => {
    const tiers = form.getFieldValue("tiers");
    if (!tiers || tiers.length === 0) {
      form.setFieldsValue({
        tiers: [
          {
            label: "",
            min_quantity: null,
            max_quantity: null,
            min_amount: null,
            max_amount: null,
            value_type: "percentage",
            value: 5
          }
        ]
      });
    }
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      type: "product",
      date_range: [null, null]
    });
    setSelectedProductIds([]);
    setModalOpen(true);
    setTimeout(() => ensureDefaultTier(), 0);
  };

  const handleEdit = (record) => {
    setEditing(record);
    let productIds = [];
    if (record.type === "unit" && Array.isArray(record.unit_ids) && units.length > 0) {
      productIds = units
        .filter((u) => record.unit_ids.includes(u.value))
        .map((u) => u.product_id);
      productIds = Array.from(new Set(productIds));
    } else if (record.type === "product") {
      productIds = Array.isArray(record.product_ids) ? record.product_ids : [];
    }

    const tiersForForm = Array.isArray(record.tiers)
      ? record.tiers.map((tier) => ({
          label: tier.label || "",
          min_quantity: tier.min_quantity ?? null,
          max_quantity: tier.max_quantity ?? null,
          min_amount: tier.min_amount ?? null,
          max_amount: tier.max_amount ?? null,
          value_type: tier.value_type || "percentage",
          value: tier.value
        }))
      : [];

    form.setFieldsValue({
      name: record.name,
      type: record.type || "product",
      product_ids: record.type === "product" ? productIds : [],
      unit_ids: record.type === "unit" ? record.unit_ids || [] : [],
      date_range: [
        record.start_at ? dayjs(record.start_at) : null,
        record.end_at ? dayjs(record.end_at) : null
      ],
      tiers: tiersForForm.length ? tiersForForm : undefined
    });
    setSelectedProductIds(productIds);
    setModalOpen(true);
    setTimeout(() => ensureDefaultTier(), 0);
  };

  const handleDelete = async (record) => {
    try {
      const res = await fetch(`/api/product/discount?id=${record.id}`, {
        method: "DELETE"
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        message.success("Diskon dihapus");
        fetchData();
      } else {
        message.error(json.error || `Gagal menghapus (status ${res.status})`);
      }
    } catch (err) {
      message.error("Gagal menghapus");
    }
  };

  const toNumericOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const normalizeTierPayload = (tiers = []) =>
    tiers.map((tier, index) => ({
      label: tier.label?.trim() ? tier.label.trim() : null,
      min_quantity: toNumericOrNull(tier.min_quantity),
      max_quantity: toNumericOrNull(tier.max_quantity),
      min_amount: toNumericOrNull(tier.min_amount),
      max_amount: toNumericOrNull(tier.max_amount),
      value_type: tier.value_type,
      value: Number(tier.value ?? 0),
      priority: index
    }));

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const { date_range, tiers, ...restValues } = values;
      const [startDate, endDate] = Array.isArray(date_range) ? date_range : [];
      const payload = {
        name: restValues.name,
        type: restValues.type,
        value_type: "tiered",
        ...(restValues.type === "product"
          ? { product_ids: restValues.product_ids }
          : { unit_ids: restValues.unit_ids }),
        start_at: startDate ? startDate.toISOString() : null,
        end_at: endDate ? endDate.toISOString() : null,
        tiers: normalizeTierPayload(tiers)
      };

      if (editing) {
        payload.id = editing.id;
      }

      const res = await fetch("/api/product/discount", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        message.success(editing ? "Diskon diupdate" : "Diskon ditambah");
        setModalOpen(false);
        fetchData();
      } else {
        message.error(json.error || (editing ? "Gagal update" : "Gagal tambah"));
      }
    } catch (err) {
      if (err?.errorFields) {
        return;
      }
      console.error("Error saving discount:", err);
      message.error("Gagal menyimpan");
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold m-0">Manajemen Diskon Tingkatan</h2>
        <Button type="primary" onClick={handleAdd}>
          <PlusOutlined /> Tambah Diskon Tingkatan
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 10,
          pageSizeOptions: ["10", "20", "50", "100"],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} diskon`
        }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={
          <Space>
            <OrderedListOutlined />
            {editing ? "Edit Diskon Tingkatan" : "Tambah Diskon Tingkatan"}
          </Space>
        }
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Nama Diskon"
            name="name"
            rules={[{ required: true, message: "Nama diskon wajib diisi" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Tipe Diskon"
            name="type"
            rules={[{ required: true, message: "Tipe diskon wajib dipilih" }]}
          >
            <Select
              options={[
                { value: "product", label: "Produk" },
                { value: "unit", label: "Unit" }
              ]}
              onChange={(val) => {
                form.setFieldsValue({ product_ids: [], unit_ids: [] });
                setSelectedProductIds([]);
              }}
            />
          </Form.Item>

          {modalOpen && form.getFieldValue("type") === "product" && (
            <Form.Item
              label="Produk"
              name="product_ids"
              rules={[{ required: true, message: "Pilih produk" }]}
            >
              <Select
                options={products}
                showSearch
                optionFilterProp="label"
                placeholder="Pilih produk"
                mode="multiple"
              />
            </Form.Item>
          )}

          {modalOpen && form.getFieldValue("type") === "unit" && (
            <>
              <Form.Item
                label="Produk"
                name="product_ids"
                rules={[{ required: true, message: "Pilih produk" }]}
              >
                <Select
                  options={products}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Pilih produk untuk filter unit"
                  mode="multiple"
                  onChange={(val) => {
                    setSelectedProductIds(val);
                    const currentUnitIds = form.getFieldValue("unit_ids") || [];
                    const validUnitIds = currentUnitIds.filter((unitId) => {
                      const unit = units.find((u) => u.value === unitId);
                      return unit && val.includes(unit.product_id);
                    });
                    form.setFieldsValue({ unit_ids: validUnitIds });
                  }}
                />
              </Form.Item>
              <Form.Item
                label="Unit"
                name="unit_ids"
                rules={[{ required: true, message: "Pilih unit" }]}
              >
                <Select
                  options={units.filter((u) => selectedProductIds.includes(u.product_id))}
                  showSearch
                  optionFilterProp="label"
                  placeholder={
                    selectedProductIds.length ? "Pilih unit" : "Pilih produk dulu"
                  }
                  mode="multiple"
                  disabled={selectedProductIds.length === 0}
                />
              </Form.Item>
            </>
          )}

          <Divider>Tingkatan Diskon</Divider>

          <Form.List
            name="tiers"
            rules={[
              {
                validator: async (_, tiers) => {
                  if (!tiers || tiers.length === 0) {
                    throw new Error("Minimal satu tingkat diskon");
                  }
                }
              }
            ]}
          >
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-3">
                {fields.map(({ key, name, ...restField }, index) => (
                  <div key={key} className="border border-gray-200 rounded-md p-3">
                    <Space className="w-full justify-between">
                      <span className="font-semibold text-sm">Tingkat #{index + 1}</span>
                      {fields.length > 1 && (
                        <Button
                          danger
                          type="text"
                          size="small"
                          onClick={() => remove(name)}
                          icon={<DeleteOutlined />}
                        />
                      )}
                    </Space>

                    <Form.Item
                      {...restField}
                      name={[name, "label"]}
                      label="Label (opsional)"
                    >
                      <Input placeholder="Contoh: Bronze" />
                    </Form.Item>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Form.Item
                        {...restField}
                        name={[name, "min_quantity"]}
                        label="Jumlah Unit Minimum"
                      >
                        <InputNumber min={0} style={{ width: "100%" }} placeholder="Contoh: 5" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "max_quantity"]}
                        label="Jumlah Unit Maksimum"
                      >
                        <InputNumber min={0} style={{ width: "100%" }} placeholder="Contoh: 10" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "min_amount"]}
                        label="Nominal Minimum (Rp)"
                      >
                        <InputNumber
                          min={0}
                          style={{ width: "100%" }}
                          formatter={formatNumberInput}
                          parser={parseNumberInput}
                          placeholder="Contoh: 100000"
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "max_amount"]}
                        label="Nominal Maksimum (Rp)"
                      >
                        <InputNumber
                          min={0}
                          style={{ width: "100%" }}
                          formatter={formatNumberInput}
                          parser={parseNumberInput}
                          placeholder="Contoh: 500000"
                        />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Form.Item
                        {...restField}
                        name={[name, "value_type"]}
                        label="Tipe Nilai"
                        rules={[{ required: true, message: "Pilih tipe nilai" }]}
                      >
                        <Select options={VALUE_TYPE_OPTIONS} />
                      </Form.Item>

                      <Form.Item
                        shouldUpdate={(prev, next) =>
                          prev?.tiers?.[name]?.value_type !== next?.tiers?.[name]?.value_type
                        }
                        noStyle
                      >
                        {({ getFieldValue }) => {
                          const currentValueType =
                            getFieldValue(["tiers", name, "value_type"]) || "percentage";
                          return (
                            <Form.Item
                              {...restField}
                              name={[name, "value"]}
                              label="Nilai Diskon"
                              rules={[{ required: true, message: "Nilai diskon wajib diisi" }]}
                            >
                              <InputNumber
                                min={currentValueType === "percentage" ? 0 : 1}
                                max={currentValueType === "percentage" ? 100 : undefined}
                                style={{ width: "100%" }}
                                formatter={formatNumberInput}
                                parser={parseNumberInput}
                                placeholder={
                                  currentValueType === "percentage"
                                    ? "Contoh: 15"
                                    : "Contoh: 25000"
                                }
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </div>
                  </div>
                ))}

                <Button
                  type="dashed"
                  onClick={() =>
                    add({
                      label: "",
                      min_quantity: null,
                      max_quantity: null,
                      min_amount: null,
                      max_amount: null,
                      value_type: "percentage",
                      value: 5
                    })
                  }
                  block
                  icon={<PlusOutlined />}
                >
                  Tambah Tingkat
                </Button>
              </div>
            )}
          </Form.List>

          <Form.Item label="Periode Diskon" name="date_range">
            <RangePicker
              showTime
              allowEmpty={[true, true]}
              style={{ width: "100%" }}
              format="YYYY-MM-DD HH:mm"
              placeholder={["Mulai", "Berakhir"]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
