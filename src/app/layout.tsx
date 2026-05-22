import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, Caveat, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "700", "800"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
  weight: ["400", "500", "600", "700"],
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-assamese",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sinaki — Find your someone, the Assamese way",
  description: "A culturally rooted dating platform exclusively designed for people of Assam.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${dmSans.variable} ${caveat.variable} ${notoBengali.variable}`}>
        {children}
      </body>
    </html>
  );
}

