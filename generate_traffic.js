/**
 * CampusConnect Lab 8 - Traffic Generator Script
 * 
 * Generates continuous synthetic API traffic through the Kubernetes API Gateway
 * to populate Prometheus metrics and demonstrate Grafana dashboard panels:
 * 1. Target Reachability & Availability
 * 2. Traffic Rate (req/sec) across endpoints (/users, /products, /orders, /health)
 * 3. Error Rate (4xx / 5xx) with controlled simulated client/server errors
 * 4. Latency / Response Time monitoring
 */

const http = require('http');

const GATEWAY_HOST = process.env.GATEWAY_HOST || 'localhost';
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10);
const REQUEST_COUNT = parseInt(process.argv[2] || '40', 10);
const DELAY_MS = parseInt(process.argv[3] || '200', 10);

console.log('===============================================================');
console.log('🚀 CampusConnect Lab 8 - Automated API Traffic Generator');
console.log(`🎯 Target Gateway: http://${GATEWAY_HOST}:${GATEWAY_PORT}`);
console.log(`📊 Total Requests per cycle: ${REQUEST_COUNT}`);
console.log(`⏱️  Request Interval: ${DELAY_MS} ms`);
console.log('===============================================================\n');

function makeRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: GATEWAY_HOST,
      port: GATEWAY_PORT,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'CampusConnect-Traffic-Generator/1.0',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          path: path,
          method: method,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'CONN_ERR',
        path: path,
        method: method,
        error: err.message,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'TIMEOUT',
        path: path,
        method: method,
        success: false
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTraffic() {
  const routes = [
    { method: 'GET', path: '/health', weight: 15 },
    { method: 'GET', path: '/users', weight: 30 },
    { method: 'GET', path: '/products', weight: 25 },
    { method: 'GET', path: '/orders', weight: 20 },
    { method: 'GET', path: '/invalid-endpoint-for-monitoring-test', weight: 5 }, // 404 client error simulation
    { method: 'POST', path: '/orders', body: { userId: 999999, productId: 101, quantity: 1 }, weight: 5 } // 404/400 simulated business error
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i <= REQUEST_COUNT; i++) {
    // Pick random route according to distribution
    const rand = Math.random() * 100;
    let acc = 0;
    let selected = routes[0];
    for (const r of routes) {
      acc += r.weight;
      if (rand <= acc) {
        selected = r;
        break;
      }
    }

    const result = await makeRequest(selected.method, selected.path, selected.body);
    if (result.success) {
      successCount++;
      console.log(`[Req #${i.toString().padStart(2, '0')}] ${result.method.padEnd(4)} ${result.path.padEnd(40)} -> HTTP ${result.status} (SUCCESS)`);
    } else {
      errorCount++;
      console.log(`[Req #${i.toString().padStart(2, '0')}] ${result.method.padEnd(4)} ${result.path.padEnd(40)} -> HTTP ${result.status} (EXPECTED / OBSERVED)`);
    }

    await sleep(DELAY_MS);
  }

  console.log('\n===============================================================');
  console.log('📈 Traffic Generation Completed!');
  console.log(`   - Total Requests: ${REQUEST_COUNT}`);
  console.log(`   - Successful (2xx/3xx): ${successCount}`);
  console.log(`   - Errors / Controlled (4xx/5xx): ${errorCount}`);
  console.log('   - Prometheus & Grafana metrics updated in real-time!');
  console.log('===============================================================\n');
}

runTraffic();
