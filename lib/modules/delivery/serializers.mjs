// Explicit allowlists: never serialize a stored route directly to a delivery role.
export const stopDto = ({id,area,address,date,from,to}) => ({id,area,address,date,from,to});
export function routeDto(row, role) {
 const d=row.data;
 const delivery={id:row.key,revision:row.revision,slug:d.slug,title:d.title,stops:d.stops.map(stopDto),noShowPolicy:d.noShowPolicy};
 if(role==='driver')return delivery;
 return {...delivery,createdAt:row.createdAt,closeAt:d.closeAt,minimumCents:d.minimumCents,activationCents:d.activationCents,freeShippingCents:d.freeShippingCents,shippingCents:d.shippingCents,redeliveryFeeCents:d.redeliveryFeeCents,paymentMode:d.paymentMode,paymentPolicy:d.paymentPolicy,driverUsername:d.driverUsername,calculator:d.calculator||null};
}
export function driverOrderDto(row){const d=row.data;return {id:row.key,revision:row.revision,name:d.name,phone:d.phone,collector:d.collector,stopId:d.stopId,items:d.items.map(({name,quantity})=>({name,quantity})),status:d.status,paymentVerified:true}}
export function managerOrderDto(row){const d=row.data;return {id:row.key,revision:row.revision,routeSlug:d.routeSlug,stopId:d.stopId,name:d.name,phone:d.phone,collector:d.collector,items:d.items.map(({id,name,quantity,priceCents})=>({id,name,quantity,priceCents})),subtotalCents:d.subtotalCents,shippingCents:d.shippingCents,totalCents:d.totalCents,status:d.status,payment:d.payment,reserved:d.reserved,timeline:d.timeline,returnNote:d.returnNote,rescheduled:d.rescheduled}}
