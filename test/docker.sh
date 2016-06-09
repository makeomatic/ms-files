#!/bin/bash

export NODE_ENV=development
BIN=node_modules/.bin
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DC="$DIR/docker-compose.yml"
PATH=$PATH:$DIR/.bin/
COMPOSE=$(which docker-compose)
MOCHA=$BIN/_mocha
COVER="$BIN/isparta cover"
NODE=$BIN/babel-node
TESTS=${TESTS:-test/suites/*.js}
COMPOSE_VER=${COMPOSE_VER:-1.7.1}
NODE_VER=${NODE_VER:-6.2.1}

if ! [ -x "$COMPOSE" ]; then
  mkdir $DIR/.bin
  curl -L https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-`uname -s`-`uname -m` > $DIR/.bin/docker-compose
  chmod +x $DIR/.bin/docker-compose
  COMPOSE=$(which docker-compose)
fi

function finish {
  $COMPOSE -f $DC stop
  $COMPOSE -f $DC rm -f
}
trap finish EXIT

export IMAGE=makeomatic/node:$NODE_VER
$COMPOSE -f $DC up -d

if [[ "$SKIP_REBUILD" != "1" ]]; then
  echo "rebuilding native dependencies..."
  $COMPOSE -f $DC exec tester npm rebuild
fi

echo "cleaning old coverage"
rm -rf ./coverage

echo "running tests"
for fn in $TESTS; do
  $COMPOSE -f $DC exec tester /bin/sh -c "$NODE $COVER --dir ./coverage/${fn##*/} $MOCHA -- $fn" || exit 1
done

echo "started generating combined coverage"
$COMPOSE -f $DC run exec tester node ./test/aggregate-report.js

if [[ "$CI" == "true" ]]; then
  echo "uploading coverage report from ./coverage/lcov.info"
  cat ./coverage/lcov.info | $BIN/codecov
fi
