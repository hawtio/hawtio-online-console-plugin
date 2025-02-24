# Hawtio Online Plugin

The Hawtio Online Console Plugin container is loaded into a working OCP cluster console to provide an embedded version of the Hawtio Console.

## Deployment

The plugin is installed with the command `make install` (from the root directory). which also installs the companion gateway service. However, it can also be installed separately using the command `make install-plugin`.

### Custom Deployment

Should there be a need to create a custom, development, version then the environment variables, `CUSTOM_PLUGIN_IMAGE` and `CUSTOM_PLUGIN_VERSION` can be populated to change the image.

## Development

In order to run the console, it is necessary to deploy the gateway to the target cluster. This is performed with the command `make install-gateway`.

The project file for the plugin provides the following commands that will aid in development and testing of the image:

- `yarn start:plugin`: Starts a development version of the plugin server;
- `yarn start:console`: Starts a development version of the OCP console and loads in the running development plugin;

> [!NOTE]  
> Both of these commands should be executed in different terminals.

- `yarn build`: Builds the product version of the plugin.
