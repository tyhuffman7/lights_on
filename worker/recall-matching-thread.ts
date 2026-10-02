import {parentPort,workerData} from 'node:worker_threads';
import {recallMatches} from '../lib/research/recall-detector.ts';
parentPort!.postMessage(recallMatches(workerData.kalshi,workerData.poly));
