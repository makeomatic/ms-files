FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

COPY package.json .
RUN \
  apk --update add git ca-certificates openssl g++ make python linux-headers \
  && yarn --production \
  && apk del \
    g++ \
    make \
    git \
    wget \
    python \
    linux-headers \
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
