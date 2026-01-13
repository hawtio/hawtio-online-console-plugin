{{/*
  Generate the proxying certificate to access the jolokia pods
  - Looks up the signing Certifcate Authority in the cluster
  - Extracts the key and certificate from the CA
  - Builds a custom certificate to convert the CA to a Certificate Object
  - Generates a new proxy certificate signed by the CA
  - Outputs the proxy certificate's key and certificate as tls.key and tls.crt respectively
*/}}
{{- define "hawtio-online-console-plugin.proxy.gen-cert" -}}
{{- $caSecret := (lookup "v1" "Secret" "openshift-service-ca" "signing-key") }}
{{- if not $caSecret }}
{{- fail "Error: OCP signing-key is required" }}
{{- end }}
{{- $caKey := (index $caSecret.data "tls.key") }}
{{- if not $caKey }}
{{- fail "Error: OCP signing-key tls.key is required" }}
{{- end }}
{{- $caCert := (index $caSecret.data "tls.crt") }}
{{- if not $caCert }}
{{- fail "Error: OCP signing-key tls.crt is required" }}
{{- end }}
{{- $ca := buildCustomCert $caCert $caKey }}
{{- $cert := (genSignedCert "hawtio-online.hawtio.svc" nil nil 365 $ca) -}}
{{ (print "tls.key: " ($cert.Key | b64enc)) | indent 2 }}
{{ (print "tls.crt: " ($cert.Cert | b64enc)) | indent 2 }}
{{- end }}

{{/*
  kubernetes app labels
  - Parameter: value of the label
*/}}
{{- define "hawtio-online-console-plugin.app.labels" -}}
app: {{ .name }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/instance: {{ .name }}
app.kubernetes.io/part-of: {{ .application }}
app.kubernetes.io/managed-by: Helm
{{- end }}

{{/*
Expand the name of the chart.
*/}}
{{- define "hawtio-online-console-plugin.name" -}}
{{ required "A plugin name is required!" .Values.plugin.name }}
{{- end }}

{{/*
Create the name of the patch service account to use
*/}}
{{- define "hawtio-online-console-plugin.patchServiceAccountName" -}}
{{- if .Values.plugin.jobs.patchConsoles.patchServiceAccount.create }}
{{- default (printf "%s-patcher" (include "hawtio-online-console-plugin.name" .)) .Values.plugin.jobs.patchConsoles.patchServiceAccount.name }}
{{- else }}
{{- default "default" .Values.plugin.jobs.patchConsoles.patchServiceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the console patcher
*/}}
{{- define "hawtio-online-console-plugin.patcherName" -}}
{{- printf "%s-patcher" (include "hawtio-online-console-plugin.name" .) }}
{{- end }}
