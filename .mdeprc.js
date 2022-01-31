module.exports = exports = {
  node: "16",
  auto_compose: true,
  with_local_compose: true,
  services: ['rabbitmq'],
  nycReport: false,
  post_exec: 'yarn coverage:report'
};

switch (process.env.DB) {
  case 'sentinel':
    exports.services.push('redisSentinel');
    break;
  case 'cluster':
    exports.services.push('redisCluster')
    break;
}

if (process.env.CI !== 'true') {
  exports.arbitrary_exec = 'yarn coverage:clean';
}
