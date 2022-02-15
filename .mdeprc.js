const uid = process.getuid()

module.exports = exports = {
  node: "16",
  auto_compose: true,
  with_local_compose: true,
  services: ['rabbitmq'],
  test_framework: 'c8 /src/node_modules/.bin/mocha',
  nycCoverage: false,
  nycReport: false,
  extras: {
    tester: {
      user: `${uid}:${uid}`
    }
  },
  pre: 'rimraf ./coverage/tmp',
  post_exec: './node_modules/.bin/pnpm exec -- c8 report -r text -r lcov'
};

switch (process.env.DB) {
  case 'sentinel':
    exports.services.push('redisSentinel');
    break;
  case 'cluster':
    exports.services.push('redisCluster')
    break;
}
