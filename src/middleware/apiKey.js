/**
 * API key authentication middleware.
 *
 * Keys are loaded from API_KEYS env var (comma-separated).
 * If no keys are configured, auth is disabled (open access).
 * Clients pass key via `x-api-key` header or `?api_key=` query param.
 */
function apiKeyAuth(req, res, next) {
  const raw = process.env.API_KEYS;
  if (!raw) return next(); // no keys configured — open access

  const validKeys = new Set(raw.split(',').map(k => k.trim()).filter(Boolean));
  if (validKeys.size === 0) return next();

  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) {
    return res.status(401).json({ error: 'API key required. Pass via x-api-key header or ?api_key= query param.' });
  }

  if (!validKeys.has(key)) {
    return res.status(403).json({ error: 'Invalid API key.' });
  }

  next();
}

module.exports = apiKeyAuth;
