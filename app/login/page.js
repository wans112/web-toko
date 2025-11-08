"use client";
import React from "react";
import "antd/dist/reset.css";
import { Card, Form, Input, Button, Typography, notification } from "antd";
import { useRouter } from "next/navigation"; // removed useSearchParams

const { Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [from, setFrom] = React.useState("/"); // get 'from' from URL on client
  React.useEffect(() => {
    try {
      const sp = new URL(window.location.href).searchParams;
      setFrom(sp.get("from") || "/");
    } catch (e) {
      setFrom("/");
    }
  }, []);

  // fetch brand info to show logo on login card
  const [brandLogoFile, setBrandLogoFile] = React.useState(null);
  const [brandName, setBrandName] = React.useState('');
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/brand');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data) && data.length) {
          const b = data[0];
          setBrandName(b.name || '');
          setBrandLogoFile(b.logo || null);
        }
      } catch (e) {
        // noop
      }
    })();
    return () => { mounted = false; };
  }, []);

  // react to brand updates (so login page updates logo immediately)
  React.useEffect(() => {
    const handler = (e) => {
      const updated = e?.detail;
      if (updated) {
        setBrandName(updated.name || 'Toko Sembako');
        setBrandLogoFile(updated.logo || null);
      }
    };
    window.addEventListener('brandUpdated', handler);
    return () => window.removeEventListener('brandUpdated', handler);
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [form] = Form.useForm();
  const [api, contextHolder] = notification.useNotification();

  const onFinish = async (values) => {
    setLoading(true);
    form.setFields([
      { name: "username", errors: [] },
      { name: "password", errors: [] },
    ]);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          api.error({
            message: "Login Gagal",
            description: data.error || "Username atau password salah",
          });
          form.setFields([
            { name: "username", errors: ["Username atau password salah"] },
            { name: "password", errors: ["Username atau password salah"] },
          ]);
        } else {
          api.error({
            message: "Login Gagal",
            description: data.error || "Terjadi kesalahan saat login",
          });
        }
        return;
      }

      api.success({
        message: "Login Berhasil",
        description: `Selamat datang, ${data.user?.name || data.user?.username || ""}`,
      });

      const role = data.user?.role;
      if (role === "admin") {
        router.push("/dashboard-admin");
      } else if (role === "superadmin") {
        router.push("/dashboard-superadmin");
      } else if (role === "user") {
        router.push("/dashboard");
      } else {
        router.push(from || "/");
      }
    } catch (err) {
      console.error(err);
      api.error({
        message: "Kesalahan Jaringan",
        description: "Tidak dapat menghubungi server. Silakan coba lagi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-100">
      {contextHolder}
      <div className="w-full max-w-md relative">
        {brandLogoFile ? (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -36, zIndex: 10 }}>
            <img
              src={`/api/brand/logo?filename=${brandLogoFile}&t=${Date.now()}`}
              alt={brandName || 'Brand'}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            />
          </div>
        ) : null}
        <Card className="w-full" style={{ paddingTop: brandLogoFile ? 40 : undefined }}>
          <Title level={3} className="text-center mb-2">
            Login
          </Title>

        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Username diperlukan" }]}
          >
            <Input placeholder="Username" autoComplete="username" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Password diperlukan" }]}
          >
            <Input.Password placeholder="Password" autoComplete="current-password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
      </div>
    </div>
  );
}