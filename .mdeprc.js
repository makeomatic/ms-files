const uid = process.getuid()

module.exports = exports = {
  node: "18",
  auto_compose: true,
  with_local_compose: true,
  in_one: true,
  http: false,
  services: ['rabbitmq'],
  test_framework: 'mocha',
  nycCoverage: false,
  nycReport: false,
  extras: {
    tester: {
      user: `${uid}:${uid}`
    }
  },
  pre: 'rimraf ./coverage/*',
  // post_exec: './node_modules/.bin/c8 report -r text -r lcov'
};

switch (process.env.DB) {
  case 'sentinel':
    exports.services.push('redisSentinel');
    break;
  case 'cluster':
    exports.services.push('redisCluster')
    break;
}
