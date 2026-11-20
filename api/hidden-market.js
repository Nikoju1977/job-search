'use strict';
const {searchMarket}=require('../lib/hidden-market');
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Méthode non autorisée.'});
  try{
    return res.status(200).json(await searchMarket(req.query||{}));
  }catch(error){
    const status=error.status||((/^SOURCE_HTTP_|SOURCE|LOCALISATION|FORMAT_/.test(error.message))?502:500);
    return res.status(status).json({
      error:status===400||status===404?error.message:'Les registres officiels sont temporairement indisponibles. Réessayez plus tard.',
      companies:[],count:0,unavailable:true
    });
  }
};