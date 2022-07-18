const AMQPTransport = require('@microfleet/transport-amqp');
const omit = require('lodash/omit');
const {
  FILES_INDEX,
  FILES_DATA,
  FILES_USR_ALIAS_PTR,
  FILES_USER_INDEX_KEY,
  FILES_USER_INDEX_PUBLIC_KEY,
} = require('../../constant');

const getTransport = (amqpConfig) => AMQPTransport.connect(amqpConfig);

function generateUsersIds({
  amqp, config, redis, log,
}) {
  const resolvedUsers = new Map();
  const pipeline = redis.pipeline();

  return redis
    .smembers(FILES_INDEX)
    .tap((filesNames) => log.info('files count: %d', filesNames.length))
    .map((fileName) => redis.hmget(`${FILES_DATA}:${fileName}`, 'owner', 'uploadId'))
    .map(
      ([owner, fileName]) => {
        if (resolvedUsers.has(owner) === true) {
          log.info({ owner }, 'already resolved: %s', resolvedUsers.get(owner));
        } else {
          log.info('need resolve for %s', owner);
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
                log.error({ err: e }, 'failed to find user during migration');
                return null;
              })
        );
      },
      { concurrency: 20 }
    )
    .each(([fileName, owner, user]) => {
      if (user === null) {
        log.info('user not found for %s, owner %s', fileName, owner);
        return;
      }

      log.info('set id %s instead of %s for %s', user.id, owner, fileName);
      pipeline.hset(`${FILES_DATA}:${fileName}`, 'owner', user.id);
    })
    .return(resolvedUsers)
    .each(([owner, id]) => {
      log.info('rename', owner, 'to', id);
      pipeline.rename(FILES_USER_INDEX_KEY(owner), FILES_USER_INDEX_KEY(id));
      pipeline.rename(FILES_USER_INDEX_PUBLIC_KEY(owner), FILES_USER_INDEX_PUBLIC_KEY(id));
      pipeline.rename(`${FILES_USR_ALIAS_PTR}:${owner}`, `${FILES_USR_ALIAS_PTR}:${id}`);
    })
    .then(() => pipeline.exec())
    .then(() => log.info('that\'s all folks'))
    .catch((e) => log.error(e));
}

async function migrate({ config, redis, log }) {
  const amqpConfig = omit(config.amqp.transport, ['queue', 'listen', 'neck', 'onComplete']);
  const amqp = await getTransport(amqpConfig);
  try {
    return await generateUsersIds({ amqp, config, redis, log });
  } finally {
    await amqp.close();
  }
}

module.exports = {
  script: migrate,
  min: 1,
  final: 2,
};
