module.exports = {
  node: "14.15",
  auto_compose: true,
  with_local_compose: true,
  sleep: 35,
  services: ['rabbitmq'],
  nycReport: false,
  post_exec: 'yarn coverage:report'
};

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
