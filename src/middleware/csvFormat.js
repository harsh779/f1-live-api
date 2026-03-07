/**
 * CSV format middleware.
 * When `?format=csv` is present, intercepts res.json() and converts
 * the top-level array (or a known array field) to CSV.
 */
function csvFormat(req, res, next) {
  if (req.query.format !== 'csv') return next();

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    const rows = extractRows(data);
    if (!rows || rows.length === 0) {
      return originalJson(data); // fallback to JSON if no tabular data
    }

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="data.csv"');
    return res.send(csv);
  };

  next();
}

/** Find the best array of objects in the response to turn into CSV rows. */
function extractRows(data) {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    return data;
  }
  // Look for common array fields: drivers, standings, results, sessions
  for (const key of ['drivers', 'standings', 'results', 'sessions']) {
    if (Array.isArray(data?.[key]) && data[key].length > 0) {
      return data[key];
    }
  }
  return null;
}

/** Convert array of objects to CSV string. Flattens one level of nesting. */
function toCsv(rows) {
  const allKeys = new Set();
  const flatRows = rows.map(row => {
    const flat = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [sk, sv] of Object.entries(v)) {
          const key = `${k}_${sk}`;
          flat[key] = sv;
          allKeys.add(key);
        }
      } else if (Array.isArray(v)) {
        flat[k] = JSON.stringify(v);
        allKeys.add(k);
      } else {
        flat[k] = v;
        allKeys.add(k);
      }
    }
    return flat;
  });

  const headers = [...allKeys];
  const lines = [headers.join(',')];

  for (const row of flatRows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

module.exports = csvFormat;
