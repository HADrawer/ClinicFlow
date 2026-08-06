import type {ComponentType} from "react";
import {CalendarPlus,CreditCard,FileUp,ShieldAlert,UserPlus} from "lucide-react";

export type QuickCreateActionId="add_patient"|"new_appointment"|"new_invoice"|"upload_document"|"record_incident";

// Mirrors backend app/quick_create.py's QUICK_CREATE_ACTIONS. "Invite staff"
// is deliberately absent everywhere — staff invitations only ever happen
// through Staff management, clinic onboarding, or the invitation workflow.
export const QUICK_CREATE_CATALOG:Record<QuickCreateActionId,{labelKey:string;hintKey:string;icon:ComponentType<{size?:number}>;permissions:string[]}>={
  add_patient:{labelKey:"quickCreate.addPatient",hintKey:"quickCreate.addPatientHint",icon:UserPlus,permissions:["patients.create"]},
  new_appointment:{labelKey:"appointments.new",hintKey:"quickCreate.appointmentHint",icon:CalendarPlus,permissions:["appointments.manage_own","appointments.manage_all"]},
  new_invoice:{labelKey:"forms.createInvoice",hintKey:"quickCreate.invoiceHint",icon:CreditCard,permissions:["billing.create"]},
  upload_document:{labelKey:"quickCreate.uploadDocument",hintKey:"quickCreate.uploadDocumentHint",icon:FileUp,permissions:["documents.manage"]},
  record_incident:{labelKey:"quickCreate.recordIncident",hintKey:"quickCreate.recordIncidentHint",icon:ShieldAlert,permissions:["quality.manage"]},
};

export const QUICK_CREATE_ACTION_IDS=Object.keys(QUICK_CREATE_CATALOG) as QuickCreateActionId[];
