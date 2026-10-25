# העברת מודולי הפיילוט לליבת HASI

הפיילוט נבנה בתוך Björken, לעסק יחיד. לא נבנו כאן אתר HASI, מערכת מכירת אתרים או פלטפורמת Multi-tenant מלאה. מודולים אופציונליים כבויים כברירת מחדל; החנות והמנהל הקיימים נשמרו.

## גבולות הקוד

| רכיב | קוד שרת / תחום | ממשק |
| --- | --- | --- |
| רישוי והרשאות | `lib/modules/core/registry.mjs`, `store.mjs`, `validation.mjs`, `lib/modules/service.mjs` | `app/modules/Workspace.tsx`, `StaffPanel.tsx` |
| Orders Core | `lib/modules/orders/core.mjs`, `service.mjs`, `shared/modules/order-state.mjs` | `OrdersPanel.tsx`, `/track/[token]` |
| Food Pro | נתיבי `/food` ב־`orders/service.mjs` | `FoodPanel.tsx` |
| Group Delivery | `lib/modules/delivery/domain.mjs`, `service.mjs` | `DeliveryPanel.tsx`, `DeliveryPublic.tsx` |
| Club / Reviews | `lib/modules/club/service.mjs` | `ClubPanel.tsx`, `PublicPortal.tsx` |
| דוחות | `lib/modules/reports/service.mjs` | `ReportsPanel.tsx` |
| ספקים חסומים | `lib/modules/adapters/providers.mjs` | מצב חיבורים בסקירה |
| PWA | `lib/modules/pwa/profile.mjs`, `app/manifest.ts`, `public/sw.js` | `/install`, `/pwa/qr` |

## חוזי התלות

`createModuleService` מקבל `db`, `businessId`, קורא JSON מאומת, resolver לזהות עובד ו־rate limiter. מודולי התחום מקבלים context עם `store`, `space`, `grants`, `actor`, `catalog`, `request` ו־`json`. אין גישה ל־env של HASI מתוך רכיבי התצוגה.

`scopedStore(db, businessId, space)` מוסיף תמיד businessId ומצב `live/demo` לכל קריאה וכתיבה. `ModuleRecord` מחזיק מסלולים, בקשות קבוצתיות, זיכויים, ייצור, מועדון, קופונים ומשוב. מזהי לקוח מהבקשה אינם קובעים businessId. היסטוריה ו־audit שומרים זמן ומפעיל. סכומי מודולים נשמרים באגורות.

Orders Core משתמש במתאם ל־`Order` הקיים כדי שהזמנות החנות יופיעו במסכי העבודה. נתוני הדמו נמצאים ב־ModuleRecord נפרד ואינם יוצרים Orders אמיתיים או משנים את MenuItem. נעילת טרנזקציות MongoDB קיימת נשמרה לשריון מלאי ולמניעת write skew.

## סדר העברה מומלץ

1. העבירו את קוד התחום של `lib/modules` ואת מילון הסטטוסים לחבילות משותפות. החליפו את `db` ואת מתאם הקטלוג באמצעות חוזי ה־context; הריצו את בדיקות התחום לפני חיבור עסק נוסף.
2. ספקו businessId מתוך resolver מאומת של HASI. אין לקבל tenantId מתוך טופס/פרמטר לקוח. במאפייה Config, MenuItem וחלק ממסלולי התאימות הם לעסק יחיד במסד ייעודי; בליבה יש להחליפם במאגרים מודעי־tenant. אין להפעיל את bootstrap המאפייה על מסד רב־עסקי.
3. החליפו את כניסת ה־owner מהסביבה ב־auth של HASI. תפקידי העובדים והרישיונות נשארים בשירות שרת. Food Pro מעניק Orders Pro; Group Delivery ו־Club עצמאיים ממנו.
4. החליפו את `profile.mjs` ואת נכסי האייקון/manifest ב־brand adapter. עדכנו prefix של cache ומדיניות scope לכל דומיין/תת־דומיין. שירות העובד הנוכחי אינו שומר API, HTML של לקוחות, ניהול או תשלום.
5. חברו PSP רק עם אימות webhook, חתימות ו־idempotency. מתאם החיוב וההחזר הנוכחי מחזיר שגיאה חסומה. מצב ידני כולל אסמכתא ואימות מפורש ואינו receipt של ספק.
6. חברו Push / WhatsApp / SMS רק לאחר הרשאות, הסכמה וחיבור מאומת. כרגע אין שליחת הודעות אוטומטית. לפני ריבוי מופעים החליפו rate limiter בזיכרון במאגר משותף.
7. העבירו רכיבי React מ־`app/modules`, התאימו ניווט ותרגומים, והריצו `tests/modules.test.mjs`, `pilot-hardening.test.mjs`, `pilot-shop.test.mjs` ובדיקות הדפדפן.

## מה לא להעביר כחבילת קוד

אין להעתיק `.env*`, `.local`, `.qa`, סיסמאות, session tokens, קובצי מסד, נתוני לקוחות/הזמנות, אסמכתאות או קישורי מעקב אמיתיים. השתמשו רק ב־fixtures מדומים. תמונות Björken ומיתוג העסק אינם נכסים כלליים ללקוחות אחרים; יש להחליפם בהתאם לזכויות.

## קישורים והפעלה מקומית

`npm run preview:pilot` מפעיל MongoDB מקומי נפרד ב־27029, מסד `bjorken_pilot`, וקבצים ב־`.local/hasi-pilot-mongo`. הוא דורס את כתובות Mongo לתהליך בלבד; אינו מתחבר ל־Atlas. ההתחברות משתמשת בפרטי המנהל המקומיים, בלי להציגם בלוג. הבקשות הרגילות ל־WhatsApp נשארות Preview. ב־`/admin/modules` בחרו **הדגמה מבודדת**.

`npm run test:pilot` בודק את המודולים מול מסד זמני נפרד ו־Chrome. `npm run test:browser` שומר על מסלולי הרגרסיה של שלושת העיצובים, החנות והמנהל. שתי הבדיקות אינן שולחות הודעות או גובות כסף.
