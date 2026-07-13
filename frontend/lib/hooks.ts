"use client";import {useCallback,useEffect,useState} from "react";import {api} from "./api";
export function useApi<T>(path:string){const [data,setData]=useState<T|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const reload=useCallback(async()=>{setLoading(true);setError("");try{setData(await api<T>(path))}catch(e){setError(e instanceof Error?e.message:"Unable to load data")}finally{setLoading(false)}},[path]);useEffect(()=>{reload()},[reload]);return {data,loading,error,reload,setData}}

