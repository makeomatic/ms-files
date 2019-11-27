module.exports = {
  "node": "12.13.0",
  "auto_compose": true,
  "with_local_compose": true,
  "sleep": 15,
  "services": [
    "rabbitmq",
    "redisSentinel",
    "redisCluster"
  ]
}
