const uid = process.getuid()

module.exports = exports = {
  node: "20.11",
  auto_compose: true,
  with_local_compose: true,
  in_one: true,
  http: false,
  services: ['rabbitmq'],
  test_framework: 'c8 ./node_modules/.bin/mocha',
  extras: {
    tester: {
      user: `${uid}:${uid}`
    }
  },
  pre: 'rimraf ./coverage/*',
  post_exec: 'pnpm c8 report -r text -r lcov'
};

switch (process.env.DB) {
  case 'sentinel':
    exports.services.push('redisSentinel');
    break;
  case 'cluster':
    exports.services.push('redisCluster')
    break;
}
