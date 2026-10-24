import {featureState,moduleError,requireRole} from './registry.mjs';
// One commercial policy. Base shop integrity never depends on these capabilities.
export const capabilityPolicy={
 productCosts:{features:['foodPro','groupDelivery','analytics'],roles:['admin','manager']},
 businessAnalytics:{features:['foodPro','analytics'],roles:['admin','manager']},
 routeProfitability:{features:['groupDelivery'],roles:['admin','manager']},
 orderReports:{features:['ordersPro','foodPro','analytics'],roles:['admin','manager']},
};
export function capabilityState(grants,capability,space='live',role){const policy=capabilityPolicy[capability];if(!policy)return {allowed:false,paid:true,grantedBy:[]};const grantedBy=policy.features.filter(feature=>featureState(grants,feature,space).allowed);return {allowed:grantedBy.length>0&&(!role||policy.roles.includes(role)),paid:true,grantedBy}}
export function requireCapability(ctx,capability){const policy=capabilityPolicy[capability];if(!policy)throw moduleError('יכולת לא קיימת.',404);requireRole(ctx.actor,policy.roles);if(!capabilityState(ctx.grants,capability,ctx.space,ctx.actor.role).allowed)throw moduleError('יכולת זו כלולה במודול מתקדם בתשלום ואינה פעילה ברישיון הנוכחי.',403)}
export function capabilitiesFor(grants,space,role){return Object.fromEntries(Object.keys(capabilityPolicy).map(key=>[key,capabilityState(grants,key,space,role)]))}
