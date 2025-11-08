"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfigProvider } from "antd";

const DEFAULT_PRIMARY_COLOR = "#73d13d";

function buildTokens(primaryColor) {
  const safeColor = typeof primaryColor === "string" && primaryColor ? primaryColor : DEFAULT_PRIMARY_COLOR;
  return {
    colorPrimary: safeColor,
    colorInfo: safeColor,
    colorSuccess: safeColor,
    colorLink: safeColor,
    colorBgBase: "#ffffff",
    colorText: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
  };
}

export default function ThemeConfigProvider({ children }) {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);

  useEffect(() => {
    let active = true;

    const fetchTheme = async () => {
      try {
        const res = await fetch("/api/theme", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const color = json?.data?.primaryColor;
        if (active && typeof color === "string" && color) {
          setPrimaryColor(color);
        }
      } catch (err) {
        console.error("Failed to load theme settings", err);
      }
    };

    fetchTheme();

    const handler = (event) => {
      const color = event?.detail?.primaryColor;
      if (typeof color === "string" && color) {
        setPrimaryColor(color);
      }
    };

    window.addEventListener("themeUpdated", handler);
    return () => {
      active = false;
      window.removeEventListener("themeUpdated", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      document.documentElement.style.setProperty("--app-primary-color", primaryColor);
      window.dispatchEvent(
        new CustomEvent("themeApplied", { detail: { primaryColor } })
      );
    } catch (err) {
      // ignore assignment errors
    }
  }, [primaryColor]);

  const tokens = useMemo(() => buildTokens(primaryColor), [primaryColor]);

  return (
    <ConfigProvider
      theme={{
        token: tokens,
      }}
    >
      {children}
    </ConfigProvider>
  );
}
