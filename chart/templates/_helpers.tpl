{{/* Release-scoped name, so two installs in one namespace do not collide. */}}
{{- define "json-store-web.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "json-store-web.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "json-store-web.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "json-store-web.labels" -}}
app.kubernetes.io/name: {{ include "json-store-web.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/component: web
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "json-store-web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "json-store-web.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
