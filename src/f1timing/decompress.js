const zlib = require('zlib');

/**
 * F1 sends compressed topics (e.g. CarData.z, Position.z) as:
 * base64-encoded → zlib raw-deflated → JSON string
 */
function decompress(data) {
  if (typeof data !== 'string') return data;
  try {
    const buf = Buffer.from(data, 'base64');
    const inflated = zlib.inflateRawSync(buf);
    return JSON.parse(inflated.toString('utf8'));
  } catch {
    // Some messages aren't compressed even on .z topics
    try { return JSON.parse(data); } catch { return data; }
  }
}

module.exports = { decompress };
