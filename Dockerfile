FROM registry.access.redhat.com/ubi8/nodejs-20:latest AS build-image

#
# The plugin name
#
ENV PLUGIN_NAME hawtio-online-console-plugin

### BEGIN REMOTE SOURCE

# Use the COPY instruction only inside the REMOTE SOURCE block
# Use the COPY instruction only to copy files to the container path
# ${REMOTE_SOURCES_DIR}/${PLUGIN_NAME}/app
ARG REMOTE_SOURCES_DIR=/tmp/remote_source
RUN mkdir -p ${REMOTE_SOURCES_DIR}/${PLUGIN_NAME}/app
WORKDIR ${REMOTE_SOURCES_DIR}/${PLUGIN_NAME}/app

# Copy package.json and yarn.lock to the container
COPY package.json package.json
COPY yarn.lock yarn.lock

ADD . ${REMOTE_SOURCES_DIR}/${PLUGIN_NAME}/app
RUN command -v yarn || npm i -g yarn
### END REMOTE SOURCE

USER root

## Set directory
RUN mkdir -p /usr/src/
RUN cp -r ${REMOTE_SOURCES_DIR}/${PLUGIN_NAME}/app /usr/src/
WORKDIR /usr/src/app

## Install dependencies
RUN yarn install --network-timeout 1000000

## Build application
RUN yarn build

FROM registry.access.redhat.com/ubi8/nginx-120:latest

COPY --from=build-image /usr/src/app/dist /usr/share/nginx/html

# Copy the hawtconfig.json configuration file
COPY public/hawtconfig.json /usr/share/nginx/html/

USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;"]

## Labels
LABEL name="hawtio/hawtio-online-console-plugin"
LABEL description="Hawtio Online Console Integrated Plugin"
LABEL maintainer="Paul Richardson <parichar@redhat.com>"
LABEL version="0.0.1"
