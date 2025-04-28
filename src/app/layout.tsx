import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/components/auth/AuthContext';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { Providers } from './providers';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: "Learnify - Personalized Learning Platform",
  description: "AI-powered personalized learning platform tailored for your unique learning style",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`w-full h-full m-0 p-0 overflow-hidden ${playfair.variable}`} suppressHydrationWarning>
      <Script id="mermaid-init" strategy="afterInteractive">
        {`
          if (typeof window !== 'undefined') {
            import('mermaid').then((mermaid) => {
              mermaid.default.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'inherit',
                logLevel: 1
              });
            }).catch(err => console.error('Error loading mermaid:', err));
          }
        `}
      </Script>
      <body className={`${inter.className} w-full h-full m-0 p-0`}>
        <Providers>
          <AuthProvider>
            <ToastProvider>
              <NextTopLoader
                color="var(--primary)"
                showSpinner={false}
                shadow="0 0 10px var(--primary),0 0 5px var(--primary)"
              />
              <Toaster position="top-center" />
              {children}
            </ToastProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
