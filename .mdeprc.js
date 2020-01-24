module.exports = {
  "node": "12.14.1",
  "auto_compose": true,
  "with_local_compose": true,
  "sleep": 35,
  "services": [
    "rabbitmq",
    "redisSentinel",
    "redisCluster"
  ]
}
