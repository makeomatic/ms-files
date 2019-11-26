module.exports = {
  "node": "12.13.0",
  "auto_compose": true,
  "with_local_compose": true,
  "services": [
    "rabbitmq",
    "redisSentinel",
    "redisCluster"
  ]
}
