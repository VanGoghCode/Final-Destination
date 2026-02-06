import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { JobQueueProvider } from "@/context/JobQueueContext";
import { AuthProvider } from "@/context/AuthContext";
import MouseGlow from "@/components/MouseGlow";
import PasscodeModal from "@/components/PasscodeModal";
import AuthGate from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Final Destination | Secure Your Dream Job",
  description:
    "The last tool you'll ever need. Tailor your resume and cover letter with AI precision.",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MouseGlow />
        <AuthProvider>
          <PasscodeModal />
          <AuthGate>
            <AppProvider>
              <JobQueueProvider>{children}</JobQueueProvider>
            </AppProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
