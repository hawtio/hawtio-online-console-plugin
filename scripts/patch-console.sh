#!/bin/bash

if [ -z "${1}" ]; then
  echo "Error ${0} <plugin-name>"
  exit 1
fi

check_kubectl() {
  if [ "$(command -v oc 2> /dev/null)" == '' ]; then

    if [ "$(command -v kubectl 2> /dev/null)" == '' ]; then
      echo "Error: No oc or kubectl found in PATH. Please install and re-run"
      exit 1
    else
      echo $(command -v kubectl 2> /dev/null)
    fi
  fi

  echo $(command -v oc 2> /dev/null)
}

check_jq() {
  if [ "$(command -v jq 2> /dev/null)" == '' ]; then
    echo "Error: No jq found in PATH. Please install and re-run"
    exit 1
  fi

  echo $(command -v jq 2> /dev/null)
}

PLUGIN="${1}"
KUBECTL=$(check_kubectl)
JQ=$(check_jq)

echo "plugin name ... ${PLUGIN}"
echo "jq found at ... ${JQ}"
echo "oc/kubectl found at ... ${KUBECTL}"

existingPlugins=$(oc get consoles.operator.openshift.io cluster -o json | \
  jq -c '.spec.plugins // []')
echo "Existing plugins ... ${existingPlugins}"

mergedPlugins=$(jq \
  --argjson existingPlugins "${existingPlugins}" \
  --argjson consolePlugin "[\"${PLUGIN}\"]" \
  -c  -n '$existingPlugins + $consolePlugin | unique')
echo "Merged plugins ... ${mergedPlugins}"

patchedPlugins=$(jq --argjson mergedPlugins ${mergedPlugins} \
  -n -c '{ "spec": { "plugins": $mergedPlugins } }')
echo "Patched plugins ... ${patchedPlugins}"

${KUBECTL} patch consoles.operator.openshift.io cluster \
  --patch ${patchedPlugins} --type=merge
