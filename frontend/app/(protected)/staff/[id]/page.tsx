"use client";
import {useParams} from "next/navigation";
import {StaffProfileContent} from "@/components/staff/staff-profile-content";

export default function StaffDetailPage(){
  const {id}=useParams<{id:string}>();
  return <StaffProfileContent id={id}/>;
}
