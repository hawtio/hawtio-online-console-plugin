# Hawtio Online Gateway

A partner container, based on [node](https://nodejs.org), to the Hawtio Online Console Plugin container that provides access to the jolokia ports of target applications.

- The Hawtio Online Console Plugin will defer to the gateway's [_/managment_] endpoint to access the jolokia endpoint;
- The gateway also has a [_/status_] endpoint which provides a heartbeat capability.

## Deployment

The gateway is installed as part of the plugin install with the command `make install` (from the root directory). However, it can also be installed separately using the command `make install-gateway`. This is particularly useful when running the Console Plugin in development mode.

### Custom Deployment

Should there be a need to create a custom, development, version then the environment variables, `CUSTOM_GATEWAY_IMAGE` and `CUSTOM_GATEWAY_VERSION` can be populated to change the image.

### Logging of the Deployment

By default, the logging level of the gateway container log is set to 'info'. Should more
information be required then this can be modified to either 'debug' or 'trace' by adding
the environment variable `HAWTIO_ONLINE_GATEWAY_LOG_LEVEL` to the deployment:

- `kubectl/oc edit deployment hawtio-online`: Open the deployment resource for editing
- Add the environment variable `HAWTIO_ONLINE_GATEWAY_LOG_LEVEL` with the preferred level
  to the `hawtio-online-gateway` container:
  ```
  - env:
    - name: HAWTIO_ONLINE_RBAC_ACL
    ...
    - name: HAWTIO_ONLINE_GATEWAY_LOG_LEVEL
      value: trace
  ```
- Save the edit and await the re-deployment of the pod.

## Development

The project file for the gateway provides the following commands that will aid in development and testing of the image:

- `yarn start`: Starts a development version of the gateway server;

> [!NOTE]  
> This has limited use at this time since it is not capable of accessing the target jolokia applications. The jolokia agent extracts the target app's IP address and then tries to connect to it directly. Since the install of the gateway is inside the cluster then this works correctly but when run externally these IP addresses are not exposed.

- `yarn build`: Builds the product version of the gateway server.

### Changing properties of the development servers

An `.env.development` file should be created in the [gateway](https://github.com/hawtio/hawtio-online-console-plugin/tree/master/packages/gateway) package directory. A [default](https://github.com/hawtio/hawtio-online/tree/master/packages/gateway/env.development.defaults) version is already provided in the directory and can be copied and modified to suit the individual install. The following are environment variables that can be updated.
