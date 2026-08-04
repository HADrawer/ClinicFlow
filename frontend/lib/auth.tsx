"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {api} from "./api";import type {User} from "./types";
type Auth={user:User|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;register:(data:Record<string,string>)=>Promise<void>;logout:()=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<Auth|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const router=useRouter();
 const refresh=useCallback(async()=>{if(!localStorage.getItem("clinicflow_token")){setLoading(false);return}try{setUser(await api<User>("/auth/me"))}catch{setUser(null)}finally{setLoading(false)}},[]);useEffect(()=>{refresh()},[refresh]);
 const authenticate=useCallback(async(path:string,data:unknown)=>{const result=await api<{access_token:string}>(path,{method:"POST",body:JSON.stringify(data)});localStorage.setItem("clinicflow_token",result.access_token);await refresh();router.replace("/dashboard")},[refresh,router]);
 const value=useMemo(()=>({user,loading,login:(email:string,password:string)=>authenticate("/auth/login",{email,password}),register:(data:Record<string,string>)=>authenticate("/auth/register",data),logout:async()=>{try{await api("/auth/logout",{method:"POST"})}catch{}window.dispatchEvent(new Event("clinicflow:logout"));localStorage.removeItem("clinicflow_token");setUser(null);router.replace("/login")},refresh}),[user,loading,refresh,router,authenticate]);return <Context.Provider value={value}>{children}</Context.Provider>}
export const useAuth=()=>{const value=useContext(Context);if(!value)throw new Error("useAuth must be used inside AuthProvider");return value};
