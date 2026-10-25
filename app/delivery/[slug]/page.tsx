import DeliveryPublic from '../../modules/DeliveryPublic';
export default async function Page({params}:{params:Promise<{slug:string}>}){return <DeliveryPublic slug={(await params).slug}/>}
