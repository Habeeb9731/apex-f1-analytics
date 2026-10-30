export type Meeting={meeting_key:number;year:number;meeting_name:string;meeting_official_name?:string;location:string;country_name:string;country_code?:string;date_start:string;circuit_short_name?:string;is_cancelled?:boolean};
export type Session={session_key:number;meeting_key:number;session_name:string;session_type:string;date_start:string;date_end?:string};
export type Driver={driver_number:number;full_name:string;name_acronym:string;team_name:string;team_colour:string;headshot_url?:string;country_code?:string};
// Data comes from our own server (/api/f1), which caches OpenF1 and paces requests to it.
const BASE='/api/f1';
export async function api<T>(path:string,params:Record<string,string|number|undefined>={},signal?:AbortSignal):Promise<T>{
  const u=new URL(`${BASE}/${path.replace(/^\/+/,'')}`,window.location.origin);
  Object.entries(params).forEach(([k,v])=>v!==undefined&&u.searchParams.set(k,String(v)));
  const r=await fetch(u,{signal});
  if(r.ok)return r.json();
  const body=await r.json().catch(()=>null) as {message?:string}|null;
  throw new Error(body?.message||`Race data request failed (${r.status})`);
}
export const teamColor=(d?:Driver)=>d?.team_colour?`#${d.team_colour}`:'#9298a5';
export const timeMs=(s?:string|number|null)=>{if(s==null||s==='')return null;if(typeof s==='number')return s*1000;const p=s.split(':');return p.length===2?(+p[0]*60+ +p[1])*1000:+s*1000};
export const fmtLap=(ms?:number|null)=>ms==null?'—':`${Math.floor(ms/60000)}:${((ms%60000)/1000).toFixed(3).padStart(6,'0')}`;
