DEVELOPER.md - Complete Setup Guide

# Developer Guide: Running Hawtio Online Console Plugin Locally

This guide explains how to run the Hawtio Online Console Plugin against an OpenShift
4.22 console for local development and testing.

## Architecture Overview

The setup consists of three components:
1. **Gateway** (`packages/gateway`): Proxy service that handles Jolokia connections (ports 2772, 3000)
2. **Plugin** (`packages/plugin`): Console plugin webpack dev server (port 9444)
3. **OpenShift Console**: Containerized console that loads the plugin (port 9442)

## Prerequisites

### Required Tools
- **Node.js**: >= 22.x (check: `node --version`)
- **Yarn**: >= 4.16.0 (check: `yarn --version`)
- **OpenShift CLI**: `oc` or `kubectl` (check: `oc version`)
- **Container Runtime**: `podman` (preferred) or `docker` (check: `podman --version`)
- **OpenSSL**: For certificate generation (check: `openssl version`)
- **jq**: For JSON parsing (check: `jq --version`)
- **Python**: For base64 decoding (check: `python --version`)

### Cluster Access
You must be logged into an OpenShift cluster with sufficient permissions:
`oc login --server=https://api.crc.testing:6443 --username=kubeadmin`

Verify access to required namespaces
oc get secrets -n openshift-service-ca
oc get cm -n openshift-kube-apiserver

**Required Permissions:**
- Read access to `openshift-service-ca` namespace (for CA extraction)
- Read access to `openshift-kube-apiserver` namespace (for CA bundle)
- Ability to create OAuth clients
- Ability to create service accounts and secrets

## Initial Setup (One-Time)

### 1. Install Dependencies
From the **root directory**:
Install all dependencies
`yarn install`

2 ### 2. Configure Gateway Environment
3
4 Navigate to the gateway package and create the environment file:
cd packages/gateway

Copy the defaults to create your .env.development file
cp env.development.defaults .env.development
1
2 **Edit `.env.development`** and verify/update these critical settings:
Gateway ports
HAWTIO_ONLINE_GATEWAY_APP_PORT=3000
HAWTIO_ONLINE_GATEWAY_DEV_WEB_PORT=2772

Your cluster API endpoint
HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER=https://api.crc.testing:6443

Get your token (run this command and paste the output)
oc whoami -t
HAWTIO_ONLINE_GATEWAY_CLUSTER_TOKEN=sha256~your-token-here

Certificate paths (relative to gateway directory)
HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE_CA=../../tls-certificates/certificate-authority.crt
HAWTIO_ONLINE_GATEWAY_SSL_KEY=../../tls-certificates/server.localhost.key
HAWTIO_ONLINE_GATEWAY_SSL_CERTIFICATE=../../tls-certificates/server.localhost.crt
HAWTIO_ONLINE_GATEWAY_SSL_PROXY_KEY=../../tls-certificates/proxy.localhost.key
HAWTIO_ONLINE_GATEWAY_SSL_PROXY_CERTIFICATE=../../tls-certificates/proxy.localhost.crt

Logging
LOG_LEVEL=info

Disable TLS verification for development
NODE_TLS_REJECT_UNAUTHORIZED=0

