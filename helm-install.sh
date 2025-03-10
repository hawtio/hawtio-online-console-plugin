#!/bin/bash

NAME=hawtio-online-console-plugin
DIRECTORY=charts/${NAME}

VERSION=0.1.0-alpha1
PLUGIN_IMAGE=quay.io/hawtio/online-console-plugin
PLUGIN_VERSION=${VERSION}
GATEWAY_IMAGE=quay.io/hawtio/online-console-plugin-gateway
GATEWAY_VERSION=${VERSION}
LOG_LEVEL=trace

clear

helm list | grep ${NAME} > /dev/null
if [ "$?" == "0" ]; then
  helm uninstall hawtio-online-console-plugin
fi

helm install \
  --set plugin.image.name=${PLUGIN_IMAGE} \
  --set plugin.image.tag=${PLUGIN_VERSION} \
  --set plugin.image.pullPolicy=Always \
  --set gateway.image.name=${GATEWAY_IMAGE} \
  --set gateway.image.tag=${GATEWAY_VERSION} \
  --set gateway.image.pullPolicy=Always \
  --set gateway.log.level=${LOG_LEVEL} \
  ${NAME} ${DIRECTORY}
