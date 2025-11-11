"use client";




import { useRouter } from "next/navigation";
import { Button } from "antd";
import { ArrowLeftOutlined } from '@ant-design/icons';
import Profile from "@/components/client/Profile";

function ProfilePage() {
  const router = useRouter();
  return (
    <div className="max-w-5xl mx-auto p-4">
      <Button
        type="button"
        onClick={() => router.back()}
  className="mb-4 flex items-center gap-2 text-gray-600 hover:text-green-600 text-base font-medium"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeftOutlined style={{ fontSize: 18 }} />
        Kembali
      </Button>
      <Profile />
    </div>
  );
}

export default ProfilePage;
