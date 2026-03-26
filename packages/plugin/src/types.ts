import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk'
import { Namespace, Pod } from 'kubernetes-types/core/v1'
import { ObjectMeta } from 'kubernetes-types/meta/v1'

export interface K8sObject extends Record<string, unknown> {
  kind?: string
  metadata?: ObjectMeta
  spec?: unknown
}

export type K8sPod = Pod & K8sObject

export type K8sNamespace = Namespace & K8sObject

export interface K8sOwnerResource extends K8sResourceCommon {
  spec?: {
    selector?: Record<string, string> // Changed to string to better match k8s selectors
  }
}
