const buckets = new Map();

const createAuthRateLimit = ({ windowMs = 15 * 60 * 1000, max = 10 } = {}) =>
  (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau",
      });
    }

    bucket.count += 1;
    next();
  };

module.exports = { createAuthRateLimit };
