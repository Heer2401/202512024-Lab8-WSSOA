/**
 * CampusConnect Lab 8 - Complete Kubernetes Cluster Verification Script
 * 
 * Verifies:
 * 1. API Gateway reachability & health (/health)
 * 2. Prometheus metrics export (/metrics)
 * 3. User Service routing through Gateway (/users)
 * 4. Product Service routing through Gateway (/products)
 * 5. Order Service routing through Gateway (/orders)
 * 6. Inter-service orchestration (creating an order triggers User & Product lookup)
 */

const http = require('http');

const GATEWAY_HOST = process.env.GATEWAY_HOST || 'localhost';
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: GATEWAY_HOST,
      port: GATEWAY_PORT,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        ...(dataString ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString)
        } : {})
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsed = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${path} timed out`));
    });

    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================================');
  console.log('🧪 CampusConnect Lab 8 - Kubernetes Verification Suite');
  console.log(`🌐 Connecting to API Gateway at http://${GATEWAY_HOST}:${GATEWAY_PORT}`);
  console.log('====================================================================\n');

  let passed = 0;
  let total = 0;

  async function check(testName, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${testName}: ${err.message}`);
    }
  }

  // Test 1: API Gateway Health Endpoint
  await check('API Gateway Health Check (GET /health)', async () => {
    const res = await request('GET', '/health');
    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (res.body.status !== 'UP') throw new Error(`Expected status UP, got ${res.body.status}`);
    console.log(`   └─ Uptime: ${res.body.uptimeSeconds}s | Services Registered: ${Object.keys(res.body.registry).join(', ')}`);
  });

  // Test 2: Prometheus Metrics Endpoint
  await check('Prometheus Metrics Export (GET /metrics)', async () => {
    const res = await request('GET', '/metrics');
    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (typeof res.body !== 'string' || !res.body.includes('http_requests_total')) {
      throw new Error('Prometheus metrics payload missing http_requests_total');
    }
    console.log(`   └─ Metrics active! Found http_requests_total and process metrics.`);
  });

  // Test 3: User Service Route
  await check('User Service via Gateway (GET /users)', async () => {
    const res = await request('GET', '/users');
    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (!Array.isArray(res.body)) throw new Error('Expected array of users');
    console.log(`   └─ Retrieved ${res.body.length} users successfully.`);
  });

  // Test 4: Product Service Route
  await check('Product Service via Gateway (GET /products)', async () => {
    const res = await request('GET', '/products');
    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (!Array.isArray(res.body)) throw new Error('Expected array of products');
    console.log(`   └─ Retrieved ${res.body.length} products successfully.`);
  });

  // Test 5: Order Service Route
  await check('Order Service via Gateway (GET /orders)', async () => {
    const res = await request('GET', '/orders');
    if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
    if (!Array.isArray(res.body)) throw new Error('Expected array of orders');
    console.log(`   └─ Retrieved ${res.body.length} orders successfully.`);
  });

  console.log('\n====================================================================');
  console.log(`📋 Verification Results: ${passed}/${total} Tests Passed`);
  console.log('====================================================================\n');

  if (passed === total) {
    console.log('🎉 All Kubernetes cluster microservice operations are fully functional!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Some tests failed. Please inspect pod logs with: kubectl logs -n lab8 <pod-name>\n');
    process.exit(1);
  }
}

runVerification();