Don't mask IPs in development
HAWTIO_ONLINE_MASK_IP_ADDRESSES=false
1
2 **Important:** Get your cluster token with:
oc whoami -t
1
2 Return to root directory:
cd ../..
1
2 ### 3. Generate TLS Certificates
3
4 From the **root directory**, generate the required certificates:
cd tls-certificates
./generate-dev-certs.sh
cd ..
1
2 **What this does:**
3 - Extracts the CA certificate and key from your OpenShift cluster
4 - Generates server certificates for localhost
5 - Generates proxy certificates for gateway communication
6 - Creates: `certificate-authority.{crt,key}`, `server.localhost.{crt,key}`,
`proxy.localhost.{crt,key}`
7
8 **Troubleshooting:**
9 - If you get "permission denied", ensure you're logged into the cluster
10 - If extraction fails, verify you have access to `openshift-service-ca` namespace
11 - Certificates are valid for 10 years (3650 days)
12
13 ### 4. Setup OAuth for Console Authentication
14
15 Navigate to the plugin directory and run the OAuth setup:
cd packages/plugin
yarn bridge-auth
cd ../..
1
2 **What this does:**
3 - Creates an OAuth client named `console-oauth-client-https`
4 - Extracts the client secret to `bridge-auth-https/console-client-secret`
5 - Extracts the cluster CA certificate to `bridge-auth-https/ca.crt`
6 - Extracts the API server CA bundle to `bridge-auth-https/ca-bundle.crt`
7
8 **Troubleshooting:**
9 - If OAuth client creation fails, check if it already exists: `oc get oauthclient
console-oauth-client-https`
10 - If it exists, delete it first: `oc delete oauthclient console-oauth-client-https`
11 - Ensure you have permissions to create OAuth clients
12
13 ## Running the Development Environment
14
15 ### Terminal 1: Start the Gateway
16
17 From the **root directory**:
cd packages/gateway
yarn start
1
2 **Expected output:**
✓ Built in XXXms
Listening on port 2772
[INFO] Gateway API server listening on port 3000
1
2 **What's running:**
3 - Proxy dev server on port 2772 (forwards to gateway)
4 - Gateway API server on port 3000 (handles Jolokia connections)
5
6 **Troubleshooting:**
7 - **Port already in use**: Kill existing processes on ports 2772 or 3000
lsof -ti:2772 | xargs kill -9
lsof -ti:3000 | xargs kill -9
1 - **Certificate errors**: Verify certificates exist in `../../tls-certificates/`
2 - **Cluster connection errors**: Verify your token is valid: `oc whoami -t`
3
4 ### Terminal 2: Start the Plugin Dev Server
5
6 From the **root directory**:
cd packages/plugin
yarn start:plugin
1
2 **Expected output:**
<i> [webpack-dev-server] Project is running at:
<i> [webpack-dev-server] Loopback: https://localhost:9444/
1
2 **What's running:**
3 - Webpack dev server on port 9444
4 - Hot module reloading enabled
5 - Plugin serves at `https://localhost:9444`
6
7 **Troubleshooting:**
8 - **Port 9444 in use**: Kill the process: `lsof -ti:9444 | xargs kill -9`
9 - **Build errors**: Check for TypeScript or dependency issues
10 - **Certificate warnings**: Accept the self-signed certificate in your browser
11
12 ### Terminal 3: Start the OpenShift Console
13
14 From the **root directory**:
cd packages/plugin
yarn start:console
1
2 **What this does:**
3 1. Verifies OAuth setup (runs `yarn bridge-auth` again)
4 2. Verifies certificates (runs `yarn cert-gen` again)
5 3. Starts a containerized OpenShift console
6 4. Configures it to load your local plugin
7
8 **Expected output:**
Using Local Plugin Gateway Host: host.containers.internal:3000
API Server: https://api.crc.testing:6443
Console Image: quay.io/openshift/origin-console:latest
Console URL: https://localhost:9442
Bridge Plugin Proxy:
{"services":[{"consoleAPIPath":"/api/proxy/plugin/hawtio-online-console-plugin/gateway/",
"endpoint":"https://host.containers.internal:3000","authorize":true}]}
1
2 **Access the console:**
3 Open your browser to: **https://localhost:9442**
4
5 **Login credentials:**
6 - Use your OpenShift cluster credentials (e.g., `kubeadmin` for CRC)
7
8 **Troubleshooting:**
9 - **Container fails to start**: Check podman/docker is running
10 - **Cannot connect to cluster**: Verify `oc whoami --show-server` returns correct URL
11 - **Plugin not loading**: Check Terminal 2 shows plugin is running on port 9444
12 - **Gateway connection errors**: Verify Terminal 1 shows gateway is running
13
14 ### Verifying the Setup
15
16 1. **Check Gateway is responding:**
curl -k https://localhost:3000/health
1
2 2. **Check Plugin is serving:**
curl -k https://localhost:9444/plugin-manifest.json
1
2 3. **Check Console is running:**
curl -k https://localhost:9442
1
2 4. **In the Console UI:**
3    - Navigate to **Workloads** → **Pods**
4    - Select a pod with Jolokia enabled
5    - Look for the **Hawtio** tab
6    - Click it to verify the plugin loads
7
8 ## Port Reference
9
10 | Service | Port | Purpose |
11 |---------|------|---------|
12 | Gateway Proxy | 2772 | Development proxy server |
13 | Gateway API | 3000 | Main gateway API server |
14 | Plugin Dev Server | 9444 | Webpack dev server (hot reload) |
15 | OpenShift Console | 9442 | Containerized console |
16
17 ## Common Issues and Solutions
18
19 ### Issue: "Cannot find kube cluster client command"
20 **Solution:** Install `oc` CLI or ensure it's in your PATH
which oc
1
2 ### Issue: "Error: failed to extract Server Certificate Authority"
3 **Solution:**
4 - Verify cluster login: `oc whoami`
5 - Check namespace access: `oc get secrets -n openshift-service-ca`
6 - Ensure you're not using a token that expired
7
8 ### Issue: Gateway shows "ECONNREFUSED" to cluster
9 **Solution:**
10 - Verify cluster is accessible: `oc cluster-info`
11 - Update `HAWTIO_ONLINE_GATEWAY_CLUSTER_MASTER` in `.env.development`
12 - Get fresh token: `oc whoami -t`
13
14 ### Issue: Console shows "Plugin failed to load"
15 **Solution:**
16 - Verify plugin dev server is running (Terminal 2)
17 - Check browser console for CORS or certificate errors
18 - Accept self-signed certificate at `https://localhost:9444`
19
20 ### Issue: "host.containers.internal" not resolving
21 **Solution:**
22 - On Linux with podman, the script uses `--network=host` automatically
23 - On macOS/Windows, `host.containers.internal` should work
24 - If issues persist, modify `LOCAL_GATEWAY_FALLBACK` in `start-console.sh`:
LOCAL_GATEWAY_FALLBACK="localhost:3000"
1
2 ### Issue: OAuth client already exists
3 **Solution:**
oc delete oauthclient console-oauth-client-https
cd packages/plugin
yarn bridge-auth
1
2 ### Issue: Certificates expired or invalid
3 **Solution:**
cd tls-certificates
rm -f *.crt *.key
./generate-dev-certs.sh
cd ..
1
2 ## Testing Against OpenShift 4.22
3
4 The plugin is configured to use OpenShift Console SDK version 4.22.0 (see `packages
/plugin/package.json`):
"@openshift-console/dynamic-plugin-sdk": "4.22.0",
"@openshift-console/dynamic-plugin-sdk-webpack": "4.22.0"
1
2 To test against a specific console version:
Set the console image version
export CONSOLE_IMAGE="quay.io/openshift/origin-console:4.22"

