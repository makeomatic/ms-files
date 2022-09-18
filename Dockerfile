FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

# pnpm fetch does require only lockfile
COPY --chown=node:node package.json pnpm-lock.yaml ./
RUN \
  apk --update upgrade \
  && apk --update add --virtual .buildDeps git ca-certificates openssl g++ make python3 linux-headers \
  && chown node:node /src \
  && su node -c 'pnpm install --prod' \
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
