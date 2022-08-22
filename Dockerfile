FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

COPY --chown=node:node pnpm-lock.yaml package.json ./
RUN \
  apk --update upgrade \
  && apk add ca-certificates openssl \
  && apk add --virtual .buildDeps git g++ make python3 linux-headers \
  && chown node:node /src \
  && su node -c 'cd /src && pnpm install --frozen-lockfile --prod' \
  && apk del .buildDeps \
  && rm -rf \
    /tmp/* \
    /root/.node-gyp \
    /root/.npm \
    /etc/apk/cache/* \
    /var/cache/apk/*

COPY --chown=node:node . /src
USER node

EXPOSE 8080
CMD ./node_modules/.bin/mfleet
