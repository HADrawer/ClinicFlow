import {AppShell} from "@/components/layout/app-shell";
import {SelectedPatientProvider} from "@/lib/selected-patient";
import {QuickCreateProvider} from "@/lib/quick-create";
export default function ProtectedLayout({children}:{children:React.ReactNode}){return <SelectedPatientProvider><QuickCreateProvider><AppShell>{children}</AppShell></QuickCreateProvider></SelectedPatientProvider>}
