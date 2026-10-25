import DeliveryPublic from '../../../modules/DeliveryPublic';
export default async function Page({params}:{params:Promise<{token:string}>}){return <DeliveryPublic token={(await params).token}/>}
