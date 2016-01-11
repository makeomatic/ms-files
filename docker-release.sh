#!/bin/bash

docker login -e $DOCKER_EMAIL -p $DOCKER_PWD -u $DOCKER_LOGIN || exit 1
BUILD_ENV=${ENVS:-production development}
NPM_PROXY=${NPM_PROXY:-https://registry.npmjs.com}

make ENVS="$BUILD_ENV" NPM_PROXY=$NPM_PROXY build
make ENVS="$BUILD_ENV" NPM_PROXY=$NPM_PROXY push
