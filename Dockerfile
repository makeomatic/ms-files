FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV \
    GLIBC_VER=2.25-r1 \
    LD_LIBRARY_PATH=/usr/glibc-compat/lib/

WORKDIR /src

COPY yarn.lock package.json ./
RUN \
  apk --update add git ca-certificates openssl g++ make python linux-headers \
    && printf '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZ2u1KJKUu/fW4A25y9m\ny70AGEa/J3Wi5ibNVGNn1gT1r0VfgeWd0pUybS4UmcHdiNzxJPgoWQhV2SSW1JYu\ntOqKZF5QSN6X937PTUpNBjUvLtTQ1ve1fp39uf/lEXPpFpOPL88LKnDBgbh7wkCp\nm2KzLVGChf83MS0ShL6G9EQIAUxLm99VpgRjwqTQ/KfzGtpke1wqws4au0Ab4qPY\nKXvMLSPLUp7cfulWvhmZSegr5AdhNw5KNizPqCJT8ZrGvgHypXyiFvvAH5YRtSsc\nZvo9GI2e2MaZyo9/lvb+LbLEJZKEQckqRj4P26gmASrZEPStwc+yqy1ShHLA0j6m\n1QIDAQAB\n-----END PUBLIC KEY-----\n' > /etc/apk/keys/sgerrand.rsa.pub \
  && wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-${GLIBC_VER}.apk \
  && wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-dev-${GLIBC_VER}.apk \
  && apk add glibc-${GLIBC_VER}.apk glibc-dev-${GLIBC_VER}.apk \
  && rm glibc-${GLIBC_VER}.apk glibc-dev-${GLIBC_VER}.apk \
  && yarn --production \
  && apk del \
    g++ \
    make \
    git \
    wget \
    python \
    linux-headers \
    glibc-dev \
  && rm -rf \
    /tmp/* \
    /root/.node-gyp \
    /root/.npm \
    /etc/apk/cache/* \
    /var/cache/apk/*

COPY . /src
RUN  chown -R node /src
USER node

EXPOSE 8080
