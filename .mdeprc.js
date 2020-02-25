module.exports = {
  "node": "12.14.1",
  "auto_compose": true,
  "with_local_compose": true,
  "sleep": 35,
  "services": [
    "rabbitmq",
    "redisSentinel",
    "redisCluster"
  ],
  "nycReport": false,
  "arbitrary_exec": "yarn coverage:clean",
  "post_exec": "yarn coverage:report",
}
