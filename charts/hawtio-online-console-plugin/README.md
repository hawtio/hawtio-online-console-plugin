# Hawtio Online OpenShift Console Plugin

A dynamic [plugin](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk) for the [OpenShift](https://www.redhat.com/en/technologies/cloud-computing/openshift) console, which integrates the [Hawtio Online](github.com/hawtio/hawtio-online) console into the OpenShift console.


### Installation

This is currently a pre-released, development version.


### Using the plugin

Once installed, the plugin features should be accessible in the OpenShift Console.

- The OpenShift Console plugins can be viewed by clicking the link on the Overview page.
![OCP Console Overview](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-overview-page.png?raw=true)


- The Dynamic Plugin List page displays the list of plugins and their enabled status. The HawtIO plugin should be enabled yet, if not then toggle and refresh the console UI.
![OCP Console Dynamic Plugin List](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-dynamic-plugin-list.png?raw=true)

- Selecting a pod in the Workloads > Pods list, displays its Details. An additional HawtIO tab is displayed here.
![OCP Console Pod Details](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-pod-details.png?raw=true)

- Clicking on the HawtIO tab will load the embedded HawtIO Console, assuming the pod is jolokia-compliant (an error message will be displayed if it is not).
![OCP Console Pod Details Hawtio Console](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-pod-hawtio-tab.png?raw=true)

- In addition the plugin also provides a HawtIO button in the navigation menu, under Workload, for accessing the HawtIO Discover page.
![OCP Console HawtIO Nav Button](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-nav-hawtio.png?raw=true)

- The Discover page allows selection of only the jolokia-compliant pods in each namespace. Upon selection, the pod is loaded into the embedded HawtIO console. The selected pod and namespace can be changed in the dropdown controls at the top of the page; this will refresh the HawtIO console.
![OCP Console HawtIO Discover Page](https://github.com/hawtio/hawtio-online-console-plugin/blob/main/docs/images/ocp-console-nav-hawtio-clicked.png?raw=true)
