#!/bin/bash

pull_build_image() {
  local CONTAINER_IMAGE="${1:-}"
  local CONTAINER_VERSION="${2:-}"
  local CONTAINER_MAKE="${3:-}"

  docker pull ${CONTAINER_IMAGE}:${CONTAINER_VERSION}
  if [ "$?" == "0" ]; then
    echo "Skipping build because tag ${CONTAINER_VERSION} already exists"
  else
    make ${CONTAINER_MAKE}
    if [ "$?" != "0" ]; then
      echo "Error: make ${CONTAINER_MAKE} failed"
      exit 1
    fi

    docker push ${CONTAINER_IMAGE}:${CONTAINER_VERSION}
    if [ "$?" != "0" ]; then
      echo "Error: docker push failed"
      exit 1
    fi
  fi
}


NAMESPACE=hawtio-dev

MAKEFILE_VERSION=$(sed -n 's/^VERSION := \([0-9.]\+\)/\1/p' Makefile)
if [ -z "${MAKEFILE_VERSION}" ]; then
  echo "Error: Cannot extract Makefile version property"
  exit 1
fi

export CUSTOM_PLUGIN_IMAGE=quay.io/phantomjinx/hawtio-online-console-plugin
export CUSTOM_GATEWAY_IMAGE=quay.io/phantomjinx/hawtio-online-console-plugin-gateway
MY_DATE="$(date -u '+%Y%m%d%H%M')"

while getopts ":v:s" opt; do
  case ${opt} in
    s)
      ONLY_BUILD=1
      ;;
    v)
      CUSTOM_VERSION=${OPTARG}
      ;;
    \?) echo "Usage: cmd [-s] [-v]"
      ;;
  esac
done

if [ -z "${CUSTOM_VERSION}" ]; then
  export CUSTOM_PLUGIN_VERSION="${MAKEFILE_VERSION}-${MY_DATE}"
  export CUSTOM_GATEWAY_VERSION="${MAKEFILE_VERSION}-${MY_DATE}"
else
  export CUSTOM_PLUGIN_VERSION="${CUSTOM_VERSION}"
  export CUSTOM_GATEWAY_VERSION="${CUSTOM_VERSION}"
fi

# Try pulling or building existing image
pull_build_image "${CUSTOM_PLUGIN_IMAGE}" "${CUSTOM_PLUGIN_VERSION}" ".plugin-image"
pull_build_image "${CUSTOM_GATEWAY_IMAGE}" "${CUSTOM_GATEWAY_VERSION}" ".gateway-image"

if [ "${ONLY_BUILD}" == "1" ]; then
  echo "Skipping install"
  exit 0
fi

NAMESPACE=${NAMESPACE} \
  CUSTOM_PLUGIN_IMAGE=${CUSTOM_PLUGIN_IMAGE} \
  CUSTOM_GATEWAY_IMAGE=${CUSTOM_GATEWAY_IMAGE} \
  CUSTOM_PLUGIN_VERSION=${CUSTOM_PLUGIN_VERSION} \
  CUSTOM_GATEWAY_VERSION=${CUSTOM_GATEWAY_VERSION} \
  make install

oc get pods -w
