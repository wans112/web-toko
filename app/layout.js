import "./globals.css";
import "antd/dist/reset.css";
import '@ant-design/v5-patch-for-react-19';
import PresenceProvider from "@/components/client/PresenceProvider";
import GlobalNotifications from "@/components/client/GlobalNotifications";
import ThemeConfigProvider from "@/components/client/ThemeConfigProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeConfigProvider>
          <PresenceProvider />
          <GlobalNotifications />
          {children}
        </ThemeConfigProvider>
      </body>
    </html>
  );
}