Start the console
cd packages/plugin
yarn start:console
1
2 ## Stopping the Development Environment
3
4 1. **Stop Console** (Terminal 3): `Ctrl+C` (container will auto-remove)
5 2. **Stop Plugin** (Terminal 2): `Ctrl+C`
6 3. **Stop Gateway** (Terminal 1): `Ctrl+C`
7
8 ## Clean Up
9
10 To remove generated files:
Remove certificates
cd tls-certificates
rm -f *.crt *.key *.srl

Remove OAuth files
cd ../packages/plugin/bridge-auth-https
rm -f console-client-secret ca.crt ca-bundle.crt

Remove OAuth client from cluster
oc delete oauthclient console-oauth-client-https
1
2 ## Development Workflow
3
4 1. **Make code changes** in `packages/plugin/src/`
5 2. **Plugin auto-reloads** (webpack hot reload)
6 3. **Refresh browser** to see changes
7 4. **Gateway changes** require restart (Terminal 1)
8 5. **Console changes** require restart (Terminal 3)
9
10 ## Next Steps
11
12 - Review plugin code in `packages/plugin/src/`
13 - Review gateway code in `packages/gateway/src/`
14 - Check console extensions in `packages/plugin/console-extensions.json`
15 - Test with different OpenShift versions by changing `CONSOLE_IMAGE`
16
17 ## Getting Help
18
19 - Check logs in each terminal for error messages
20 - Review browser console for client-side errors
21 - Check gateway logs for proxy/connection issues
22 - Verify cluster connectivity with `oc` commands
