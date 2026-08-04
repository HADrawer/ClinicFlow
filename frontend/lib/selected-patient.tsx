"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {api} from "./api";
import {useAuth} from "./auth";
import type {Patient} from "./types";

export type PatientContextDetail={
  patient:Patient;
  appointments:Array<{id:number;start_time:string;status:string;doctor_name:string;service_name:string}>;
  visits:Array<{id:number;created_at:string;doctor_name:string;diagnosis:string}>;
  invoices:Array<{id:number;balance_due:number}>;
};

type SelectedPatientContext={
  detail:PatientContextDetail|null;
  loading:boolean;
  selectPatient:(patient:Patient|number)=>void;
  clearPatient:()=>void;
  refreshPatient:()=>Promise<void>;
};

const Context=createContext<SelectedPatientContext|null>(null);

export function SelectedPatientProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();
  const [detail,setDetail]=useState<PatientContextDetail|null>(null);
  const [loading,setLoading]=useState(false);
  const idRef=useRef<number|null>(null);
  const storageKey=user?`clinicflow:selected-patient:${user.clinic_id}:${user.id}`:"";

  const persist=useCallback((id:number|null)=>{
    if(!storageKey)return;
    if(id===null)sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey,String(id));
  },[storageKey]);

  const load=useCallback(async(id:number,quiet=false)=>{
    idRef.current=id;
    if(!quiet)setLoading(true);
    try{
      const next=await api<PatientContextDetail>(`/patients/${id}`);
      if(idRef.current===id)setDetail(next);
    }catch{
      if(idRef.current===id){idRef.current=null;setDetail(null);persist(null)}
    }finally{if(!quiet)setLoading(false)}
  },[persist]);

  useEffect(()=>{
    setDetail(null);idRef.current=null;
    if(!storageKey)return;
    const stored=Number(sessionStorage.getItem(storageKey));
    if(Number.isInteger(stored)&&stored>0)void load(stored);
  },[storageKey,load]);

  useEffect(()=>{
    const clear=()=>{idRef.current=null;setDetail(null);persist(null)};
    const refresh=()=>{if(idRef.current)void load(idRef.current,true)};
    window.addEventListener("clinicflow:logout",clear);
    window.addEventListener("clinicflow:patient-updated",refresh);
    window.addEventListener("clinicflow:appointment-updated",refresh);
    return()=>{window.removeEventListener("clinicflow:logout",clear);window.removeEventListener("clinicflow:patient-updated",refresh);window.removeEventListener("clinicflow:appointment-updated",refresh)};
  },[load,persist]);

  const selectPatient=useCallback((patient:Patient|number)=>{
    const id=typeof patient==="number"?patient:patient.id;
    idRef.current=id;persist(id);
    if(typeof patient!=="number")setDetail({patient,appointments:[],visits:[],invoices:[]});
    void load(id,true);
  },[load,persist]);
  const clearPatient=useCallback(()=>{idRef.current=null;setDetail(null);persist(null)},[persist]);
  const refreshPatient=useCallback(async()=>{if(idRef.current)await load(idRef.current,true)},[load]);
  const value=useMemo(()=>({detail,loading,selectPatient,clearPatient,refreshPatient}),[detail,loading,selectPatient,clearPatient,refreshPatient]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSelectedPatient(){
  const value=useContext(Context);
  if(!value)throw new Error("useSelectedPatient must be used inside SelectedPatientProvider");
  return value;
}
