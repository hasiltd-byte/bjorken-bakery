import {moduleError} from '../core/registry.mjs';
// No network calls, fake receipts or automatic deliveries are implemented here.
export const paymentProvider={status:'blocked_until_provider_connected',async charge(){throw moduleError('ספק סליקה לא מחובר.',503)},async refund(){throw moduleError('החזר אוטומטי דורש ספק סליקה מאומת.',503)}};
export const notificationProvider={status:'blocked_until_provider_connected',async send(){throw moduleError('שליחת Push / WhatsApp / SMS אוטומטית אינה מחוברת.',503)}};
export const routingProvider={status:'manual_input_only'};
