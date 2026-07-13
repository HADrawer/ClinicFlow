import {Inbox} from "lucide-react";
export function EmptyState({title="Nothing here yet",description,action}:{title?:string;description?:string;action?:React.ReactNode}){return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500"><Inbox size={22}/></div><h3 className="font-semibold text-slate-800">{title}</h3>{description&&<p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}{action&&<div className="mt-4">{action}</div>}</div>}

