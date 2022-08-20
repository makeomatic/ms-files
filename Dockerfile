FROM makeomatic/node:$NODE_VERSION

ENV NCONF_NAMESPACE=MS_FILES \
    NODE_ENV=$NODE_ENV

WORKDIR /src

# pnpm fetch does require only lockfile
COPY pnpm-lock.yaml ./
RUN pnpm fetch --prod

COPY package.json ./
RUN \
  apk --update upgrade \
  && apk --update add git ca-certificates openssl g++ make python3 linux-headers \
  && pnpm install -r --offline --prod --frozen-lockfile \
  && apk del \
    g++ \
    make \
    git \
    wget \
    python3 \
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
CMD ./node_modules/.bin/mfleet
