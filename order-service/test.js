const assert = require('assert');
const Joi = require('joi');

const createOrderValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  userId: Joi.number().integer().positive().required(),
  productId: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().positive().default(1)
});

function runTests() {
  const validOrder = { userId: 1, productId: 101, quantity: 2 };
  const validRes = createOrderValidation.validate(validOrder);
  assert.strictEqual(validRes.error, undefined, 'Valid order should pass validation');

  const invalidOrder = { userId: -1, productId: 0, quantity: 0 };
  const invalidRes = createOrderValidation.validate(invalidOrder);
  assert.ok(invalidRes.error, 'Invalid userId and quantity should fail validation');

  console.log('✔ All Order Service unit tests passed successfully!');
}

runTests();
