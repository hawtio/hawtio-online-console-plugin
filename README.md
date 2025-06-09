# Hawtio Online OpenShift Console Plugin

A dynamic plugin that integrates the [Hawtio Online](github.com/hawtio/hawtio-online) console into the OpenShift console.


### Installation

The plugin is not released. However, a development alpha version can be installed using helm from the [hawtio-charts](https://github.com/hawtio/hawtio-charts) repository.


### Using the plugin

Once installed, the plugin features should be accessible in the OpenShift Console.

- The OpenShift Console plugins can be viewed by clicking the link on the Overview page.
![OCP Console Overview](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-overview-page.png?raw=true)


- The Dynamic Plugin List page displays the list of plugins and their enabled status. Ensure the HawtIO plugin is enabled and, if necessary, refresh the console UI.
![OCP Console Dynamic Plugin List](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-dynamic-plugin-list.png?raw=true)

- The Details page for each pod will contain an additional HawtIO tab.
![OCP Console Pod Details](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-pod-details.png?raw=true)

- Clicking on the HawtIO tab will load the embedded HawtIO Console (assuming the pod is jolokia-compliant).
![OCP Console Pod Details Hawtio Console](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-pod-hawtio-tab.png?raw=true)

- Also, the plugin provides a HawtIO button in the navigation menu for accessing the HawtIO Discover page.
![OCP Console HawtIO Nav Button](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-nav-hawtio.png?raw=true)

- The Discover page allows selection of only the jolokia-compliant pods in each namespace. Upon selection, the pod is loaded into the embedded HawtIO console. The selected pod and namespace can be changed in the dropdown controls at the top of the page; this will refresh the HawtIO console.
![OCP Console HawtIO Discover Page](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-nav-hawtio-clicked.png?raw=true)
