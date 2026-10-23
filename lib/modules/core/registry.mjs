export const registry={shop:{base:true},pwa:{base:true},ordersPro:{},foodPro:{includes:['ordersPro']},groupDelivery:{internal:['ordersCore']},club:{},reviews:{}};
export const businessPresets={bakery:['shop','pwa','ordersPro','foodPro','groupDelivery','club','reviews'],retail:['shop','pwa','ordersPro','groupDelivery','club','reviews'],pizza:['shop','pwa','ordersPro','foodPro'],restaurant:['shop','pwa','ordersPro','foodPro'],foodTruck:['shop','pwa','ordersPro','foodPro'],service:['pwa','club','reviews'],florist:['shop','pwa','groupDelivery','club','reviews'],giftShop:['shop','pwa','groupDelivery','club','reviews']};
export const roles=['admin','manager','cashier','kitchen','driver'];
export const moduleError=(message,status=400)=>Object.assign(Error(message),{status});
export function effectiveLicense(grant={},now=Date.now()){
 const status=grant.status||'disabled';if(!['demo','trial','active','expired','disabled'].includes(status))return 'disabled';
 if(['trial','active'].includes(status)&&grant.expiresAt&&Date.parse(grant.expiresAt)<=now)return 'expired';
 if(status==='trial'&&(!grant.expiresAt||!Number.isFinite(Date.parse(grant.expiresAt))))return 'expired';return status;
}
export function featureState(grants,feature,space='live',now=Date.now()){
 if(!registry[feature])return {status:'disabled',allowed:false};if(registry[feature].base)return {status:'active',allowed:true};
 let status=effectiveLicense(grants[feature],now);
 if(feature==='ordersPro'){const included=effectiveLicense(grants.foodPro,now);if(!['active','trial'].includes(status)&&['active','trial','demo'].includes(included))status=included}
 return {status,allowed:space==='demo'?['demo','active','trial'].includes(status):['active','trial'].includes(status)};
}
export function requireFeature(grants,feature,space){if(!featureState(grants,feature,space).allowed)throw moduleError('המודול אינו פעיל במצב שנבחר.',403)}
export function requireRole(actor,allowed){if(!actor)throw moduleError('יש להתחבר.',401);if(!allowed.includes(actor.role))throw moduleError('אין הרשאה לפעולה זו.',403)}
export function spaceFrom(url){const space=url.searchParams.get('space')||'live';if(!['live','demo'].includes(space))throw moduleError('מצב עבודה לא תקין.');return space}
