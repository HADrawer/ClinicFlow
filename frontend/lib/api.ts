// Same-origin only. The browser always calls this frontend's own origin —
// never a LAN IP, a Docker service hostname, or port 8000 directly. The
// Next.js rewrite in next.config.ts (/backend-api/* -> ${BACKEND_API_ORIGIN}
// /api/*) resolves the real backend location server-side.
const API_BASE = "/backend-api";
const IS_DEV = process.env.NODE_ENV !== "production";

// Statuses a reverse-proxy failure (the Next.js server couldn't reach the
// backend upstream) typically surfaces as, distinct from an application-level
// error the backend itself chose to return.
const GATEWAY_FAILURE_STATUSES = new Set([502, 503, 504]);

export class ApiError extends Error{
  constructor(message:string,public status:number,public fieldErrors:Record<string,string>={}){super(message)}
}

function unreachableMessage():string{
  return "ClinicFlow could not reach the API through the application server. Confirm that the backend container is running.";
}

export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const token=typeof window!=="undefined"?localStorage.getItem("clinicflow_token"):null;
  const form=typeof FormData!=="undefined"&&options.body instanceof FormData;

  let response:Response;
  try{
    response=await fetch(`${API_BASE}${path}`,{...options,headers:{...(form?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{...{}}),...options.headers},cache:"no-store"});
  }catch{
    throw new ApiError(unreachableMessage(),0);
  }

  if(!response.ok){
    if(GATEWAY_FAILURE_STATUSES.has(response.status)){
      throw new ApiError(unreachableMessage(),response.status);
    }
    let message=IS_DEV?`API request to ${path} failed with status ${response.status}.`:"Something went wrong";
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
    }catch{
      message=IS_DEV?`API request to ${path} failed with status ${response.status} and returned a non-JSON response.`:message;
    }
    if(response.status===401&&typeof window!=="undefined")localStorage.removeItem("clinicflow_token");
    throw new ApiError(message,response.status,fieldErrors);
  }

  if(response.status===204)return undefined as T;
  try{
    return await response.json();
  }catch{
    throw new ApiError(IS_DEV?`API request to ${path} returned a 200 response that was not valid JSON.`:"Unexpected response from the server.",response.status);
  }
}

export const apiUrl=(path:string)=>`${API_BASE}${path}`;
