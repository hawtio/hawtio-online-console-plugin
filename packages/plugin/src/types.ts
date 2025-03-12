import { Namespace, Pod } from 'kubernetes-types/core/v1'
import { ObjectMeta } from 'kubernetes-types/meta/v1'

export interface K8sObject extends Record<string, unknown> {
  kind?: string
  metadata?: ObjectMeta
  spec?: unknown
}

export type K8sPod = Pod & K8sObject

export type K8sNamespace = Namespace & K8sObject
