#!/usr/bin/env bash

CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:latest"}
CONSOLE_PORT=${CONSOLE_PORT:=9442}
CONSOLE_IMAGE_PLATFORM=${CONSOLE_IMAGE_PLATFORM:="linux/amd64"}

# Plugin metadata is declared in package.json
PLUGIN_NAME="hawtio-online-console-plugin"
GATEWAY_SERVICE="gateway"
PLUGIN_GATEWAY_HOST=$(oc get route hawtio-online-console-plugin-gateway -o jsonpath='{.spec.host}')

set -euo pipefail

echo "Starting local OpenShift console in https mode..."
echo "Plugin Name: ${PLUGIN_NAME}"
echo "Gateway Service: ${GATEWAY_SERVICE}"

if [ -z "${PLUGIN_GATEWAY_HOST}" ]; then
  echo "Error: Cannot determine hostname of the console plugin gateway. This must be installed first. Exiting ..."
  exit 1
else
  echo "Plugin Gateway Host: ${PLUGIN_GATEWAY_HOST}"
fi

#
# All of these env vars are derived from the bridge binary cli switches
# eg. bridge -v ----> BRIDGE_V
#
# see: https://github.com/openshift/console/blob/[...]/cmd/bridge/main.go
#
BRIDGE_V=4
BRIDGE_BASE_ADDRESS="https://localhost:${CONSOLE_PORT}"
BRIDGE_LISTEN="https://0.0.0.0:${CONSOLE_PORT}"
BRIDGE_TLS_CERT_FILE=/tls-certificates/server.localhost.bundle.crt
BRIDGE_TLS_KEY_FILE=/tls-certificates/server.localhost.key

# authenticating the console
BRIDGE_USER_AUTH="openshift"
BRIDGE_USER_AUTH_OIDC_CLIENT_ID="console-oauth-client-https"
BRIDGE_USER_AUTH_OIDC_CLIENT_SECRET_FILE="/bridge-auth-https/console-client-secret"
BRIDGE_USER_AUTH_OIDC_CA_FILE="/bridge-auth-https/ca.crt"
BRIDGE_CA_FILE="/bridge-auth-https/ca-bundle.crt"
BRIDGE_SERVICE_CA_FILE="/bridge-auth-https/ca-bundle.crt"

BRIDGE_K8S_MODE="off-cluster"
BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true
BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(oc whoami --show-server)
# The monitoring operator is not always installed (e.g. for local OpenShift). Tolerate missing config maps.
set +e
BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.thanosPublicURL}' 2>/dev/null)
BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.alertmanagerPublicURL}' 2>/dev/null)
set -e
BRIDGE_USER_SETTINGS_LOCATION="localstorage"
BRIDGE_I18N_NAMESPACES="plugin__${PLUGIN_NAME}"

# Don't fail if the cluster doesn't have gitops.
set +e
GITOPS_HOSTNAME=$(oc -n openshift-gitops get route cluster -o jsonpath='{.spec.host}' 2>/dev/null)
set -e
if [ -n "${GITOPS_HOSTNAME}" ]; then
  BRIDGE_K8S_MODE_OFF_CLUSTER_GITOPS="https://${GITOPS_HOSTNAME}"
fi

#
# If using Docker ...
#
# Docker uses its default bridge, by default, for new containers.
# Therefore, this network is not necessarily capable of resolving
# the domain name to your cluster. So you might have to create a
# network capable of resolving your cluster and add it here.
#
DOCKER_NETWORK=

if [ -n ${DOCKER_NETWORK} ]; then
  DOCKER_NET_ARG="--network ${DOCKER_NETWORK}"
  echo "Docker network: ${DOCKER_NETWORK}"
fi

#
# Provides the endpoint for the plugin gateway proxy service
#
function getBridgePluginProxy {
  local endpoint="https://${PLUGIN_GATEWAY_HOST}"
  echo "{\"services\": [{\"consoleAPIPath\": \"/api/proxy/plugin/${PLUGIN_NAME}/${GATEWAY_SERVICE}/\", \"endpoint\":\"${endpoint}\",\"authorize\":true}]}"
}

echo "API Server: ${BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT}"
echo "Console Image: ${CONSOLE_IMAGE}"
echo "Console URL: ${BRIDGE_BASE_ADDRESS}"
echo "Console Platform: ${CONSOLE_IMAGE_PLATFORM}"
echo "Bridge Plugin Proxy: $(getBridgePluginProxy)"

#
# Prefer podman if installed, especially given that it is better
# at handling localhost than docker
#
if [ -x "$(command -v podman)" ]; then
  if [ "$(uname -s)" = "Linux" ]; then
    # Use host networking on Linux since host.containers.internal is unreachable in some environments.
    podman run --pull always \
      --platform ${CONSOLE_IMAGE_PLATFORM} \
      --rm -v ./bridge-auth-https:/bridge-auth-https:z \
      --rm -v ./tls-certificates:/tls-certificates:z \
      --rm --network=host \
      --env-file <(set | grep BRIDGE) \
      --env BRIDGE_PLUGINS="${PLUGIN_NAME}=https://localhost:9444" \
      --env BRIDGE_PLUGIN_PROXY="$(getBridgePluginProxy)" \
      ${CONSOLE_IMAGE}
  else
    podman run --pull always \
      --platform ${CONSOLE_IMAGE_PLATFORM} \
      --rm -v ./bridge-auth-https:/bridge-auth-https:z \
      --rm -v ./tls-certificates:/tls-certificates:z \
      --rm -p "${CONSOLE_PORT}":9442 \
      --env-file <(set | grep BRIDGE) \
      --env BRIDGE_PLUGINS="${PLUGIN_NAME}=https://host.containers.localhost:9444" \
      --env BRIDGE_PLUGIN_PROXY="$(getBridgePluginProxy)" \
      ${CONSOLE_IMAGE}
  fi
elif [ -x "$(command -v docker)" ]; then
    docker run --pull always \
      --platform ${CONSOLE_IMAGE_PLATFORM} \
      --rm -v ./bridge-auth-https:/bridge-auth-https:z \
      --rm -v ./tls-certificates:/tls-certificates:z \
      --rm -p "${CONSOLE_PORT}":9442 \
      ${DOCKER_NET_ARG} \
      --env-file <(set | grep BRIDGE) \
      --env BRIDGE_PLUGINS="${PLUGIN_NAME}=https://${DOCKER_PLUGIN_HOST}:9444" \
      --env BRIDGE_PLUGIN_PROXY="$(getBridgePluginProxy)" \
      ${CONSOLE_IMAGE}
else
  echo "Error: Need to install either docker or podman"
fi
