"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {Monitor, Moon, Sun} from "lucide-react";

export type ThemePreference="light"|"dark"|"system";
type ResolvedTheme="light"|"dark";

type ThemeContextValue={
  preference:ThemePreference;
  resolved:ResolvedTheme;
  setPreference:(theme:ThemePreference)=>void;
  cycleTheme:()=>void;
};

const ThemeContext=createContext<ThemeContextValue>({
  preference:"system",
  resolved:"light",
  setPreference:()=>{},
  cycleTheme:()=>{},
});

function systemTheme():ResolvedTheme{
  return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}

function applyTheme(preference:ThemePreference){
  const resolved=preference==="system"?systemTheme():preference;
  document.documentElement.dataset.theme=resolved;
  document.documentElement.style.colorScheme=resolved;
  return resolved;
}

export function ThemeProvider({children}:{children:React.ReactNode}){
  const [preference,setPreferenceState]=useState<ThemePreference>("system");
  const [resolved,setResolved]=useState<ResolvedTheme>("light");

  useEffect(()=>{
    const saved=window.localStorage.getItem("clinicflow_theme");
    const next:ThemePreference=saved==="light"||saved==="dark"?saved:"system";
    setPreferenceState(next);
    setResolved(applyTheme(next));
  },[]);

  useEffect(()=>{
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const onChange=()=>{if(preference==="system")setResolved(applyTheme("system"))};
    media.addEventListener("change",onChange);
    return()=>media.removeEventListener("change",onChange);
  },[preference]);

  const setPreference=useCallback((next:ThemePreference)=>{
    if(next==="system")window.localStorage.removeItem("clinicflow_theme");
    else window.localStorage.setItem("clinicflow_theme",next);
    setPreferenceState(next);
    setResolved(applyTheme(next));
  },[]);

  const cycleTheme=useCallback(()=>{
    setPreference(resolved==="dark"?"light":"dark");
  },[resolved,setPreference]);

  const value=useMemo(()=>({preference,resolved,setPreference,cycleTheme}),[preference,resolved,setPreference,cycleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(){return useContext(ThemeContext)}

export function ThemeSwitcher({label}:{label:(key:string)=>string}){
  const {resolved,cycleTheme}=useTheme();
  const next=resolved==="dark"?"light":"dark";
  return <button
    type="button"
    className="theme-switcher"
    onClick={cycleTheme}
    aria-label={label(next==="dark"?"theme.switchToDark":"theme.switchToLight")}
    title={label(next==="dark"?"theme.switchToDark":"theme.switchToLight")}
  >
    {resolved==="dark"?<Sun size={17}/>:<Moon size={17}/>}
  </button>;
}

export function ThemePreferenceControl({label}:{label:(key:string)=>string}){
  const {preference,setPreference}=useTheme();
  const options:{value:ThemePreference;icon:typeof Sun;key:string}[]=[
    {value:"light",icon:Sun,key:"theme.light"},
    {value:"dark",icon:Moon,key:"theme.dark"},
    {value:"system",icon:Monitor,key:"theme.system"},
  ];
  return <div className="theme-preference" role="group" aria-label={label("theme.appearance")}>
    {options.map(option=>{
      const Icon=option.icon;
      return <button
        type="button"
        key={option.value}
        aria-pressed={preference===option.value}
        onClick={()=>setPreference(option.value)}
      >
        <Icon size={16}/><span>{label(option.key)}</span>
      </button>;
    })}
  </div>;
}
