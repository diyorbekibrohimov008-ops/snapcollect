import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Red_Hat_Display, Red_Hat_Text } from 'next/font/google';
import './globals.css';

const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-red-hat-display',
});

const redHatText = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-red-hat-text',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export const viewport: Viewport = {
  themeColor: '#f8fafc',
};

export const metadata: Metadata = {
  title: 'SnapCollect — AI Client Document Collection via WhatsApp, SMS & Mobile',
  description:
    'Replace email attachments and throttled portals. Collect verified W-2s, bank statements, and client assets via WhatsApp/SMS and instant AI verification for $25/mo unlimited.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${redHatDisplay.variable} ${redHatText.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen bg-[#f8fafc] text-slate-900">{children}</body>
    </html>
  );
}
