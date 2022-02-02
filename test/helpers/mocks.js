const set = require('lodash/set');
const find = require('lodash/find');
const config = require('../../src/config').get('/');

const { audience } = config.users;

const users = [
  { id: '1000000000', alias: 'admin' },
  { id: '2000000000', alias: 'free' },
  { id: '3000000000', alias: 'professional' },
  { id: '4000000000', alias: 'adminLimit' },
];

const mockPlan = (value) => set({}, 'meta.embeddings.value', value);

const mockMetadata = (alias, attributes) => ({
  id: find(users, { alias }).id,
  [audience]: attributes,
});

const mockInternalData = (alias) => ({
  id: find(users, { alias }).id,
});

const plans = {
  free: mockPlan(1),
  professional: mockPlan(10),
};

const metadata = {
  free: mockMetadata('free', { plan: 'free', roles: [] }),
  professional: mockMetadata('professional', { plan: 'professional', roles: [] }),
  admin: mockMetadata('admin', { plan: 'professional', roles: ['admin'] }),
  adminLimit: mockMetadata('adminLimit', { plan: 'free', roles: ['admin'] }),
};

const internals = {
  free: mockInternalData('free'),
  professional: mockInternalData('professional'),
  admin: mockInternalData('admin'),
  adminLimit: mockMetadata('adminLimit'),
};

const uploadedFiles = {
  free: 10,
  professional: 1,
  admin: 1,
  adminLimit: 10,
};

module.exports = {
  users,
  plans,
  metadata,
  internals,
  uploadedFiles,
};
