"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductClient from "@/components/client/ProductClient";
import FloatingBottomNav from "@/components/client/FloatingBottomNav";
import { Home, MessagesSquare, ReceiptText, ShoppingCart, User } from "lucide-react";
import Profile from "@/components/client/Profile";
import CartClient from "@/components/client/CartClient";
import OrderClient from "@/components/client/OrderClient";
import Chating from "@/components/shared/ui/Chating";

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeId, setActiveId] = useState(tabParam || "home");

  // Update activeId when URL parameter changes
  useEffect(() => {
    if (tabParam) {
      setActiveId(tabParam);
    }
  }, [tabParam]);

  const menuItems = [
    { id: 'home', 
      label: 'Home', 
      icon: Home, 
      component: (
        <div className="p-6 w-full">
          <ProductClient />
        </div>
      )
    },
    { 
      id: 'cart', 
      label: 'Keranjang', 
      icon: ShoppingCart, 
      component: <CartClient onStartShopping={() => setActiveId('home')} /> 
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessagesSquare,
      component: (
        <div className="p-6 w-full">
          <Chating />
        </div>
      )
    },
    {
      id: 'order',
      label: 'Pesanan',
      icon: ReceiptText,
      component: <OrderClient onStartShopping={() => setActiveId('home')} />
    },
    { 
      id: 'akun', 
      label: 'Akun', 
      icon: User, 
      component: <Profile /> 
    }
  ];

  return (
    <FloatingBottomNav 
      menuItems={menuItems} 
      initialActiveId={activeId}
      onActiveIdChange={setActiveId}
    />
  );
}
