"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, ColorPicker, Button, message, Typography, Space } from "antd";
import { BgColorsOutlined, UndoOutlined, SaveOutlined } from "@ant-design/icons";

const { Paragraph, Text } = Typography;
const DEFAULT_PRIMARY_COLOR = "#73d13d";

export default function ThemeSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [initialColor, setInitialColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let active = true;
    const loadTheme = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/theme", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const json = await res.json().catch(() => null);
        const color = json?.data?.primaryColor;
        if (active && typeof color === "string" && color) {
          setPrimaryColor(color);
          setInitialColor(color);
        }
      } catch (err) {
        console.error("Failed to load theme settings", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTheme();
    return () => {
      active = false;
    };
  }, []);

  const handleColorChange = useCallback((value, hex) => {
    const fromHex = typeof hex === "string" && hex.startsWith("#") ? hex : null;
    if (fromHex) {
      setPrimaryColor(fromHex.length === 9 ? fromHex.slice(0, 7) : fromHex);
      return;
    }
    const next = value?.toHexString?.();
    setPrimaryColor(typeof next === "string" ? next : DEFAULT_PRIMARY_COLOR);
  }, []);

  const handleReset = useCallback(() => {
    setPrimaryColor(initialColor);
  }, [initialColor]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ primaryColor }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        messageApi.error(json?.error || "Gagal menyimpan tema");
        return;
      }

      setInitialColor(primaryColor);
      messageApi.success("Tema berhasil diperbarui");
      window.dispatchEvent(new CustomEvent("themeUpdated", { detail: { primaryColor } }));
    } catch (err) {
      console.error("Failed to save theme settings", err);
      messageApi.error("Gagal menyimpan tema");
    } finally {
      setSaving(false);
    }
  }, [primaryColor, messageApi]);

  const hasChanges = primaryColor !== initialColor;

  return (
    <>
      {contextHolder}
      <Card
      title={
        <Space>
          <BgColorsOutlined />
          <span>Pengaturan Tema</span>
        </Space>
      }
      loading={loading}
    >
      <Paragraph>
        Pilih warna utama untuk aplikasi. Perubahan akan tersimpan di database dan diterapkan untuk seluruh pengguna.
      </Paragraph>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <ColorPicker
            value={primaryColor}
            onChange={handleColorChange}
            showText
          />
          <div>
            <Text type="secondary">Warna utama</Text>
            <div className="font-mono text-base">{primaryColor}</div>
          </div>
        </div>
        <Space wrap>
          <Button
            icon={<UndoOutlined />}
            disabled={!hasChanges}
            onClick={handleReset}
          >
            Batalkan
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
          >
            Simpan
          </Button>
        </Space>
      </div>
    </Card>
    </>
  );
}
