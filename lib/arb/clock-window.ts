export type ClockWindow={minOffsetMs:number;maxOffsetMs:number;measuredAt:number;measuredMono:number;expiresAt:number;sources:string[]};
export function clockUsable(c:ClockWindow,wall:number,mono:number){
 return Number.isFinite(c.minOffsetMs)&&Number.isFinite(c.maxOffsetMs)&&c.minOffsetMs<=c.maxOffsetMs&&c.maxOffsetMs-c.minOffsetMs<=1000&&Math.max(Math.abs(c.minOffsetMs),Math.abs(c.maxOffsetMs))<=2000&&wall>=c.measuredAt&&wall<c.expiresAt&&c.expiresAt<=c.measuredAt+60000&&mono>=c.measuredMono&&Math.abs((wall-c.measuredAt)-(mono-c.measuredMono))<=50;
}
// Bounds for a UTC exchange timestamp expressed in the local wall-clock domain.
// No source timestamp is rewritten. All admissible offsets must pass timing gates.
export function localTradeBounds(at:number,c:ClockWindow|undefined,wall:number,mono:number):[number,number]|null{
 if(!c)return [at,at];if(!clockUsable(c,wall,mono))return null;
 const drift=(wall-c.measuredAt)/1000; // additional 1 ms/s drift allowance
 return [at-c.maxOffsetMs-drift,at-c.minOffsetMs+drift];
}
export function parseNtp(text:string){
 const m=text.match(/^([+-]\d+(?:\.\d+)?)\s+\+\/-\s+(\d+(?:\.\d+)?)/m);if(!m)throw Error('No NTP offset estimate');
 const offset=Number(m[1])*1000,error=Number(m[2])*1000;
 if(!Number.isFinite(offset)||!Number.isFinite(error)||error<0||error>500||Math.abs(offset)+error>2000)throw Error('NTP estimate too uncertain');
 return {min:offset-error,max:offset+error};
}
