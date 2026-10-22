'use strict';
const {getJobs} = require('../lib/jobs');
module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') return res.status(405).json({error: 'Méthode interdite'});
  try {
    const data = await getJobs(req.query || {});
    res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({error: 'Récupération des offres indisponible', jobs: [], count: 0, partial: true});
  }
};