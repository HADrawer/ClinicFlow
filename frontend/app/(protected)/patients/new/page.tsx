import {PageHeader} from "@/components/ui/page-header";import {Card} from "@/components/ui/card";import {PatientForm} from "@/components/forms/patient-form";
export default function NewPatient(){return <><PageHeader title="Register patient" description="Create a clinical and contact record for a new patient."/><Card className="max-w-4xl p-5 sm:p-6"><PatientForm/></Card></>}

