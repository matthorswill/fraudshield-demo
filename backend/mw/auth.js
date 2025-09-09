// backend/mw/auth.js
const crypto = require('crypto');

function base64urlDecode(str){ return Buffer.from(String(str).replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'); }
function verifyJwt(token, secret){
  try {
    const [h,p,s] = String(token||'').split('.'); if(!h||!p||!s) return null;
    const data = `${h}.${p}`;
    const sig = crypto.createHmac('sha256', String(secret||''))
      .update(data).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (sig !== s) return null;
    const payload = JSON.parse(base64urlDecode(p));
    if (payload.exp && Date.now()/1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function requireAuth(req,res,next){
  const hdr = req.headers['authorization']||''; const tok = hdr.startsWith('Bearer ')? hdr.slice(7): null;
  const jwt = verifyJwt(tok, process.env.JWT_SECRET || 'dev-secret');
  if (!jwt) return res.status(401).json({ error: 'unauthorized' });
  req.user = { id: jwt.sub, role: jwt.role || 'Viewer', email: jwt.email };
  next();
}

function requireRole(...roles){
  return (req,res,next)=>{
    if (!req.user) return res.status(401).json({ error:'unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error:'forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };

