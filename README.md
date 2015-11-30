# ms-files

Handles metadata processing, as well as various post-processing of files

## Plan

1. Provide access-control for read & writes on a per user basis
2. Initiate file upload for a given user
3. Complete file upload for a given user
4. Send completed file upload to a post-processing queue
5. Cleanup after abrupt file uploads

## Docker debug command

`docker run --rm -it --link redis_1 --link redis_2 --link redis_3 --link rabbitmq -v ~/projects/ms-files/schemas:/src/schemas:ro -v ~/projects/ms-files/src:/src/src -v ~/projects/cappasity-deploy/configs:/configs:ro -v ~/projects/ms-files/node_modules:/src/node_modules:ro -v ~/projects/ms-files/lua:/src/lua:ro -e NCONF_FILE_PATH='["/configs/amqp.js","/configs/redis.js","/configs/files.js"]' -e MS_FILES__LOGGER=true -e NODE_ENV=development --name ms-files makeomatic/ms-files:5.1.0-development npm start`