export async function api<T=any>(path:string,body?:unknown):Promise<T>{
 const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json() as T & {error?:string};if(!response.ok)throw new Error(data.error||'Request failed');return data;
}
