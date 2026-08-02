import {SelectHTMLAttributes} from "react";import {cn} from "@/lib/utils";
export function Select({className,...props}:SelectHTMLAttributes<HTMLSelectElement>){return <select className={cn("control h-10 w-full px-3 text-sm outline-none",className)} {...props}/>}
