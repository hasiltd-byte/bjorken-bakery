import {randomBytes,createHash} from 'node:crypto';
import {moduleError} from './registry.mjs';
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const secret=()=>randomBytes(24).toString('hex');
export function text(value,min=0,max=300){if(typeof value!=='string'||value.trim().length<min||value.length>max)throw moduleError('בדקו את שדות הטקסט.');return value.trim()}
export function integer(value,min=0,max=100000000){if(!Number.isSafeInteger(value)||value<min||value>max)throw moduleError('ערך מספרי אינו תקין.');return value}
export function cents(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||Math.abs(value*100-Math.round(value*100))>1e-6)throw moduleError('סכום לא תקין.');return integer(Math.round(value*100))}
export function dateTime(value){if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw moduleError('יש להזין מועד עם אזור זמן.');return new Date(value).toISOString()}
export const publicRecord=row=>({id:row.key,revision:row.revision,createdAt:row.createdAt,...row.data});
