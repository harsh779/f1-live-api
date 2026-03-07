const rateLimit = require('express-rate-limit');

// Tiered rate limits
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 100,                // 100 requests per minute per IP
  standardHeaders: true,   // RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests — limit is 100/min. Use an API key for higher limits.' },
});

const sseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                 // 10 SSE connections per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many stream connections — limit is 10/min.' },
});

module.exports = { globalLimiter, sseLimiter };
