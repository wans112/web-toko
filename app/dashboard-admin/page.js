"use client";

import SidebarAndNavbar from "@/components/shared/ui/SidebarAndNavbar";
import ManagementProduct from "@/components/admin/management/ManagementProduct";
import ManagementUsersByAdmin from "@/components/admin/management/ManagementUsersByAdmin";
import ManagementOrders from "@/components/admin/management/ManagementOrders";
import { UserOutlined, AppstoreOutlined, LogoutOutlined, PercentageOutlined, CreditCardOutlined, ShoppingCartOutlined, SettingOutlined, MessageOutlined, TagOutlined, DashboardOutlined } from '@ant-design/icons';
import { useRouter } from "next/navigation";
import ManagementDiscountPercentage from "@/components/admin/management/ManagementDiscountPercentage";
import ManagementDiscountNominal from "@/components/admin/management/ManagementDiscountNominal";
import ManagementDiscountTiered from "@/components/admin/management/ManagementDiscountTiered";
import ManagementPayment from "@/components/admin/management/ManagementPayment";
import { useEffect, useState } from "react";
import Chating from "@/components/shared/ui/Chating";

export default function DashboardAdminPage() {
  const router = useRouter();
  const [userMenuInfo, setUserMenuInfo] = useState({ name: "", username: "", avatar: null});
  const [brandName, setBrandName] = useState('Toko Sembako');
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const userInitial = (userMenuInfo.username || userMenuInfo.name || "").charAt(0).toUpperCase();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (!meRes.ok) {
          // Not authenticated -> redirect to login
          router.replace('/login');
          return;
        }
        const me = await meRes.json();
        const userId = me?.user?.id;
        if (!userId) return;
        // Use profile endpoint which includes avatar filename
        const detailRes = await fetch(`/api/users/profile?id=${userId}`);
        if (!detailRes.ok) return;
        const detail = await detailRes.json();
        if (mounted && detail) {
          setUserMenuInfo({
            name: detail.name || detail.username || "",
            username: detail.username || "",
            avatar: detail.avatar || null,
          });
        }
      } catch (e) {
        // noop
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  // fetch brand data (use first brand as site brand)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/brand');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data) && data.length) {
          const b = data[0];
          setBrandName(b.name || 'Toko Sembako');
          setBrandLogoFile(b.logo || null);
        }
      } catch (e) {
        // noop
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for brand updates (from Brand editor) and update immediately
  useEffect(() => {
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
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      router.replace("/login");
    } catch (err) {
      alert("Gagal logout");
    }
  };

  const menuItems = [
    {
      id: "users",
      label: "User",
      icon: UserOutlined,
      component: (
        <>
          <ManagementUsersByAdmin />
        </>
      ),
    },
    {
      id: "products",
      label: "Produk",
      icon: AppstoreOutlined,
      component: (
        <>
          <ManagementProduct />
        </>
      ),
    },
    {
      id: "orders",
      label: "Pesanan",
      icon: ShoppingCartOutlined,
      component: (
        <>
          <ManagementOrders />
        </>
      ),
    },
    {
      id: "discounts",
      label: "Diskon",
      icon: PercentageOutlined,
      component: (
        <>
          <div className="flex flex-col gap-4">
            <ManagementDiscountTiered />
            <ManagementDiscountPercentage />
            <ManagementDiscountNominal />
          </div>
        </>
      ),
    },
    {
      id: "payment_methods",
      label: "Metode Pembayaran",
      icon: CreditCardOutlined,
      component: (
        <>
          <ManagementPayment />
        </>
      ),
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageOutlined,
      component: (
        <>
          <Chating />
        </>
      ),
    }
  ];

  return (
    <SidebarAndNavbar 
      menuItems={menuItems} 
      brandName={brandName}
        brandLogo={brandLogoFile ? (
        <img src={`/api/brand/logo?filename=${brandLogoFile}&t=${Date.now()}`} alt={brandName} className="object-contain rounded-xl" />
      ) : null}
      userMenu={{
      avatar: userMenuInfo.avatar ? (
        <img
          src={`/api/avatar?filename=${userMenuInfo.avatar}`}
          alt={userMenuInfo.name || userMenuInfo.username}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
          {userInitial || 'U'}
        </div>
      ),
      name: userMenuInfo.name,
      username: userMenuInfo.username,
        menu: [
          { label: (<><SettingOutlined />Settings</>), onClick: () => router.push('/profile') },
          { label: (<><LogoutOutlined />Logout</>), onClick: handleLogout },
        ],
      }}
    />
  );
}