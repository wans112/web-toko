import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, InputNumber, message, Select, Popconfirm, Space, DatePicker, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined } from '@ant-design/icons';
import dayjs from "dayjs";

export default function ManagementDiscountNominal() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [form] = Form.useForm();
	const [products, setProducts] = useState([]);
	const [units, setUnits] = useState([]);
	const [deleteLoading, setDeleteLoading] = useState(false);
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

	// Helper functions
	const formatPrice = (price) => `Rp ${Number(price || 0).toLocaleString('id-ID')}`;
	
	const renderPriceInfo = (price, afterDisc, showDiscount) => {
		if (price == null) return null;
		
		if (showDiscount) {
			return (
				<span className="ml-2 text-xs text-gray-500">
					<span style={{ textDecoration: 'line-through', marginRight: 4 }}>{formatPrice(price)}</span>
					<span className="font-bold text-green-600">{formatPrice(afterDisc)}</span>
				</span>
			);
		}
		
		return <span className="ml-2 text-xs text-gray-500">{formatPrice(price)}</span>;
		};

		const columns = [
			{ 
				title: "Tipe", 
				dataIndex: "type", 
				key: "type", 
				width: 80,
				sorter: (a, b) => a.type.localeCompare(b.type),
				render: (val) => val === 'unit' ? 'Unit' : 'Produk' 
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
				const showDiscount = typeof record.value === 'number' && record.value > 0;
			
				if (record.type === 'product' && Array.isArray(record.products)) {
					return record.products.map(p => {
						// Show all units for product type discount
						if (Array.isArray(p.units) && p.units.length > 0) {
							return (
								<div key={p.id} className="mb-2">
									<div className="font-medium text-green-600">{p.name}</div>
									{p.units.map(unit => {
										const price = unit.price;
										const afterDisc = showDiscount && price != null ? price - record.value : price;
										return (
											<div key={unit.id} className="ml-4 text-sm">
												{unit.unit_name}
												{renderPriceInfo(price, afterDisc, showDiscount)}
											</div>
										);
									})}
								</div>
							);
						} else {
							// Fallback if no units
							return (
								<div key={p.id}>
									{p.name}
									<span className="ml-2 text-xs text-gray-500">No units</span>
								</div>
							);
						}
					});
				}
			
				if (record.type === 'unit' && Array.isArray(record.units)) {
					// Group units by product for hierarchical display
					const unitsByProduct = {};
					record.units.forEach(u => {
						if (!unitsByProduct[u.product_id]) {
							unitsByProduct[u.product_id] = {
								product_name: u.product_name,
								units: []
							};
						}
						unitsByProduct[u.product_id].units.push(u);
					});
				
					return Object.values(unitsByProduct).map(productGroup => (
						<div key={productGroup.product_name} className="mb-2">
							<div className="font-medium text-green-600">{productGroup.product_name}</div>
							{productGroup.units.map(u => {
								const price = u.price;
								const afterDisc = showDiscount && price != null ? price - record.value : price;
							
								return (
									<div key={u.id} className="ml-4 text-sm">
										{u.unit_name}
										{renderPriceInfo(price, afterDisc, showDiscount)}
									</div>
								);
							})}
						</div>
					));
				}
			
				// fallback lama
				if (record.type === 'unit') {
					return Array.isArray(record.names) ? record.names.map(n => <div key={n}>{n}</div>) : record.names;
				}
				return Array.isArray(record.names) ? record.names.join(", ") : record.names;
			} },
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
					<Tag color={val ? "green" : "red"}>
						{val ? "Aktif" : "Tidak Aktif"}
					</Tag>
				)
			},
			{ 
				title: "Nominal (Rp)", 
				dataIndex: "value", 
				key: "value", 
				width: 120,
				sorter: (a, b) => a.value - b.value,
				render: (val) => `Rp${val.toLocaleString()}` 
			},
			{
				title: "Aksi",
				key: "aksi",
				width: 150,
				align: "center",
				render: (_, record) => (
					<Space size="small">
						<Button 
							size="small" 
							className="w-full sm:w-auto" 
							onClick={() => handleEdit(record)}
						>
							<EditOutlined />
						</Button>
						<Popconfirm
							title={`Hapus diskon "${record.name}"?`}
							okText="Hapus"
							cancelText="Batal"
							onConfirm={() => handleDelete(record)}
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
				),
			},
		];

	const fetchProductsAndUnits = async () => {
		try {
			const res = await fetch("/api/product/");
			const json = await res.json();
			if (Array.isArray(json)) {
				// Set products for dropdown
				setProducts(json.map((p) => ({ value: p.id, label: p.name })));
				
				// Build units array from all products
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
			console.error('Error fetching products and units:', error);
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
			
			// Build product and unit maps
			const productMap = {};
			const unitMap = {};
			if (Array.isArray(productJson)) {
				productJson.forEach(p => {
					productMap[p.id] = p;
					if (Array.isArray(p.units)) {
						p.units.forEach(u => {
							unitMap[u.id] = { ...u, product_id: p.id, product_name: p.name };
						});
					}
				});
			}
			
			if (discountJson.success) {
				// Filter nominal discounts and map products/units with prices
				const dataDiskon = (discountJson.data || [])
					.filter(d => d.value_type === 'nominal')
					.map(diskon => {
						const products = diskon.type === 'product' && Array.isArray(diskon.product_ids)
							? diskon.product_ids.map(pid => productMap[pid]).filter(Boolean)
							: [];
						
						const units = diskon.type === 'unit' && Array.isArray(diskon.unit_ids)
							? diskon.unit_ids.map(uid => unitMap[uid]).filter(Boolean)
							: [];
						
						return { ...diskon, products, units };
					});
				
				setData(dataDiskon);
			} else {
				message.error(discountJson.error || "Gagal mengambil data");
			}
		} catch (err) {
			console.error('Error fetching discount data:', err);
			message.error("Gagal mengambil data");
		}
		setLoading(false);
	};

	useEffect(() => {
		fetchProductsAndUnits();
		fetchData();
	}, []);

	const handleAdd = () => {
		setEditing(null);
		form.resetFields();
		form.setFieldsValue({ type: 'product', value_type: 'nominal' });
		setSelectedProductIds([]);
		setModalOpen(true);
	};

	const handleEdit = (record) => {
		setEditing(record);
		let productIds = [];
		if (record.type === 'unit' && Array.isArray(record.unit_ids) && units.length > 0) {
			productIds = units.filter(u => record.unit_ids.includes(u.value)).map(u => u.product_id);
			productIds = Array.from(new Set(productIds));
		} else if (record.type === 'product') {
			productIds = Array.isArray(record.product_ids) ? record.product_ids : [];
		}
		form.setFieldsValue({
			name: record.name,
			type: record.type || 'product',
			value_type: 'nominal',
			value: record.value,
			product_ids: productIds,
			unit_ids: Array.isArray(record.unit_ids) ? record.unit_ids : [],
			date_range: [
				record.start_at ? dayjs(record.start_at) : null,
				record.end_at ? dayjs(record.end_at) : null
			],
		});
		setSelectedProductIds(productIds);
		setModalOpen(true);
	};

	const handleDelete = async (record) => {
		setDeleteLoading(true);
		try {
			const res = await fetch(`/api/product/discount?id=${record.id}`, { method: "DELETE" });
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
		setDeleteLoading(false);
	};

	const handleModalOk = async () => {
		try {
			const values = await form.validateFields();
			const { date_range, ...restValues } = values;
			const [startDate, endDate] = Array.isArray(date_range) ? date_range : [];
			const payload = {
				name: restValues.name,
				type: restValues.type,
				value_type: 'nominal',
				value: restValues.value,
				...(restValues.type === 'product' ? { product_ids: restValues.product_ids } : { unit_ids: restValues.unit_ids }),
				start_at: startDate ? startDate.toISOString() : null,
				end_at: endDate ? endDate.toISOString() : null
			};
			
			if (editing) {
				payload.id = editing.id;
			}
			
			const res = await fetch("/api/product/discount", {
				method: editing ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
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
			console.error('Error saving discount:', err);
			message.error("Gagal menyimpan");
		}
	};

	return (
		<div className="w-full">
			<div className="mb-4 flex justify-between items-center">
				<h2 className="text-lg font-semibold m-0">Manajemen Diskon Nominal</h2>
				<Button type="primary" onClick={handleAdd}>
					<PlusOutlined /> Tambah Diskon Nominal
				</Button>
			</div>

			<Table
				columns={columns}
				dataSource={data}
				rowKey="id"
				loading={loading}
				pagination={{
					// use defaultPageSize so the table isn't fully controlled and the size chooser works
					defaultPageSize: 10,
					pageSizeOptions: ['10','20','50','100'],
					showSizeChanger: true,
					showQuickJumper: true,
					showTotal: (total, range) => 
							`${range[0]}-${range[1]} of ${total} discounts`
				}}
				scroll={{ x: 800 }}
			/>
			<Modal
			title={
				<Space>
					<PercentageOutlined />
					{editing ? "Edit Diskon Nominal" : "Tambah Diskon Nominal"}
				</Space>
			}
			open={modalOpen}
			onOk={handleModalOk}
			onCancel={() => setModalOpen(false)}
			destroyOnHidden
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
						options={[{ value: 'product', label: 'Produk' }, { value: 'unit', label: 'Unit' }]}
						onChange={val => {
							form.setFieldsValue({ product_ids: [], unit_ids: [] });
							setSelectedProductIds([]);
						}}
					/>
				</Form.Item>
				{modalOpen && form.getFieldValue('type') === 'product' && (
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
				{modalOpen && form.getFieldValue('type') === 'unit' && (
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
								onChange={val => {
									setSelectedProductIds(val);
									// Reset unit_ids when product selection changes
									const currentUnitIds = form.getFieldValue('unit_ids') || [];
									const validUnitIds = currentUnitIds.filter(unitId => {
										const unit = units.find(u => u.value === unitId);
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
								options={units.filter(u => selectedProductIds.includes(u.product_id))}
								showSearch
								optionFilterProp="label"
								placeholder={selectedProductIds.length ? "Pilih unit" : "Pilih produk dulu"}
								mode="multiple"
								disabled={selectedProductIds.length === 0}
							/>
						</Form.Item>
					</>
				)}
				<Form.Item
					label="Nominal (Rp)"
					name="value"
					rules={[{ required: true, type: "number", min: 1, message: "Nominal minimal 1" }]}
				>
					<InputNumber 
						min={1} 
						style={{ width: "100%" }}
						formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
						parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
						placeholder="Masukkan nominal diskon"
					/>
				</Form.Item>
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
