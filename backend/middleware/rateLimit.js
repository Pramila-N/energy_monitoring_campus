/** Minimal in-memory sliding-window rate limiter (no external dependency). */
export function rateLimitCalls({ windowMs = 60000, max = 5 } = {}) {
  const hits = new Map();
  const pruneEvery = 600000;
  let lastPrune = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - lastPrune > pruneEvery) {
      for (const [k, times] of hits) {
        if (times[times.length - 1] && now - times[times.length - 1] > pruneEvery) hits.delete(k);
      }
      lastPrune = now;
    }
    const key = req.admin?._id?.toString() || req.ip;
    const times = (hits.get(key) || []).filter((t) => now - t < windowMs);
    times.push(now);
    hits.set(key, times);
    if (times.length > max) {
      return res.status(429).json({ message: 'Too many call requests. Please wait a minute before trying again.' });
    }
    next();
  };
}

export default rateLimitCalls;