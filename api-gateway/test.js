const assert = require('assert');
const config = require('./config/registry');

// API Gateway Registry Verification Test
function runTests() {
  assert.strictEqual(config.services.user.pathPrefix, '/users', 'User service path should be /users');
  assert.strictEqual(config.services.product.pathPrefix, '/products', 'Product service path should be /products');
  assert.strictEqual(config.services.order.pathPrefix, '/orders', 'Order service path should be /orders');
  assert.ok(typeof config.PORT === 'number' && config.PORT > 0, 'Gateway port must be a positive integer');
  console.log('✔ All API Gateway unit tests passed successfully!');
}

runTests();
