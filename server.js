'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const routes = {'/api/jobs':require('./api/jobs'),'/api/config':require('./api/config'),'/api/letter':require('./api/letter'),'/api/reply-agent':require('./api/reply-agent'),'/api/account':require('./api/account'),'/api/auth':require('./api/auth'),'/api/applications':require('./api/applications')};
const PUBLIC_DIR = path.join(__dirname, 'public');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (routes[url.pathname]) {
    res.status = function(n){res.statusCode=n;return res};
    res.json = function(obj){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj));return res};
    req.query = Object.fromEntries(url.searchParams.entries());
    res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method==='POST') {
      let data='';let size=0;
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 160000) {res.writeHead(413);return res.end('Requête trop volumineuse');}
          data += chunk.toString('utf8');
        }
        req.body=JSON.parse(data||'{}');
      } catch {res.writeHead(400);return res.end('JSON invalide');}
    }
    return routes[url.pathname](req,res);
  }
  const route = url.pathname === '/' ? '/index.html' : url.pathname;
  const filepath = path.resolve(PUBLIC_DIR, '.'+route);
  if (!filepath.startsWith(PUBLIC_DIR + path.sep)) {res.writeHead(403);return res.end();}
  fs.readFile(filepath, (err, bytes) => {
    if (err) {res.writeHead(404, {'Content-Type':'text/plain'});return res.end('404');}
    res.writeHead(200, {'Content-Type':mime[path.extname(filepath)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(bytes);
  });
}).listen(port, () => console.log(`Niko Emploi : http://localhost:${port}`));