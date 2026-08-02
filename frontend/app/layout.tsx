import type {Metadata} from "next";
import "./globals.css";
import {AuthProvider} from "@/lib/auth";
import {I18nProvider,SkipLink} from "@/lib/i18n";
import {ThemeProvider} from "@/lib/theme";
export const metadata:Metadata={title:"ClinicFlow",description:"Clinic management for Bahrain and the GCC"};
const themeScript=`(()=>{try{const saved=localStorage.getItem("clinicflow_theme");const dark=saved==="dark"||(saved!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);const theme=dark?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{document.documentElement.dataset.theme="light"}})()`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" dir="ltr" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><ThemeProvider><I18nProvider><SkipLink/><AuthProvider>{children}</AuthProvider></I18nProvider></ThemeProvider></body></html>}
