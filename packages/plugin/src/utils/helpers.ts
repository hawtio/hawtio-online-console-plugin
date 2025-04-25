import { PodStatus } from 'kubernetes-types/core/v1'
import { WatchTypes, NamespacedTypes, ExtensionTypes, KindTypes } from './model'
import { joinPaths } from './urls'
import { isObject, pathGetObject, pathGetString } from './objects'
import { K8sPod, K8sObject } from '../types'

export const CONSOLE_SDK_BASEPATH = '/api/kubernetes'

export const K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'

export function namespaced(kind: string): boolean {
  switch (kind) {
    case WatchTypes.POLICIES:
    case WatchTypes.OAUTH_CLIENTS:
    case WatchTypes.NAMESPACES:
    case WatchTypes.NODES:
    case WatchTypes.PERSISTENT_VOLUMES:
    case WatchTypes.PROJECTS:
      return false
    default:
      return true
  }
}

export function kubernetesApiPrefix(): string {
  return joinPaths(K8S_PREFIX, K8S_API_VERSION)
}

export function kubernetesApiExtensionPrefix(): string {
  return joinPaths(K8S_EXT_PREFIX, K8S_EXT_VERSION)
}

export function openshiftApiPrefix(kind: string) {
  return joinPaths(OS_PREFIX, apiGroupForKind(kind), OS_API_VERSION)
}

function apiForKind(kind: string): string {
  if (kind === WatchTypes.NAMESPACES) {
    return K8S_PREFIX
  }
  if (ExtensionTypes.extensions.some(t => t === kind)) {
    return K8S_EXT_PREFIX
  }
  if (NamespacedTypes.k8sTypes.some(t => t === kind)) {
    return K8S_PREFIX
  }
  if (NamespacedTypes.osTypes.some(t => t === kind)) {
    return OS_PREFIX
  }
  if (kind === WatchTypes.IMAGES) {
    return OS_PREFIX
  }
  return ''
}

function apiGroupForKind(kind: string): string {
  switch (kind) {
    case WatchTypes.OAUTH_CLIENTS:
      return 'oauth.openshift.io'
    case WatchTypes.BUILDS:
    case WatchTypes.BUILD_CONFIGS:
      return 'build.openshift.io'
    case WatchTypes.DEPLOYMENT_CONFIGS:
      return 'apps.openshift.io'
    case WatchTypes.IMAGES:
    case WatchTypes.IMAGE_STREAMS:
    case WatchTypes.IMAGE_STREAM_TAGS:
      return 'image.openshift.io'
    case WatchTypes.PROJECTS:
      return 'project.openshift.io'
    case WatchTypes.ROLES:
    case WatchTypes.ROLE_BINDINGS:
      return 'authorization.openshift.io'
    case WatchTypes.ROUTES:
      return 'route.openshift.io'
    case WatchTypes.TEMPLATES:
      return 'template.openshift.io'
    default:
      return ''
  }
}

export function prefixForKind(kind: string): string | null {
  const api = apiForKind(kind)
  switch (api) {
    case K8S_EXT_PREFIX:
      return kubernetesApiExtensionPrefix()
    case K8S_PREFIX:
      return kubernetesApiPrefix()
    case OS_PREFIX:
      return openshiftApiPrefix(kind)
    default:
      return null
  }
}

/*
 * Returns the single 'kind' of an object from the collection kind
 */
