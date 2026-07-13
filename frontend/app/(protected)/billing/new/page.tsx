import {Suspense} from "react";import {PageHeader} from "@/components/ui/page-header";import {Card} from "@/components/ui/card";import {InvoiceForm} from "@/components/forms/invoice-form";import {Loading} from "@/components/ui/feedback";
export default function NewInvoice(){return <><PageHeader title="New invoice" description="Create an itemized invoice and record an initial payment."/><Card className="max-w-5xl p-5 sm:p-6"><Suspense fallback={<Loading/>}><InvoiceForm/></Suspense></Card></>}

