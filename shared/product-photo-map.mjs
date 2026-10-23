// Product identity for the honey cake was explicitly confirmed by the user.
export const productPhotoMap={
 cinnamon:{photos:[16]},sticky:{photos:[18,6]},pesto:{photos:[9,4]},bagel:{photos:[19,13]},cardamom:{photos:[10]},carrot:{photos:[12]},
 yeast:{photos:[2],name:'עוגת דבש',en:'SOMETHING GOLDEN'},cake:{photos:[1,7]},cookie:{photos:[8]},friday:{photos:[15,17,20,14,11,5]}
};
export const preparedPhotoPath=(id,index=0)=>'/images/product-'+id+'-v3'+(index?'-'+index:'')+'.webp';
