#!/bin/bash

CONSOLE="hawtio-online-console-plugin"
PUBLISH_DIR="publish"
HELM_REPO_URL="https://hawtio.github.io/hawtio-charts"
REPO_DIR="hawtio-charts"
REPO="git@github.com:hawtio/${REPO_DIR}.git"

if [ -d ${PUBLISH_DIR} ]; then
  rm -rf ${PUBLISH_DIR}
fi

helm package ${CONSOLE}

package=`ls ${CONSOLE}*.tgz`
echo "Packaged ${package}"
echo "Note: this refers to the helm chart version not the app version!!"

if [ ! -f "${package}" ]; then
  echo "Error: Failed to package ${CONSOLE}"
  exit 1
fi

app_version=`helm show chart hawtio-online-console-plugin | grep appVersion | awk '{print $2}'`
echo "App Version: ${app_version}"

mkdir ${PUBLISH_DIR}

APP_PACKAGE="${CONSOLE}-${app_version}.tgz"

echo "Moving package tar archive to ${APP_PACKAGE}"
mv ${package} "${PUBLISH_DIR}/${APP_PACKAGE}"

REPO_INDEX="hawtio-charts-index.yaml"
curl "${HELM_REPO_URL}/index.yaml" -o ${PUBLISH_DIR}/${REPO_INDEX}

if [ ! -f "${PUBLISH_DIR}/${REPO_INDEX}" ]; then
  echo "Error: Failed to download repository from ${HELM_REPO_URL}"
  exit 1
fi

helm repo index ${PUBLISH_DIR} \
  --merge ${PUBLISH_DIR}/${REPO_INDEX} \
  --url ${HELM_REPO_URL}

pushd ${PUBLISH_DIR} > /dev/null

git clone ${REPO} ${REPO_DIR}
if [ ! -d "${REPO_DIR}" ]; then
  echo "Error: Failed to clone github source repo from ${REPO}"
  exit 1
fi

mv ${APP_PACKAGE} ${REPO_DIR}/docs/
mv index.yaml ${REPO_DIR}/docs/

echo
echo "============================================================"
echo "="
echo "= Packaging Completed."
echo "="
echo "= Check the index to ensure merge has append rather than overwritten"
echo "="
echo "= Navigate to ${PUBLISH_DIR}/${REPO_DIR} and commit the result."
echo "="
echo "============================================================"

popd > /dev/null
