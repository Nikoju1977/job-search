'use strict';
const {publicConfig}=require('../lib/platform');
module.exports = function config(req,res) {
  if ((req.method || 'GET') !== 'GET') return res.status(405).json({error:'Méthode non autorisée'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    gmailConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
    googleClientId:process.env.GOOGLE_CLIENT_ID || '',
    ...publicConfig()
  });
};
