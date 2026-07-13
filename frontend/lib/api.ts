const API_URL=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000/api";
export class ApiError extends Error{constructor(message:string,public status:number){super(message)}}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const token=typeof window!=="undefined"?localStorage.getItem("clinicflow_token"):null;
  const form=typeof FormData!=="undefined"&&options.body instanceof FormData;
  const response=await fetch(`${API_URL}${path}`,{...options,headers:{...(form?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{...{}}),...options.headers},cache:"no-store"});
  if(!response.ok){let message="Something went wrong";try{const body=await response.json();message=typeof body.detail==="string"?body.detail:body.detail?.[0]?.msg||message}catch{}if(response.status===401&&typeof window!=="undefined"){localStorage.removeItem("clinicflow_token")}throw new ApiError(message,response.status)}
  return response.status===204?undefined as T:response.json();
}

export const apiUrl=(path:string)=>`${API_URL}${path}`;
