import {getChatGPTUser} from '@/app/chatgpt-auth';
export async function user(){const u=await getChatGPTUser();if(!u)throw new Error('Sign in to use your private paper ledger.');return u.userId;}
export function reply(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function error(e:unknown){const message=e instanceof Error?e.message:String(e);return reply({error:message},message.startsWith('Sign in')?401:400);}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('Cross-origin changes are not allowed');}
