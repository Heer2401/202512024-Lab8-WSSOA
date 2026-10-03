require('dotenv').config();

const express = require('express');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const Joi = require('joi');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

// Environment configuration
const rawPort = process.env.PORT || process.env.ORDER_SERVICE_PORT || '3003';
const PORT = rawPort.toString().includes('://') ? 3003 : parseInt(rawPort, 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/orderdb';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => {
  console.log(`[Order Service] Connected to MongoDB at ${MONGO_URI}`);
}).catch((err) => {
  console.error('[Order Service] MongoDB connection error:', err.message);
});

// Order Schema & Model
const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  userId: { type: Number, required: true },
  userDetails: {
    id: Number,
    name: String,
    email: String
  },
  productId: { type: Number, required: true },
  productDetails: {
    id: Number,
    name: String,
    price: Number,
    category: String
  },
  quantity: { type: Number, required: true, default: 1 },
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'CONFIRMED' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Order = mongoose.model('Order', orderSchema);

// Auto-increment ID helper
const getNextOrderId = async () => {
  const lastOrder = await Order.findOne().sort({ id: -1 });
  return lastOrder ? lastOrder.id + 1 : 1;
};

// Joi Validation Schema
const createOrderValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  userId: Joi.number().integer().positive().required(),
  productId: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().min(1).default(1)
});

// Swagger Documentation Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description: 'CampusConnect Order Microservice with Inter-Service Communication (Lab 6)'
    },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'order-service',
    port: PORT,
    dependencies: {
      userServiceUrl: USER_SERVICE_URL,
      productServiceUrl: PRODUCT_SERVICE_URL
    }
  });
});

// Helper for inter-service HTTP call with graceful error handling
async function fetchFromDependency(url, serviceName) {
  try {
    const response = await axios.get(url, { timeout: 3000 });
    return { success: true, data: response.data };
  } catch (err) {
    if (err.response) {
      if (err.response.status === 404) {
        return {
          success: false,
          statusCode: 404,
          error: `${serviceName} returned 404 Not Found`,
          details: err.response.data
        };
      }
      return {
        success: false,
        statusCode: 503,
        error: `${serviceName} returned error ${err.response.status}`,
        details: err.response.data
      };
    }
    // Network failure, connection refused, DNS error or timeout
    return {
      success: false,
      statusCode: 503,
      error: `${serviceName} unavailable`,
      details: err.message
    };
  }
}

// GET /orders - Retrieve all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({}, { _id: 0 }).sort({ id: 1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
});

// GET /orders/:id - Retrieve order by ID
app.get('/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    const order = await Order.findOne({ id }, { _id: 0 });
    if (!order) {
      return res.status(404).json({ error: `Order with ID ${id} not found` });
    }

    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order: ' + err.message });
  }
});

// POST /orders - Create order (Service-to-Service communication)
app.post('/orders', async (req, res) => {
  try {
    const { error, value } = createOrderValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { userId, productId, quantity = 1 } = value;

    // 1. Call User Service to validate user
    console.log(`[Order Service] Calling User Service at ${USER_SERVICE_URL}/users/${userId}...`);
    const userResult = await fetchFromDependency(
      `${USER_SERVICE_URL}/users/${userId}`,
      'User Service'
    );

    if (!userResult.success) {
      console.warn(`[Order Service] User validation failed (${userResult.statusCode}):`, userResult.error);
      return res.status(userResult.statusCode).json({
        error: userResult.error,
        service: 'User Service',
        details: userResult.details
      });
    }

    const user = userResult.data;

    // 2. Call Product Service to validate product
    console.log(`[Order Service] Calling Product Service at ${PRODUCT_SERVICE_URL}/products/${productId}...`);
    const productResult = await fetchFromDependency(
      `${PRODUCT_SERVICE_URL}/products/${productId}`,
      'Product Service'
    );

    if (!productResult.success) {
      console.warn(`[Order Service] Product validation failed (${productResult.statusCode}):`, productResult.error);
      return res.status(productResult.statusCode).json({
        error: productResult.error,
        service: 'Product Service',
        details: productResult.details
      });
    }

    const product = productResult.data;

    // 3. Verify stock
    if (product.stock !== undefined && product.stock < quantity) {
      return res.status(400).json({
        error: `Insufficient stock for product '${product.name}'. Available: ${product.stock}, requested: ${quantity}`
      });
    }

    // 4. Calculate total amount
    const totalAmount = Number((product.price * quantity).toFixed(2));
    const assignedId = value.id || (await getNextOrderId());

    // 5. Persist order
    const newOrder = new Order({
      id: assignedId,
      userId,
      userDetails: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      productId,
      productDetails: {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category
      },
      quantity,
      totalAmount,
      status: 'CONFIRMED'
    });

    await newOrder.save();
    const result = newOrder.toObject();
    delete result._id;

    console.log(`[Order Service] Successfully created Order #${assignedId} for User #${userId} and Product #${productId}`);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Order ID must be unique' });
    }
    console.error('[Order Service Error]', err);
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Order Service Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Order Service] Running on port ${PORT}`);
  console.log(`[Order Service] Configured User Service URL: ${USER_SERVICE_URL}`);
  console.log(`[Order Service] Configured Product Service URL: ${PRODUCT_SERVICE_URL}`);
  console.log(`[Order Service] Swagger docs at http://localhost:${PORT}/api-docs`);
});
