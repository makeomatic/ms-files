module.exports = {
  node: "12.15.0",
  auto_compose: true,
  with_local_compose: true,
  sleep: 35,
  services: ['rabbitmq'],
  nycReport: false,
  arbitrary_exec: 'yarn coverage:clean',
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