// A live process is not proof that its market observer is still operating.
export function enforcePaperObserverHealth(bot:{failed:boolean;document:{halt:string|null};flush:()=>void},observer:{paused:boolean;stopped:boolean;failureReason?:string|null;recorder:{failed:boolean};pause:()=>void},requestStop:()=>void,stopping=false){
 if(stopping)return null;
 const reason=observer.recorder.failed?'PAPER_OBSERVER_PERSISTENCE_FAILED':observer.failureReason?`PAPER_OBSERVER_${observer.failureReason}`:observer.stopped?'PAPER_OBSERVER_STOPPED_UNEXPECTEDLY':observer.paused?'PAPER_OBSERVER_PAUSED_UNEXPECTEDLY':null;
 if(!reason)return null;
 bot.failed=true;bot.document.halt??=reason;
 try{bot.flush();}finally{observer.pause();requestStop();}
 return reason;
}
