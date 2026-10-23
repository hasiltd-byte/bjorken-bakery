// Adapted from Cotta orders-app/models.mjs. No tables, diners or reservations.
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
const {Schema}=mongoose,opts={versionKey:false,id:false,bufferCommands:false};
export function createModels(connection){
 const product=new Schema({_id:String,id:{type:String,unique:true,required:true},name:String,en:String,description:String,price:{type:Number,default:null,min:0.01},salePrice:{type:Number,default:null,min:0.01},category:String,image:{type:String,maxlength:2048},gallery:{type:[String],default:[]},tags:[String],illustrative:Boolean,deleted:Boolean,hidden:Boolean,sortOrder:Number,revision:Number,available:Boolean,stock:{type:Number,default:null,min:0},maxPerOrder:{type:Number,min:1,max:100},sku:String},opts);
 const session=new Schema({_id:String,token:{type:String,unique:true},expiresAt:Date},opts);session.index({expiresAt:1},{expireAfterSeconds:0});
 const order=new Schema({_id:{type:String,default:randomUUID},id:{type:String,unique:true},nonce:{type:String,unique:true},payload:Schema.Types.Mixed,status:{type:String,enum:['pending_confirmation','confirmed','preparing','ready','collected','declined','cancelled']},created_at:Number,updated_at:Number,priceConfirmed:Boolean,availabilityConfirmed:Boolean,payment:{type:String,enum:['at_pickup']},reserved:Boolean},opts);
 return Object.fromEntries(Object.entries({MenuItem:product,StaffSession:session,Order:order,Config:new Schema({_id:String,key:{type:String,unique:true},value:String},opts),MutationLock:new Schema({_id:String,version:Number},opts),Counter:new Schema({_id:String,value:Number},opts)}).map(([k,v])=>[k,connection.models[k]||connection.model(k,v)]));
}
