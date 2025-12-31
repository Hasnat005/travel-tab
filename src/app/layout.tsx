import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResponsiveNavbar from "@/components/nav/ResponsiveNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TravelTab",
  description: "Split travel expenses and settle up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabasePromise = createSupabaseServerClient();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen">
          <header
            className={
              [
                "fixed inset-x-0 top-0 z-40",
                "h-16",
                "md:sticky md:top-4 md:h-20",
                "bg-transparent",
              ].join(" ")
            }
          >
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
            <NavbarFromServer supabasePromise={supabasePromise} />
          </header>

          {/* Spacer for fixed mobile navbar */}
          <div className="h-16 md:hidden" />

          <main
            className={
              [
                "px-4 py-4",
                "md:px-6 md:py-6",
                "lg:mx-auto lg:max-w-7xl lg:px-8 lg:py-8",
              ].join(" ")
            }
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

async function NavbarFromServer({
  supabasePromise,
}: {
  supabasePromise: ReturnType<typeof createSupabaseServerClient>;
}) {
  const supabase = await supabasePromise;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <ResponsiveNavbar userEmail={user?.email ?? null} />;
}
