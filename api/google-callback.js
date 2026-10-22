'use strict';
// OAuth callback is implemented server-side; connections disabled until configured.
module.exports=async(req,res)=>{res.statusCode=503;res.end('Service OAuth non configure');};
