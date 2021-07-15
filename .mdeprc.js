var glob = require("glob")

module.exports = {
  node: "14.15",
  auto_compose: true,
  with_local_compose: true,
  sleep: 35,
  services: ['rabbitmq'],
  nycReport: false,
  post_exec: 'yarn coverage:report'
};

// const genericTests = glob.sync('suites/**/*.js')

console.log('process.env.PROVIDER', process.env.PROVIDER)

if (process.env.PROVIDER === 'aws') {
  console.log('provider is aws')
  // const awsTests = glob('./test/suites/**/*.js')
  // console.log('awsTests', awsTests)
  module.exports.tests = './test/suites/providers/aws/*.js';
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
