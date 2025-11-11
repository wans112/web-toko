"use client";

import React, { useEffect, useState } from "react";
import { Form, Input, Button, Upload, Avatar, notification, Spin, Typography } from "antd";
import { UserOutlined, LogoutOutlined, UploadOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { getCurrentUserClient } from "@/lib/auth";

const { Title } = Typography;

export default function Profile() {
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(true);
	const [profile, setProfile] = useState(null);
	const [avatarPreview, setAvatarPreview] = useState(null);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [api, contextHolder] = notification.useNotification();
	const router = useRouter();

	// Get current user from JWT token
	const [currentUser, setCurrentUser] = useState(null);

	useEffect(() => {
		// Get user from JWT token
		async function loadUser() {
			const user = await getCurrentUserClient();
			if (!user) {
				// If no valid token, redirect to login
				router.replace("/login");
				return;
			}
			setCurrentUser(user);
			fetchProfile(user.id);
		}
		
		loadUser();
	}, []);

	async function fetchProfile(userId) {
		setLoading(true);
		try {
			const res = await fetch(`/api/users/profile?id=${userId}`);
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setProfile(data);
			form.setFieldsValue({
				name: data.name,
				username: data.username,
				password: "", // don't show password
				no_hp: data.no_hp,
			});
			setAvatarPreview(data.avatar ? `/api/product?filename=${data.avatar}` : null);
		} catch (err) {
			api.error({ message: "Gagal memuat profil", description: err.message });
		} finally {
			setLoading(false);
		}
	}

	async function handleSave(values) {
		if (!currentUser) return;
		
		setLoading(true);
		try {
			const payload = { id: currentUser.id, ...values };
			// If password is empty string or falsy, don't send it so server won't update it
			if (!payload.password) delete payload.password;
			if (avatarPreview && avatarPreview.startsWith("data:image")) {
				payload.avatar_base64 = avatarPreview;
			}
			const res = await fetch(`/api/users/profile`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (data.error) throw new Error(data.error);
			setProfile(data);
			api.success({ message: "Profil berhasil diperbarui" });
			setAvatarPreview(data.avatar ? `/api/avatar?filename=${data.avatar}` : null);
		} catch (err) {
			api.error({ message: "Gagal update profil", description: err.message });
		} finally {
			setLoading(false);
		}
	}

	function handleAvatarChange(info) {
		if (info.file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				setAvatarPreview(e.target.result);
				api.info({ message: "Foto profil siap diupload" });
			};
			reader.readAsDataURL(info.file);
		}
	}

	async function handleLogout() {
		try {
			await fetch("/api/auth", { method: "DELETE" });
			router.replace("/login");
		} catch (err) {
			api.error({ message: "Gagal logout" });
		}
	}

	return (
		<div className="max-w-4xl mx-auto p-6">
			{contextHolder}
			
			{/* Header */}
			<div className="mb-6">
				<Title level={2} className="m-0 flex items-center gap-2">
					<UserOutlined />
					Profil Saya
				</Title>
			</div>

			<Form
				form={form}
				layout="vertical"
				onFinish={handleSave}
				initialValues={{
					name: profile?.name,
					username: profile?.username,
					password: "",
					no_hp: profile?.no_hp,
				}}
			>
					{loading ? (
						<div className="flex justify-center items-center min-h-[200px]">
							<Spin size="large" />
						</div>
					) : (
						<>
							<div className="flex flex-col items-center mb-6">
								<Avatar
									size={96}
									src={avatarPreview}
									icon={<UserOutlined />}
								/>
								<div style={{ marginTop: "1rem" }}>
									<Upload
										showUploadList={false}
										accept="image/*"
										beforeUpload={(file) => {
											handleAvatarChange({ file });
											return false;
										}}
										maxCount={1}
									>
										<Button icon={<UploadOutlined />}>Ganti Foto Profil</Button>
									</Upload>
								</div>
							</div>
							<Form.Item
								label="Nama"
								name="name"
								rules={[{ required: true, message: "Nama wajib diisi" }]}
							>
								<Input size="large" />
							</Form.Item>
							<Form.Item
								label="Username"
								name="username"
								rules={[{ required: true, message: "Username wajib diisi" }]}
							>
								<Input size="large" />
							</Form.Item>
							<Form.Item
								label="Password Baru"
								name="password"
								rules={[]}
							>
								<Input.Password size="large" placeholder="Kosongkan jika tidak ingin mengubah" />
							</Form.Item>
							<Form.Item
								label="No HP"
								name="no_hp"
								rules={[{ required: true, message: "No HP wajib diisi" }]}
							>
								<Input size="large" />
							</Form.Item>
							<div className="flex gap-3 justify-end mt-6">
								<Button type="primary" htmlType="submit" loading={loading}>
									Simpan Perubahan
								</Button>
								<Button icon={<LogoutOutlined />} onClick={handleLogout} danger>
									Logout
								</Button>
							</div>
						</>
					)}
				</Form>
			</div>
	);
}
