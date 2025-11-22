/**
 * Security Headers & CORS Configuration
 * Sessionably - HIPAA Compliant
 */

function getAllowedOrigins() {
  const origins = [
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'https://sessionably.com',
    'https://www.sessionably.com'
  ].filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000');
  }

  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }

  return origins;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  
  const allowed = getAllowedOrigins();
  
  if (allowed.includes(origin)) return true;
  
  if (origin.includes('.vercel.app') && origin.includes('sessionably')) return true;
  
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    console.warn(`[CORS] Blocked origin: ${origin}`);
    res.status(403).json({
      success: false,
      error: 'Origin not allowed',
      code: 'CORS_ERROR'
    });
    return { allowed: false };
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  return { allowed: true };
}

function setSecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.stripe.com https://api.anthropic.com https://*.vercel.app",
    "frame-src 'self' https://js.stripe.com",
    "frame-ancestors 'none'"
  ].join('; '));
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  res.setHeader('Permissions-Policy', [
    'camera=(self)',
    'microphone=(self)',
    'geolocation=()',
    'payment=(self)'
  ].join(', '));
  
  res.removeHeader('X-Powered-By');
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function setApiSecurityHeaders(res) {
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json');
}

function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    const corsResult = setCorsHeaders(req, res);
    if (corsResult.allowed) {
      res.status(200).end();
    }
    return true;
  }
  return false;
}

function setupSecurity(req, res) {
  setApiSecurityHeaders(res);
  
  const corsResult = setCorsHeaders(req, res);
  if (!corsResult.allowed) {
    return { allowed: false, reason: 'cors' };
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return { allowed: false, reason: 'preflight' };
  }
  
  return { allowed: true };
}

module.exports = {
  setCorsHeaders,
  setSecurityHeaders,
  setApiSecurityHeaders,
  handlePreflight,
  setupSecurity,
  isOriginAllowed,
  getAllowedOrigins
};
