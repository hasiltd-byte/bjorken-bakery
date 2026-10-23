import PublicPortal from '../../../modules/PublicPortal';
export default async function Page({params}:{params:Promise<{token:string}>}){return <PublicPortal kind="manage" token={(await params).token}/>}
