import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,220}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const pairSchema = z.object({
  id, label:z.string().min(1), kalshi:id, poly:id,
  kalshiRulesHash:hash, polyRulesHash:hash,
  kalshiCloseAt:z.string().datetime(), polyCloseAt:z.string().datetime(),
  reviewedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reviewSource:z.string().min(1),
  settlementModel:z.literal('ordinary-$1-pair'), settlementRisk:z.string().min(1),
}).strict();
export const configSchema = z.object({
  mode:z.literal('paper'), capitalUsd:z.number().positive().max(10000),
  perVenueUsd:z.number().positive().max(10000),
  maxBookAgeMs:z.number().int().min(1).max(10000),
  maxBookSkewMs:z.number().int().min(1).max(2000),
  metadataMaxAgeMs:z.number().int().min(1000).max(120000),
  pairs:z.array(pairSchema).min(1).max(100),
}).strict().superRefine((c,ctx)=>{
  for(const key of ['id','kalshi','poly'] as const)
    if(new Set(c.pairs.map(p=>p[key])).size!==c.pairs.length)
      ctx.addIssue({code:'custom',message:`Duplicate ${key}; do not reuse a market's depth`});
  if(c.capitalUsd>c.perVenueUsd*2)ctx.addIssue({code:'custom',message:'Capital exceeds the two venue balances'});
});
export type ApprovedPair = z.infer<typeof pairSchema>;
export type Config = z.infer<typeof configSchema>;
export const sha = (text:string)=>createHash('sha256').update(text).digest('hex');
export const readConfig = (path:string)=>configSchema.parse(JSON.parse(readFileSync(path,'utf8')));
