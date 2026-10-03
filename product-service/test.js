const assert = require('assert');
const Joi = require('joi');

const createProductValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  name: Joi.string().min(2).max(150).required(),
  category: Joi.string().required(),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).default(0),
  description: Joi.string().optional()
});

function runTests() {
  const validProduct = { name: 'Campus Notebook', category: 'Stationery', price: 4.99, stock: 50 };
  const validRes = createProductValidation.validate(validProduct);
  assert.strictEqual(validRes.error, undefined, 'Valid product should pass validation');

  const invalidProduct = { name: '', category: 'Stationery', price: -5 };
  const invalidRes = createProductValidation.validate(invalidProduct);
  assert.ok(invalidRes.error, 'Invalid product price and name should fail validation');

  console.log('✔ All Product Service unit tests passed successfully!');
}

runTests();
