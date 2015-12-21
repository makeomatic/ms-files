SHELL := /bin/bash
THIS_FILE := $(lastword $(MAKEFILE_LIST))
PKG_NAME := $(shell cat package.json | ./node_modules/.bin/json name)
PKG_VERSION := $(shell cat package.json | ./node_modules/.bin/json version)
NPM_PROXY := http://$(shell docker-machine ip dev):4873
DIST := makeomatic/$(PKG_NAME)
NODE_VERSIONS := 5.3.0 5.2.0 5.1.1
ENVS := .development .production
TASK_LIST := $(foreach env,$(ENVS),$(addsuffix $(env), $(NODE_VERSIONS)))

%.test:
	@echo "no test present"
	exit 1;

%.build: ARGS = --build-arg NODE_ENV=$(NODE_ENV) --build-arg NPM_PROXY=$(NPM_PROXY)
%.build:
	NODE_VERSION=$(NODE_VERSION) envsubst < "./Dockerfile" > $(DOCKERFILE)
	docker build $(ARGS) -t $(PKG_PREFIX_ENV) -f $(DOCKERFILE) .
	rm $(DOCKERFILE)

%.production.build:
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)
	docker tag -f $(PKG_PREFIX_ENV) $(PKG_PREFIX)-$(PKG_VERSION)

%.push:
	docker push $(PKG_PREFIX_ENV)

%.production.push:
	docker push $(PKG_PREFIX)
	docker push $(PKG_PREFIX)-$(PKG_VERSION)

all: test build push

%: NODE_VERSION = $(basename $(basename $@))
%: NODE_ENV = $(subst .,,$(suffix $(basename $@)))
%: DOCKERFILE = "./Dockerfile.$(NODE_VERSION)"
%: PKG_PREFIX = $(DIST):$(NODE_VERSION)
%: PKG_PREFIX_ENV = $(PKG_PREFIX)-$(NODE_ENV)
%::
	@echo $@  # print target name
	$(MAKE) -f $(THIS_FILE) $(addsuffix .$@, $(TASK_LIST))

.PHONY: all %.test %.build %.push
