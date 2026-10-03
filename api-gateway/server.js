require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config/registry');
const requestLogger = require('./middleware/logger');
const { handleProxyError, generalErrorHandler } = require('./middleware/errorHandler');

const client = require('prom-client');

// Collect default system metrics (CPU, heap memory, process uptime)
client.collectDefaultMetrics({ prefix: 'campusconnect_' });

// HTTP Request Counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed by API Gateway',
  labelNames: ['method', 'route', 'status']
});

// HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const app = express();

// Enable CORS
app.use(cors());

// Prometheus Metrics Middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const elapsed = process.hrtime(start);
    const durationInSeconds = elapsed[0] + elapsed[1] / 1e9;

    let route = req.baseUrl || req.path || 'unknown';
    if (route.startsWith('/users')) route = '/users';
    else if (route.startsWith('/products')) route = '/products';
    else if (route.startsWith('/orders')) route = '/orders';
    else if (route === '/health') route = '/health';
    else if (route === '/metrics') route = '/metrics';
    else route = 'other';

    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status: res.statusCode.toString()
    });

    httpRequestDurationSeconds.observe({
      method: req.method,
      route: route,
      status: res.statusCode.toString()
    }, durationInSeconds);
  });
  next();
});

// Attach request logger for all incoming traffic
app.use(requestLogger);

/**
 * Prometheus Metrics Scrape Endpoint
 * GET /metrics
 */
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

/**
 * Gateway Health Check Endpoint
 * GET /health
 * 
 * Reports status of the API Gateway itself and its registered upstream service locations.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    registry: {
      userService: config.services.user.url,
      productService: config.services.product.url,
      orderService: config.services.order.url
    }
  });
});

/**
 * Gateway Root Overview Endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'CampusConnect API Gateway',
    description: 'Centralized Entry Point for CampusConnect Microservices (Lab 7)',
    healthCheck: '/health',
    routes: {
      users: { prefix: '/users', target: config.services.user.url },
      products: { prefix: '/products', target: config.services.product.url },
      orders: { prefix: '/orders', target: config.services.order.url }
    },
    documentation: 'See README.md and Postman Collection'
  });
});

/**
 * Configure Reverse Proxy Routes based on Service Registry (Part B)
 * Service locations are never hardcoded here.
 */
Object.keys(config.services).forEach((serviceKey) => {
  const service = config.services[serviceKey];

  const proxyOptions = {
    target: service.url,
    changeOrigin: true,
    // Preserve the full original path including prefix (e.g. /users -> /users)
    pathRewrite: (path, req) => req.originalUrl,
    proxyTimeout: 4000,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Tag forwarded requests with custom gateway header
        proxyReq.setHeader('x-forwarded-by', 'CampusConnect-API-Gateway');
      },
      error: (err, req, res) => {
        handleProxyError(err, req, res, serviceKey, service);
      }
    }
  };

  // Register proxy middleware on the route prefix
  app.use(
    service.pathPrefix,
    (req, res, next) => {
      req.targetService = service.name;
      next();
    },
    createProxyMiddleware(proxyOptions)
  );

  console.log(`[API Gateway] Registered route: ${service.pathPrefix}/* -> ${service.url} (${service.name})`);
});

// Fallback 404 for unrouted paths
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `No gateway route configured for path: ${req.originalUrl}`,
    availableRoutes: ['/health', '/users', '/products', '/orders'],
    timestamp: new Date().toISOString()
  });
});

// Centralized error handler
app.use(generalErrorHandler);

// Start Gateway Server
const server = app.listen(config.PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 API Gateway active on http://localhost:${config.PORT}`);
  console.log(`📡 Registered Upstreams:`);
  console.log(`   - User Service:    ${config.services.user.url}`);
  console.log(`   - Product Service: ${config.services.product.url}`);
  console.log(`   - Order Service:   ${config.services.order.url}`);
  console.log(`   - Health Check:    http://localhost:${config.PORT}/health`);
  console.log(`====================================================`);
});

module.exports = { app, server };
