const AMQPTransport = require('@microfleet/transport-amqp');
const omit = require('lodash/omit');
const Promise = require('bluebird');
const { FILES_INDEX, FILES_DATA } = require('../../constant');

const getTransport = amqpConfig => AMQPTransport.connect(amqpConfig).disposer(amqp => amqp.close());

function generateUsersIds({
  amqp, config, redis, log,
}) {
  const resolvedUsers = new Map();
  const pipeline = redis.pipeline();

  return redis
    .smembers(FILES_INDEX)
    .tap(filesNames => log.info('files count:', filesNames.length))
    .map(fileName => redis.hmget(`${FILES_DATA}:${fileName}`, 'owner', 'uploadId'))
    .map(
      ([owner, fileName]) => {
        if (resolvedUsers.has(owner) === true) {
          log.info(owner, 'already resolved:', resolvedUsers.get(owner));
        } else {
          log.info('need resolve for', owner);
        }

        return Promise.join(
          fileName,
          owner,
          resolvedUsers.has(owner)
            ? { id: resolvedUsers.get(owner) }
            : amqp
              .publishAndWait(config.users.getInternalData, { username: owner, fields: ['id'] })
              .tap(({ id }) => {
                if (resolvedUsers.has(owner) === false) {
                  resolvedUsers.set(owner, id);
                }
              })
              .catch({ statusCode: 404 }, (e) => {
                log.error(e);
                return null;
              })
        );
      },
      { concurrency: 20 }
    )
    .each(([fileName, owner, user]) => {
      if (user === null) {
        log.info('user not found for', fileName, 'owner', owner);
        return;
      }

      log.info('set id', user.id, 'instead of', owner, 'for', fileName);
      pipeline.hset(`${FILES_DATA}:${fileName}`, 'owner', user.id);
    })
    .return(resolvedUsers)
    .each(([owner, id]) => {
      log.info('rename', owner, 'to', id);
      pipeline.rename(`${FILES_INDEX}:${owner}`, `${FILES_INDEX}:${id}`);
      pipeline.rename(`${FILES_INDEX}:${owner}:pub`, `${FILES_INDEX}:${id}:pub`);
    })
    .then(() => pipeline.exec())
    .then(() => log.info('that\'s all folks'))
    .catch(e => log.error(e));
}

function migrate({ config, redis, log }) {
  const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);

  return Promise
    .using(
      getTransport(amqpConfig),
      amqp => generateUsersIds({
        amqp, config, redis, log,
      })
    );
}

module.exports = {
  script: migrate,
  min: 1,
  final: 2,
};
