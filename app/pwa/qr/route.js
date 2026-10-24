import QRCode from 'qrcode';
import {siteOrigin} from '../../../lib/modules/pwa/profile.mjs';
import {publicShareOrigin} from '../../../shared/sharing.mjs';
export const runtime='nodejs';
export async function GET(request){return new Response(await QRCode.toBuffer(publicShareOrigin(process.env.NEXT_PUBLIC_SITE_URL)||siteOrigin(request),{width:320,margin:3,errorCorrectionLevel:'M'}),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}})}
