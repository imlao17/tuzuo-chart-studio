import type { Metadata } from "next";
import "./globals.css";

function metadataOrigin() {
  const configuredOrigin = process.env.APP_BASE_URL?.trim();
  if (!configuredOrigin) return "http://localhost:3000";
  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function generateMetadata(): Metadata {
  const origin = metadataOrigin();
  const title = "知图 · 透明图表工具";
  const description = "导入数据，制作图表，并导出透明背景 PNG 或 SVG。";

  return {
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "知图透明图表工具",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
