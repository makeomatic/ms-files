module.exports = {
  node: "14.15",
  auto_compose: true,
  with_local_compose: true,
  sleep: 35,
  services: ['rabbitmq'],
  nycReport: false,
  post_exec: 'yarn coverage:report'
};

if (process.env.PROVIDER === 'aws') {
  module.exports.tests = './test/suites/providers/aws/*.js';
}

if (process.env.PROVIDER !== 'aws') {
  module.exports.tests = './test/suites/**/!(providers)/*.js';
}

switch (process.env.DB) {
  case 'sentinel':
    module.exports.services.push('redisSentinel');
    break;
  case 'cluster':
    module.exports.services.push('redisCluster')
    break;
}

if (process.env.CI !== 'true') {
  module.exports.arbitrary_exec = 'yarn coverage:clean';
}
