import QRCode from 'qrcode';
import {siteOrigin} from '../../../lib/modules/pwa/profile.mjs';
export const runtime='nodejs';
export async function GET(request){return new Response(await QRCode.toBuffer(siteOrigin(request),{width:320,margin:3,errorCorrectionLevel:'M'}),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}})}
