/**
 * Gateway Request Logging Middleware
 * 
 * Logs incoming request details: method, original URL, target service,
 * status code, response time in ms, and timestamp.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  // Intercept completion to log final status and duration
  res.end = function (...args) {
    const duration = Date.now() - start;
    const targetService = req.targetService || 'Gateway (Local)';
    const status = res.statusCode;
    
    // Status color/indicator
    const statusBadge = status >= 500 ? '❌ 5xx' : status >= 400 ? '⚠️ 4xx' : status >= 300 ? 'ℹ️ 3xx' : '✅ 2xx';

    console.log(`[API Gateway] ${new Date().toISOString()} | ${req.method} ${req.originalUrl} -> [${targetService}] -> Status: ${status} (${statusBadge}) | Duration: ${duration}ms`);

    return originalEnd.apply(this, args);
  };

  next();
}

module.exports = requestLogger;
