/**
 * Deep-merges F1's differential updates into existing state.
 *
 * F1 only sends CHANGED fields per update — never the full object.
 * We must maintain running state and merge each patch into it.
 *
 * F1 also sometimes encodes arrays as objects with numeric string keys:
 * {"0": a, "1": b} instead of [a, b]. We normalise those too.
 */
function deepMerge(target, patch) {
  if (patch === null || patch === undefined) return target;

  // Primitive replacement
  if (typeof patch !== 'object' || Array.isArray(patch)) return patch;

  const result = Object.assign({}, target);

  for (const key of Object.keys(patch)) {
    const patchVal = patch[key];
    const targetVal = result[key];

    if (
      patchVal !== null &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, patchVal);
    } else {
      result[key] = patchVal;
    }
  }

  return result;
}

/**
 * F1 sometimes sends arrays as {"0": x, "1": y} objects.
 * Convert those to real arrays where appropriate.
 */
function normaliseArrays(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;

  const keys = Object.keys(obj);
  const allNumeric = keys.length > 0 && keys.every(k => /^\d+$/.test(k));

  if (allNumeric) {
    const arr = [];
    keys.forEach(k => { arr[parseInt(k)] = normaliseArrays(obj[k]); });
    return arr;
  }

  const result = {};
  for (const k of keys) result[k] = normaliseArrays(obj[k]);
  return result;
}

module.exports = { deepMerge, normaliseArrays };
