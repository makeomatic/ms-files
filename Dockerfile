FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

# pnpm fetch does require only lockfile
COPY --chown=node:node pnpm-lock.yaml ./
RUN \
  apk --update --upgrade \
    add ca-certificates --virtual .buildDeps git ca-certificates openssl g++ make python3 linux-headers \
  && update-ca-certificates \
  && chown node:node /src \
  && su -l node -c "cd /src && pnpm fetch --prod" \
  && apk del .buildDeps \
  && rm -rf \
    /tmp/* \
    /root/.node-gyp \
    /root/.npm \
    /etc/apk/cache/* \
    /var/cache/apk/*

USER node
COPY --chown=node:node . /src
RUN pnpm install --offline --prod

EXPOSE 8080
CMD ./node_modules/.bin/mfleet
