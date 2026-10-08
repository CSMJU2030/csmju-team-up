import type { Metadata } from "next";
import { Noto_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";
import { type NavItem } from "@/csmju";
import TeamUpShell from "@/components/TeamUpShell";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const notoSansThai = Noto_Sans_Thai({ variable: "--font-noto-thai", subsets: ["latin", "thai"], weight: ["400", "500", "600", "700"] });
const NAV: NavItem[] = [
  { label: "ค้นหาโปรเจกต์", labelEn: "Projects", href: "/", icon: "dashboard" },
  { label: "Dashboard", labelEn: "Overview", href: "/dashboard", icon: "group" },
  { label: "ข้อความ", labelEn: "Messages", href: "/messages", icon: "campaign" },
  { label: "โปรไฟล์", labelEn: "Profile", href: "/profile", icon: "settings" },
];

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { template: "%s · CS TeamUp · CSMJU", default: "CS TeamUp · CSMJU" },
  description: "ระบบค้นหาเพื่อนร่วมทีมและโปรเจกต์สำหรับนักศึกษา CSMJU",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-on-surface">
        <TeamUpShell nav={NAV} coreHubWebUrl={process.env.CORE_HUB_WEB_URL}>{children}</TeamUpShell>
      </body>
    </html>
  );
}
