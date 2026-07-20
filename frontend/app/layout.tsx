import type {Metadata} from "next";
import "./globals.css";
import {AuthProvider} from "@/lib/auth";
import {I18nProvider,SkipLink} from "@/lib/i18n";
export const metadata:Metadata={title:"ClinicFlow",description:"Clinic management for Bahrain and the GCC"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning><body><I18nProvider><SkipLink/><AuthProvider>{children}</AuthProvider></I18nProvider></body></html>}