export function toKindName(kind: K8sObject | string): string | null {
  if (isObject(kind)) {
    return getKind(kind)
  }
  switch (kind) {
    case WatchTypes.LIST:
      return KindTypes.LIST
    case WatchTypes.ENDPOINTS:
      return KindTypes.ENDPOINTS
    case WatchTypes.EVENTS:
      return KindTypes.EVENTS
    case WatchTypes.NAMESPACES:
      return KindTypes.NAMESPACES
    case WatchTypes.NODES:
      return KindTypes.NODES
    case WatchTypes.PERSISTENT_VOLUMES:
      return KindTypes.PERSISTENT_VOLUMES
    case WatchTypes.PERSISTENT_VOLUME_CLAIMS:
      return KindTypes.PERSISTENT_VOLUME_CLAIMS
    case WatchTypes.PODS:
      return KindTypes.PODS
    case WatchTypes.REPLICATION_CONTROLLERS:
      return KindTypes.REPLICATION_CONTROLLERS
    case WatchTypes.REPLICA_SETS:
      return KindTypes.REPLICA_SETS
    case WatchTypes.RESOURCE_QUOTAS:
      return KindTypes.RESOURCE_QUOTAS
    case WatchTypes.OAUTH_CLIENTS:
      return KindTypes.OAUTH_CLIENTS
    case WatchTypes.SECRETS:
      return KindTypes.SECRETS
    case WatchTypes.SERVICES:
      return KindTypes.SERVICES
    case WatchTypes.SERVICE_ACCOUNTS:
      return KindTypes.SERVICE_ACCOUNTS
    case WatchTypes.CONFIG_MAPS:
      return KindTypes.CONFIG_MAPS
    case WatchTypes.INGRESSES:
      return KindTypes.INGRESSES
    case WatchTypes.TEMPLATES:
      return KindTypes.TEMPLATES
    case WatchTypes.ROUTES:
      return KindTypes.ROUTES
    case WatchTypes.BUILD_CONFIGS:
      return KindTypes.BUILD_CONFIGS
    case WatchTypes.BUILDS:
      return KindTypes.BUILDS
    case WatchTypes.DEPLOYMENT_CONFIGS:
      return KindTypes.DEPLOYMENT_CONFIGS
    case WatchTypes.DEPLOYMENTS:
      return KindTypes.DEPLOYMENTS
    case WatchTypes.IMAGES:
      return KindTypes.IMAGES
    case WatchTypes.IMAGE_STREAMS:
      return KindTypes.IMAGE_STREAMS
    case WatchTypes.IMAGE_STREAM_TAGS:
      return KindTypes.IMAGE_STREAM_TAGS
    case WatchTypes.POLICIES:
      return KindTypes.POLICIES
    case WatchTypes.POLICY_BINDINGS:
      return KindTypes.POLICY_BINDINGS
    case WatchTypes.PROJECTS:
      return KindTypes.PROJECTS
    case WatchTypes.ROLE_BINDINGS:
      return KindTypes.ROLE_BINDINGS
    case WatchTypes.ROLES:
      return KindTypes.ROLES
    case WatchTypes.DAEMONSETS:
      return KindTypes.DAEMONSETS
    default:
      return kind
  }
}

/*
 * Returns the collection kind of an object from the singular kind
 */
export function toCollectionName(kind: K8sObject | string): string | null {
  if (isObject(kind)) {
    const k = getKind(kind)
    if (!k) return null

    kind = k
  }

  switch (kind) {
    case KindTypes.LIST:
      return WatchTypes.LIST
    case KindTypes.ENDPOINTS:
      return WatchTypes.ENDPOINTS
    case KindTypes.EVENTS:
      return WatchTypes.EVENTS
    case KindTypes.NAMESPACES:
      return WatchTypes.NAMESPACES
    case KindTypes.NODES:
      return WatchTypes.NODES
    case KindTypes.PERSISTENT_VOLUMES:
      return WatchTypes.PERSISTENT_VOLUMES
    case KindTypes.PERSISTENT_VOLUME_CLAIMS:
      return WatchTypes.PERSISTENT_VOLUME_CLAIMS
    case KindTypes.PODS:
      return WatchTypes.PODS
    case KindTypes.REPLICATION_CONTROLLERS:
      return WatchTypes.REPLICATION_CONTROLLERS
    case KindTypes.REPLICA_SETS:
      return WatchTypes.REPLICA_SETS
    case KindTypes.RESOURCE_QUOTAS:
      return WatchTypes.RESOURCE_QUOTAS
    case KindTypes.OAUTH_CLIENTS:
      return WatchTypes.OAUTH_CLIENTS
    case KindTypes.SECRETS:
      return WatchTypes.SECRETS
    case KindTypes.SERVICES:
      return WatchTypes.SERVICES
    case KindTypes.SERVICE_ACCOUNTS:
      return WatchTypes.SERVICE_ACCOUNTS
    case KindTypes.CONFIG_MAPS:
      return WatchTypes.CONFIG_MAPS
    case KindTypes.INGRESSES:
      return WatchTypes.INGRESSES
    case KindTypes.TEMPLATES:
      return WatchTypes.TEMPLATES
    case KindTypes.ROUTES:
      return WatchTypes.ROUTES
    case KindTypes.BUILD_CONFIGS:
      return WatchTypes.BUILD_CONFIGS
    case KindTypes.BUILDS:
      return WatchTypes.BUILDS
    case KindTypes.DEPLOYMENT_CONFIGS:
      return WatchTypes.DEPLOYMENT_CONFIGS
    case KindTypes.DEPLOYMENTS:
      return WatchTypes.DEPLOYMENTS
    case KindTypes.IMAGES:
      return WatchTypes.IMAGES
    case KindTypes.IMAGE_STREAMS:
      return WatchTypes.IMAGE_STREAMS
    case KindTypes.IMAGE_STREAM_TAGS:
      return WatchTypes.IMAGE_STREAM_TAGS
    case KindTypes.POLICIES:
      return WatchTypes.POLICIES
    case KindTypes.POLICY_BINDINGS:
      return WatchTypes.POLICY_BINDINGS
    case KindTypes.PROJECTS:
      return WatchTypes.PROJECTS
    case KindTypes.ROLE_BINDINGS:
      return WatchTypes.ROLE_BINDINGS
    case KindTypes.ROLES:
      return WatchTypes.ROLES
    case KindTypes.DAEMONSETS:
      return WatchTypes.DAEMONSETS
    default:
      return kind
  }
}

