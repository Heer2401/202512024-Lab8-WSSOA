const assert = require('assert');
const Joi = require('joi');

const createUserValidation = Joi.object({
  id: Joi.number().integer().positive().optional(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().optional(),
  department: Joi.string().optional()
});

function runTests() {
  const validUser = { name: 'Alice Johnson', email: 'alice.johnson@daiict.ac.in', role: 'Student' };
  const validRes = createUserValidation.validate(validUser);
  assert.strictEqual(validRes.error, undefined, 'Valid user should not produce error');

  const invalidUser = { name: 'A', email: 'not-an-email' };
  const invalidRes = createUserValidation.validate(invalidUser);
  assert.ok(invalidRes.error, 'Invalid email and short name should fail validation');

  console.log('✔ All User Service unit tests passed successfully!');
}

runTests();
