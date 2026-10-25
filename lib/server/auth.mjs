import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {moduleError} from '../modules/core/registry.mjs';
export function strongPassword(value){return typeof value==='string'&&value.length>=12&&value.length<=200&&/[a-zA-Zא-ת]/.test(value)&&/[^a-zA-Zא-ת]/.test(value)&&!/^(.)(\1)+$/.test(value)}
export function passwordFields(password){if(!strongPassword(password))throw moduleError('בחרו סיסמה בת 12 תווים לפחות, עם אותיות ומספר או סימן.');const salt=randomBytes(16).toString('hex');return {salt,passwordHash:scryptSync(password,salt,64).toString('hex')}}
export function verifyPassword(password,record){if(typeof password!=='string'||!record?.salt||!record?.passwordHash)return false;const actual=scryptSync(password,record.salt,64),expected=Buffer.from(record.passwordHash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}
export async function ownerAuth(db,businessId){return JSON.parse(await db.getConfig('hasi:'+businessId+':ownerAuth','null'))}
