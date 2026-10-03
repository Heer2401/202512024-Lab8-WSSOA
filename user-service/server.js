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
const rawPort = process.env.PORT || process.env.USER_SERVICE_PORT || '3001';
const PORT = rawPort.toString().includes('://') ? 3001 : parseInt(rawPort, 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/userdb';

// Connect to MongoDB
mongoose.connect(MONGO_URI).then(() => {
  console.log(`[User Service] Connected to MongoDB at ${MONGO_URI}`);
}).catch((err) => {
  console.error('[User Service] MongoDB connection error:', err.message);
});

// User Schema & Model
const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, default: 'Student' },
  department: { type: String, default: 'Information Technology' }
}, { versionKey: false });

const User = mongoose.model('User', userSchema);

// Auto-increment ID helper
const getNextUserId = async () => {
  const lastUser = await User.findOne().sort({ id: -1 });
  return lastUser ? lastUser.id + 1 : 1;
};

// Joi Validation Schemas
const createUserValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().optional(),
  department: Joi.string().optional()
});

const updateUserValidation = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().optional(),
  department: Joi.string().optional()
}).min(1);

// Swagger Documentation Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'CampusConnect User Microservice (Lab 6)'
    },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'user-service', port: PORT });
});

// GET /users - Retrieve all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { _id: 0 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

// GET /users/:id - Retrieve user by ID
app.get('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findOne({ id }, { _id: 0 });
    if (!user) {
      return res.status(404).json({ error: `User with ID ${id} not found` });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user: ' + err.message });
  }
});

// POST /users - Create new user
app.post('/users', async (req, res) => {
  try {
    const { error, value } = createUserValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const assignedId = value.id || (await getNextUserId());

    const newUser = new User({
      id: assignedId,
      name: value.name,
      email: value.email,
      role: value.role || 'Student',
      department: value.department || 'Information Technology'
    });

    await newUser.save();
    const result = newUser.toObject();
    delete result._id;

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'id/email';
      return res.status(400).json({ error: `Duplicate key error: ${field} must be unique` });
    }
    res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// PUT /users/:id - Update user by ID
app.put('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const { error, value } = updateUserValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedUser = await User.findOneAndUpdate(
      { id },
      { $set: value },
      { new: true, projection: { _id: 0 } }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: `User with ID ${id} not found` });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email must be unique' });
    }
    res.status(500).json({ error: 'Failed to update user: ' + err.message });
  }
});

// DELETE /users/:id - Delete user by ID
app.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const deleted = await User.findOneAndDelete({ id });
    if (!deleted) {
      return res.status(404).json({ error: `User with ID ${id} not found` });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[User Service Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[User Service] Running on port ${PORT}`);
  console.log(`[User Service] Swagger docs at http://localhost:${PORT}/api-docs`);
});
