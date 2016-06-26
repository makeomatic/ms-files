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
COMPOSE="docker-compose -f $DC"

if ! [ -x "$(which docker-compose)" ]; then
  mkdir $DIR/.bin
  curl -L https://github.com/docker/compose/releases/download/${COMPOSE_VER}/docker-compose-`uname -s`-`uname -m` > $DIR/.bin/docker-compose
  chmod +x $DIR/.bin/docker-compose
fi

if [[ x"$CI" == x"true" ]]; then
  trap "$COMPOSE stop; $COMPOSE rm -f;" EXIT
else
  trap "echo \"to remove containers use: '$COMPOSE stop; $COMPOSE rm -f;'\"" EXIT
fi

# bring compose up
$COMPOSE up -d

if [[ "$SKIP_REBUILD" != "1" ]]; then
  # add glibc
  docker exec tester /bin/sh -c "apk --no-cache add ca-certificates openssl make g++ python linux-headers \
    && printf '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZ2u1KJKUu/fW4A25y9m\ny70AGEa/J3Wi5ibNVGNn1gT1r0VfgeWd0pUybS4UmcHdiNzxJPgoWQhV2SSW1JYu\ntOqKZF5QSN6X937PTUpNBjUvLtTQ1ve1fp39uf/lEXPpFpOPL88LKnDBgbh7wkCp\nm2KzLVGChf83MS0ShL6G9EQIAUxLm99VpgRjwqTQ/KfzGtpke1wqws4au0Ab4qPY\nKXvMLSPLUp7cfulWvhmZSegr5AdhNw5KNizPqCJT8ZrGvgHypXyiFvvAH5YRtSsc\nZvo9GI2e2MaZyo9/lvb+LbLEJZKEQckqRj4P26gmASrZEPStwc+yqy1ShHLA0j6m\n1QIDAQAB\n-----END PUBLIC KEY-----\n' > /etc/apk/keys/sgerrand.rsa.pub \
    && wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.23-r2/glibc-2.23-r2.apk \
    && apk add glibc-2.23-r2.apk \
    && rm glibc-2.23-r2.apk" || exit 1
  echo "rebuilding native dependencies..."
  docker exec tester npm rebuild hiredis
  docker exec tester npm rebuild grpc --update-binary
fi

echo "cleaning old coverage"
rm -rf ./coverage

echo "running tests"
for fn in $TESTS; do
  echo "running tests for $fn"
  docker exec tester /bin/sh -c "$NODE $COVER --dir ./coverage/${fn##*/} $MOCHA -- $fn" || exit 1
done

echo "started generating combined coverage"
docker exec tester test/aggregate-report.js

if [[ "$CI" == "true" ]]; then
  echo "uploading coverage report from ./coverage/lcov.info"
  $BIN/codecov -f ./coverage/lcov.info
fi
