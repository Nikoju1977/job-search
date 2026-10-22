'use strict';
const {ApiError}=require('./platform');
let cached;
function db(){
 const url=process.env.DATABASE_URL;
 if(!url)throw new ApiError(503,'Le moteur autonome attend une base PostgreSQL configurée.');
 if(!/^postgres(ql)?:\/\//i.test(url))throw new ApiError(503,'URL PostgreSQL incorrecte.');
 if(!cached||cached.url!==url){
  const {neon}=require('@neondatabase/serverless');
  cached={url,sql:neon(url)};
 }
 return cached.sql;
}
async function query(statement,args=[]){return db().query(statement,args);}
module.exports={db,query};