import type {Metadata} from "next";
import "./globals.css";
import {AuthProvider} from "@/lib/auth";
export const metadata:Metadata={title:"ClinicFlow",description:"Clinic management for Bahrain and the GCC"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main-content">Skip to main content</a><AuthProvider>{children}</AuthProvider></body></html>}
