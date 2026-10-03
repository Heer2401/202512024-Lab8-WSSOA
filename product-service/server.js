require('dotenv').config();

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const Joi = require('joi');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(cors());

// Environment configuration
const rawPort = process.env.PORT || process.env.PRODUCT_SERVICE_PORT || '3002';
const PORT = rawPort.toString().includes('://') ? 3002 : parseInt(rawPort, 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/productdb';

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => {
  console.log(`[Product Service] Connected to MongoDB at ${MONGO_URI}`);
}).catch((err) => {
  console.error('[Product Service] MongoDB connection error:', err.message);
});

// Product Schema & Model
const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 100 },
  description: { type: String, default: '' }
}, { versionKey: false });

const Product = mongoose.model('Product', productSchema);

// Auto-increment ID helper
const getNextProductId = async () => {
  const lastProd = await Product.findOne().sort({ id: -1 });
  return lastProd ? lastProd.id + 1 : 101; // Start product IDs from 101
};

// Joi Validation Schemas
const createProductValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  name: Joi.string().min(2).max(150).required(),
  category: Joi.string().optional(),
  price: Joi.number().positive().precision(2).required(),
  stock: Joi.number().integer().min(0).optional(),
  description: Joi.string().allow('').optional()
});

const updateProductValidation = Joi.object({
  name: Joi.string().min(2).max(150).optional(),
  category: Joi.string().optional(),
  price: Joi.number().positive().precision(2).optional(),
  stock: Joi.number().integer().min(0).optional(),
  description: Joi.string().allow('').optional()
}).min(1);

// Swagger Documentation Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Product Service API',
      version: '1.0.0',
      description: 'CampusConnect Product Microservice (Lab 6)'
    },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'product-service', port: PORT });
});

// GET /products - Retrieve all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find({}, { _id: 0 });
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// GET /products/:id - Retrieve product by ID
app.get('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    const product = await Product.findOne({ id }, { _id: 0 });
    if (!product) {
      return res.status(404).json({ error: `Product with ID ${id} not found` });
    }

    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product: ' + err.message });
  }
});

// POST /products - Create new product
app.post('/products', async (req, res) => {
  try {
    const { error, value } = createProductValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const assignedId = value.id || (await getNextProductId());

    const newProduct = new Product({
      id: assignedId,
      name: value.name,
      category: value.category || 'General',
      price: value.price,
      stock: value.stock !== undefined ? value.stock : 100,
      description: value.description || ''
    });

    await newProduct.save();
    const result = newProduct.toObject();
    delete result._id;

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Product ID must be unique' });
    }
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// PUT /products/:id - Update product by ID
app.put('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    const { error, value } = updateProductValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { id },
      { $set: value },
      { new: true, projection: { _id: 0 } }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: `Product with ID ${id} not found` });
    }

    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// DELETE /products/:id - Delete product by ID
app.delete('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    const deleted = await Product.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: `Product with ID ${id} not found` });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Product Service Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Product Service] Running on port ${PORT}`);
  console.log(`[Product Service] Swagger docs at http://localhost:${PORT}/api-docs`);
});
