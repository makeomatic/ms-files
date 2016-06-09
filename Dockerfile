FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

COPY package.json .
RUN \
  apk --no-cache add git ca-certificates openssl g++ make \
  && printf '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZ2u1KJKUu/fW4A25y9m\ny70AGEa/J3Wi5ibNVGNn1gT1r0VfgeWd0pUybS4UmcHdiNzxJPgoWQhV2SSW1JYu\ntOqKZF5QSN6X937PTUpNBjUvLtTQ1ve1fp39uf/lEXPpFpOPL88LKnDBgbh7wkCp\nm2KzLVGChf83MS0ShL6G9EQIAUxLm99VpgRjwqTQ/KfzGtpke1wqws4au0Ab4qPY\nKXvMLSPLUp7cfulWvhmZSegr5AdhNw5KNizPqCJT8ZrGvgHypXyiFvvAH5YRtSsc\nZvo9GI2e2MaZyo9/lvb+LbLEJZKEQckqRj4P26gmASrZEPStwc+yqy1ShHLA0j6m\n1QIDAQAB\n-----END PUBLIC KEY-----\n' > /etc/apk/keys/sgerrand.rsa.pub \
  && wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/$GLIBC_VERSION/glibc-$GLIBC_VERSION.apk \
  && apk add glibc-$GLIBC_VERSION.apk \
  && npm install --production \
  && npm dedupe \
  && apk del \
    g++ \
    make \
    git \
    wget \
  && rm -rf \
    glibc-*.apk \
    /tmp/* \
    /root/.node-gyp \
    /root/.npm

ENV LD_LIBRARY_PATH /usr/glibc-compat/lib/

COPY . /src
RUN  chown -R node /src
USER node

EXPOSE 8080
