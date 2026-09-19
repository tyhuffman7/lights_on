import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {parseNtp,type ClockWindow} from '../lib/arb/clock-window.ts';
const exec=promisify(execFile);
export async function measurePaperClock():Promise<ClockWindow>{
 const startWall=Date.now(),startMono=performance.now(),sources=['time.apple.com','time.cloudflare.com'];
 const estimates=await Promise.all(sources.map(async host=>{const {stdout}=await exec('/usr/bin/sntp',['-t','5','-n','1',host],{timeout:7000,maxBuffer:8192});return parseNtp(stdout);}));
 const measuredAt=Date.now(),measuredMono=performance.now();
 if(Math.abs((measuredAt-startWall)-(measuredMono-startMono))>50)throw Error('Local clock changed during calibration');
 if(Math.max(...estimates.map(e=>e.min))>Math.min(...estimates.map(e=>e.max)))throw Error('Independent NTP estimates disagree');
 // Use the union, not the tighter intersection, to avoid false precision.
 return {minOffsetMs:Math.min(...estimates.map(e=>e.min)),maxOffsetMs:Math.max(...estimates.map(e=>e.max)),measuredAt,measuredMono,expiresAt:measuredAt+60000,sources};
}
