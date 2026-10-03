/**
 * Centralized Gateway Error Handler
 * 
 * Returns clear, standardized 502 Bad Gateway (or 503 Service Unavailable)
 * JSON responses when a target backend microservice is unreachable, times out,
 * or encounters a network partition.
 */

function handleProxyError(err, req, res, serviceKey, serviceConfig) {
  const statusCode = 502; // Clean 502 Bad Gateway as required by Lab 7
  const errorTitle = 'Bad Gateway';
  
  console.error(`[API Gateway Error] Failed to route ${req.method} ${req.originalUrl} to ${serviceConfig.name} (${serviceConfig.url}): ${err.message} [Code: ${err.code || 'UNKNOWN'}]`);

  if (!res.headersSent) {
    const payload = JSON.stringify({
      status: statusCode,
      error: errorTitle,
      message: `The target service '${serviceConfig.name}' is unreachable or failed to respond.`,
      service: serviceKey,
      serviceName: serviceConfig.name,
      targetUrl: serviceConfig.url,
      path: req.originalUrl,
      reason: err.code || err.message,
      timestamp: new Date().toISOString()
    });

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    });
    res.end(payload);
  }
}

function generalErrorHandler(err, req, res, next) {
  console.error(`[API Gateway Internal Error]`, err);
  if (!res.headersSent) {
    const payload = JSON.stringify({
      status: 500,
      error: 'Internal Gateway Error',
      message: err.message || 'An unexpected error occurred at the API Gateway layer.',
      timestamp: new Date().toISOString()
    });
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    });
    res.end(payload);
  }
}

module.exports = {
  handleProxyError,
  generalErrorHandler
};