/*
 * Compare two k8s objects based on their UID
 */
export function equals(left: K8sObject, right: K8sObject): boolean {
  const leftUID = getUID(left)
  const rightUID = getUID(right)
  if (!leftUID && !rightUID) {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return leftUID === rightUID
}

/**
 * Create an object suitable for delete/del
 */
export function createShallowObject(name: string, kind: string, namespace?: string) {
  return {
    apiVersion: K8S_API_VERSION,
    kind: toKindName(kind),
    metadata: {
      name: name,
      namespace: namespace,
    },
  }
}

/**
 * Returns a fully scoped name with the namespace/kind, suitable to use as a key in maps
 **/
export function fullName(entity: K8sObject): string {
  const namespace = getNamespace(entity)
  const kind = getKind(entity) || ''
  const name = getName(entity) || ''
  return joinPaths(namespace ? namespace : '', kind, name)
}

export function getUID(entity: K8sObject): string | null {
  return pathGetString(entity, ['metadata', 'uid'])
}

export function getNamespace(entity: K8sObject): string | null {
  // some objects aren't namespaced, so this can return null
  return pathGetString(entity, ['metadata', 'namespace'])
}

export function getApiVersion(entity: K8sObject): string | null {
  return pathGetString(entity, ['apiVersion'])
}

export function getLabels(entity: K8sObject): Record<string, unknown> | null {
  return pathGetObject(entity, ['metadata', 'labels'])
}

export function getName(entity: K8sObject | null): string | null {
  if (!entity) return null

  return pathGetString(entity, ['metadata', 'name']) || pathGetString(entity, 'name') || pathGetString(entity, 'id')
}

export function getKind(entity: K8sObject): string | null {
  return pathGetString(entity, ['metadata', 'kind']) || pathGetString(entity, 'kind')
}

export function getSelector(entity: K8sObject): string | null {
  return pathGetString(entity, ['spec', 'selector'])
}

export function getHost(pod: K8sPod): string | null {
  return (
    pathGetString(pod, ['spec', 'host']) ||
    pathGetString(pod, ['spec', 'nodeName']) ||
    pathGetString(pod, ['status', 'hostIP'])
  )
}

export function getStatus(pod: K8sPod): string | null {
  return pathGetString(pod, ['status', 'phase'])
}

export function getPorts(service: K8sObject): string | null {
  return pathGetString(service, ['spec', 'ports'])
}

export function getCreationTimestamp(entity: K8sObject): string | null {
  return pathGetString(entity, ['metadata', 'creationTimestamp'])
}

export function getClusterIP(entity: K8sObject): string | null {
  return pathGetString(entity, ['spec', 'clusterIP'])
}

/**
 * Returns true if the current status of the pod is running
 */
export function isRunning(podCurrentState: PodStatus): boolean {
  const status = (podCurrentState || {}).phase
  if (status) {
    const lower = status.toLowerCase()
    return lower.startsWith('run')
  } else {
    return false
  }
}

export function podStatus(pod: K8sPod): string | null {
  return getStatus(pod)
}

export function isOpenShift4(clusterVersion: string): boolean {
  const major = parseInt((clusterVersion || '4').split('.')[0], 10)
  return major >= 4
}

export type ThemeProperty = {
  property: string,
  value: {
    dark: string,
    light: string
  }
}

/**
 * Detect what theme the browser has been set to and
 * return 'dark' | 'light'
 */
export function windowTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)')
    .matches ? 'dark' : 'light'
}

/**
 * Updates the given CSS property values for the given selector
 */
export function updateCSSValues(selectorId: string, ...themeProps: ThemeProperty[]) {
  if (! selectorId) return
  const selector = document.querySelector(selectorId)

  if (! selector) return
  const styler = (selector as HTMLInputElement).style

  const themeColor = windowTheme()
  themeProps.forEach(prop => {
    styler.setProperty(prop.property, prop.value[themeColor])
  })
}
