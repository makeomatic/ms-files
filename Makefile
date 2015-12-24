SHELL := /bin/bash
THIS_FILE := $(lastword $(MAKEFILE_LIST))
PKG_NAME := $(shell cat package.json | ./node_modules/.bin/json name)
PKG_VERSION := $(shell cat package.json | ./node_modules/.bin/json version)
NPM_PROXY := http://$(shell docker-machine ip dev):4873
DOCKER_USER := makeomatic
DIST := $(DOCKER_USER)/$(PKG_NAME)
NODE_VERSIONS := 5.3.0
ENVS := development production
TASK_LIST := $(foreach env,$(ENVS),$(addsuffix .$(env), $(NODE_VERSIONS)))
WORKDIR := /src
COMPOSE_FILE := test/docker-compose.yml

test: mocha cleanup

build: docker tag

%.production.mocha:
	@echo "testing $@"
	$(COMPOSE) run -e SKIP_REBUILD=${SKIP_REBUILD} --rm tester npm test

%.mocha: ;

%.production.cleanup:
	@echo "cleaning up $@"
	$(COMPOSE) stop
	$(COMPOSE) rm -f

%.cleanup: ;

%.docker: ARGS = --build-arg NODE_ENV=$(NODE_ENV) --build-arg NPM_PROXY=$(NPM_PROXY)
%.docker:
	@echo "building $@"
	npm run compile
	NODE_VERSION=$(NODE_VERSION) envsubst < "./Dockerfile" > $(DOCKERFILE)
	docker build $(ARGS) -t $(PKG_PREFIX_ENV) -f $(DOCKERFILE) .
	rm $(DOCKERFILE)

%.production.tag:
	@echo "tagging build $@"
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)-$(PKG_VERSION)

%.tag: ;

%.development.pull:
	@echo "pulling development $@"
	docker pull $(PKG_PREFIX_ENV)

%.pull:
	@echo "pulling $@"
	docker pull $(PKG_PREFIX)
	docker pull $(PKG_PREFIX)-$(PKG_VERSION)

%.production.push:
	@echo "pushing production $@"
	docker push $(PKG_PREFIX)
	docker push $(PKG_PREFIX)-$(PKG_VERSION)

%.push:
	@echo "pushing $@"
	docker push $(PKG_PREFIX_ENV)

all: test build push

%: COMPOSE = DIR=$(WORKDIR) IMAGE=$(IMAGE) docker-compose -f $(COMPOSE_FILE)
%: IMAGE=$(DOCKER_USER)/alpine-node:$(NODE_VERSION)
%: NODE_VERSION = $(basename $(basename $@))
%: NODE_ENV = $(subst .,,$(suffix $(basename $@)))
%: DOCKERFILE = "./Dockerfile.$(NODE_VERSION)"
%: PKG_PREFIX = $(DIST):$(NODE_VERSION)
%: PKG_PREFIX_ENV = $(PKG_PREFIX)-$(NODE_ENV)
%::
	@echo $@  # print target name
	@$(MAKE) -f $(THIS_FILE) $(addsuffix .$@, $(TASK_LIST))

.PHONY: all test build %.mocha %.docker %.push %.pull
