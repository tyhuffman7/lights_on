import {discover,suggest} from '@/lib/arb/adapters';import {user,reply,error} from '@/lib/api';
export async function GET(){try{await user();const d=await discover();return reply({...d,suggestions:suggest(d)});}catch(e){return error(e);}}
