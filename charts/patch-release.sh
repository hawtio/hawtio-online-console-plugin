#!/bin/bash

# ==============================================================================
# CONFIGURATION
# ==============================================================================
PATCHING="patching"
CHART_NAME="hawtio-online-console-plugin"
REPO_URL="https://hawtio.github.io/hawtio-charts"
ANNOTATION_KEY="artifacthub.io/prerelease"
ANNOTATION_VAL="true"

# ==============================================================================
# CHECKS & INPUT
# ==============================================================================

# Check for arguments
if [ -z "${1}" ]; then
  echo "Usage: ${0} <version>"
  echo "Example: ${0} 1.2.3"
  exit 1
fi

VERSION="${1}"

# Check for dependencies
if ! command -v helm &> /dev/null; then
    echo "Error: 'helm' is not installed."
    exit 1
fi

if ! command -v yq &> /dev/null; then
    echo "Error: 'yq' is not installed. Please install it (https://github.com/mikefarah/yq)."
    # OPTIONAL: You could write a rudimentary sed/cat fallback here, but it's risky with YAML indentation.
    exit 1
fi

echo "========================================================"
echo " Patching ${CHART_NAME} version ${VERSION}"
echo "========================================================"

# ==============================================================================
# EXECUTION
# ==============================================================================

# Remove old patching directory if exists
if [ -d "${PATCHING}" ]; then
  rm -rf "${PATCHING}"
fi

mkdir -p "${PATCHING}"
pushd "${PATCHING}" > /dev/null

# Pull and Unpack
echo "Downloading and unpacking version ${VERSION}..."
helm pull "${CHART_NAME}" --repo "${REPO_URL}" --version "${VERSION}" --untar
if [ -d "${CHART_NAME}-${VERSION}.tgz" ]; then
  rmdir "${CHART_NAME}-${VERSION}.tgz"
fi

if [ ! -d "${CHART_NAME}" ]; then
  echo "Error: Failed to unpack chart. Check version exists."
  popd > /dev/null
  exit 1
fi

# Modify Chart.yaml
echo "Injecting Artifact Hub annotation..."
CHART_FILE="${CHART_NAME}/Chart.yaml"

# Uses yq to safely add the annotation.
# Logic: If '.annotations' doesn't exist, create it. Then set the key.
yq -i ".annotations[\"${ANNOTATION_KEY}\"] = \"${ANNOTATION_VAL}\"" "${CHART_FILE}"

# Verify the change locally
if grep -q "${ANNOTATION_KEY}" "${CHART_FILE}"; then
  echo "   -> Annotation injected successfully."
else
  echo "Error: Failed to patch Chart.yaml."
  rm -rf "${CHART_NAME}"
  popd > /dev/null
  exit 1
fi

# Repackage
echo "Repackaging chart..."
# This creates a new .tgz file in the current directory
helm package "${CHART_NAME}"
if [ "${?}" != "0" ]; then
  popd > /dev/null
  exit 1
fi

# Cleanup
echo "Cleaning up extracted files..."
rm -rf "${CHART_NAME}"

echo "========================================================"
echo " SUCCESS: ${CHART_NAME}-${VERSION}.tgz has been rebuilt."
echo "========================================================"

echo "Create index file to merge with registery"
helm repo index . --url ${REPO_URL}

popd > /dev/null
