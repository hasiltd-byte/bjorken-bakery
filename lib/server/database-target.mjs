// Keep Bjorken isolated even when it shares an Atlas cluster with another app.
export function databaseName(uri,override){
 let name=override;
 if(!name){try{name=decodeURIComponent(new URL(uri).pathname.slice(1))}catch{throw Error('Invalid MongoDB connection string.')}}
 name ||= 'bjorken';
 if(!/^bjorken(?:[_-][a-z0-9_-]+)?$/i.test(name))throw Error('Choose a dedicated Bjorken database, for example bjorken_dev. Other application databases are not permitted.');
 return name;
}
