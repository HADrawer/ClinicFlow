import {SelectHTMLAttributes} from "react";import {cn} from "@/lib/utils";
export function Select({className,...props}:SelectHTMLAttributes<HTMLSelectElement>){return <select className={cn("h-10 w-full rounded-[4px] border border-[#b9cbc6] bg-white px-3 text-sm text-[#10212b] outline-none focus:border-[#167d78] focus:ring-2 focus:ring-[#cce6e2]",className)} {...props}/>}
