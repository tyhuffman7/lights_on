import {headers} from 'next/headers';
export const scenarios = ['eligible','no-edge','unwind','unmatched'] as const;
export async function context(){
 const h=await headers(), cookie=h.get('cookie')||'';
 const value=cookie.match(/(?:^|;\s*)paper-case=([^;]+)/)?.[1]||'eligible-manual';
 const match=/^(eligible|no-edge|unwind|unmatched)-([a-zA-Z0-9-]{1,80})$/.exec(value);
 if(!match)throw Error('Invalid synthetic fixture case');
 return {key:value,scenario:match[1],settled:/(?:^|;\s*)paper-settled=1(?:;|$)/.test(cookie)};
}
