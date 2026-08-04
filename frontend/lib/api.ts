const API_URL=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000/api";
export class ApiError extends Error{
  constructor(message:string,public status:number,public fieldErrors:Record<string,string>={}){super(message)}
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const token=typeof window!=="undefined"?localStorage.getItem("clinicflow_token"):null;
  const form=typeof FormData!=="undefined"&&options.body instanceof FormData;
  const response=await fetch(`${API_URL}${path}`,{...options,headers:{...(form?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{...{}}),...options.headers},cache:"no-store"});
  if(!response.ok){
    let message="Something went wrong";
    const fieldErrors:Record<string,string>={};
    try{
      const body=await response.json();
      if(typeof body.detail==="string")message=body.detail;
      else if(Array.isArray(body.detail)){
        for(const issue of body.detail){
          const field=Array.isArray(issue?.loc)?String(issue.loc.at(-1)||""):"";
          if(field&&issue?.msg)fieldErrors[field]=String(issue.msg);
        }
        message=body.detail?.[0]?.msg||message;
      }
    }catch{}
    if(response.status===401&&typeof window!=="undefined")localStorage.removeItem("clinicflow_token");
    throw new ApiError(message,response.status,fieldErrors);
  }
  return response.status===204?undefined as T:response.json();
}

export const apiUrl=(path:string)=>`${API_URL}${path}`;
