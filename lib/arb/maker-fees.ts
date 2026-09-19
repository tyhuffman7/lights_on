export type MakerFeeProfile={series:string;feeType:string;multiplier:number;rate:number;observedAt:number;expiresAt:number;source:string};
// Supported published multipliers only. Round the 87.5-unit maker coefficient up
// to 88 so integer fee arithmetic remains an upper bound; retain cent alignment.
export function makerFeeProfile(series:string,data:Record<string,unknown>,now:number):MakerFeeProfile{
 if(data.ticker!==series||![0.5,1].includes(data.fee_multiplier as number)||!['quadratic','quadratic_with_maker_fees'].includes(String(data.fee_type)))throw Error('Unsupported maker fee schedule');
 return {series,feeType:String(data.fee_type),multiplier:data.fee_multiplier as number,rate:data.fee_type==='quadratic'?0:Math.ceil(175*(data.fee_multiplier as number)),observedAt:now,expiresAt:now+120000,source:'https://kalshi.com/docs/kalshi-fee-schedule.pdf'};
}
export function usableMakerFee(p:MakerFeeProfile|undefined,series:string|undefined,takerRate:number|null,now:number){
 return !!p&&p.series===series&&[0.5,1].includes(p.multiplier)&&takerRate===700*p.multiplier&&p.observedAt<=now&&now+3000<p.expiresAt&&p.expiresAt<=p.observedAt+120000&&((p.feeType==='quadratic'&&p.rate===0)||(p.feeType==='quadratic_with_maker_fees'&&p.rate===Math.ceil(175*p.multiplier)));
}
