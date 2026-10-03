require('dotenv').config();

/**
 * Service Registry Configuration
 * 
 * Defines routing endpoints and backend microservice targets.
 * Externalized from route-handling code to enable configuration-driven
 * service discovery (Part B).
 */
const config = {
  PORT: parseInt(process.env.GATEWAY_PORT || process.env.PORT || '8080', 10),
  ENV: process.env.NODE_ENV || 'development',
  services: {
    user: {
      name: 'User Service',
      url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      pathPrefix: '/users',
      description: 'Student & User profiles management'
    },
    product: {
      name: 'Product Service',
      url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      pathPrefix: '/products',
      description: 'Campus courses, textbooks & stationery management'
    },
    order: {
      name: 'Order Service',
      url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
      pathPrefix: '/orders',
      description: 'Order processing and inter-service orchestration'
    }
  }
};

module.exports = config;
