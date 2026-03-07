import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";

import "./globals.css";

const ibmPlexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QQQ / TQQQ Rolling Comparison",
  description:
    "QQQ와 TQQQ의 기간별 trailing 수익률을 드래그 가능한 네비게이터 차트로 비교합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${ibmPlexSansKr.variable} antialiased`}>{children}</body>
    </html>
  );
}
