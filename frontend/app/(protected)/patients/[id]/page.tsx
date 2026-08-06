"use client";
import {useParams} from "next/navigation";
import {PatientDetailContent} from "@/components/patient/patient-detail-content";

export default function PatientDetailPage(){
  const {id}=useParams<{id:string}>();
  return <PatientDetailContent id={id}/>;
}
