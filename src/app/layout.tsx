import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "交互式机器学习演示合集",
  description: "基于 Next.js 构建的交互式机器学习演示集合，包括 CartPole 强化学习体验等内容。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
