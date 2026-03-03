import React, { Ref, useEffect, useMemo, useState } from 'react'
import { MenuToggle, MenuToggleElement, PageSection, PageSectionVariants, Select, SelectList, SelectOption, Toolbar, ToolbarContent, ToolbarItem } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import '@patternfly/patternfly/patternfly.css'
import '@hawtio/react/dist/index.css'
import './openshift-console-plugin.css'
import './hawtiomaintab.css'
import './camel-dashboard-hawtio-tab.css'
import { log } from '../globals'
import { useK8sWatchResource, useK8sWatchResources } from '@openshift-console/dynamic-plugin-sdk'
import { connectionService } from '../connection-service'
import { HawtioMainTab } from './HawtioMainTab'
import { ConsoleLoading } from './ConsoleLoading'

interface CamelApp {
  metadata?: {
    name?: string
    namespace?: string
    ownerReferences?: Array<{
      apiVersion: string
      kind: string
      name: string
      uid: string
      controller?: boolean
    }>
  }
  spec?: {
    selector?: {
      matchLabels?: Record<string, string>
    }
  }
  status?: {
    pods?: Array<{
      name: string
      ready: boolean
      status: string
      jolokiaEnabled?: boolean
    }>
  }
}

interface CamelDashboardHawtioTabProps {
  obj?: CamelApp
  customData?: any
}

function podUid(pod: any | null): string | null {
  if (!pod) return null
  return pod.metadata?.uid ?? null
}

function podName(pod: any | null): string {
  if (!pod || !pod.metadata || !pod.metadata.name) return '<no pod>'
  return pod.metadata.name
}

function findPodByName(pods: any[], name: string): any | null {
  return pods.find(p => podName(p) === name) ?? null
}

function ownerGvk(kind: string) {
  switch (kind) {
    case 'Deployment':
      return { group: 'apps', version: 'v1', kind: 'Deployment' }
    case 'StatefulSet':
      return { group: 'apps', version: 'v1', kind: 'StatefulSet' }
    case 'DaemonSet':
      return { group: 'apps', version: 'v1', kind: 'DaemonSet' }
    case 'ReplicaSet':
      return { group: 'apps', version: 'v1', kind: 'ReplicaSet' }
    case 'CronJob':
      return { group: 'batch', version: 'v1', kind: 'CronJob' }
    default:
      return { group: 'apps', version: 'v1', kind }
  }
}

export const CamelDashboardHawtioTab: React.FunctionComponent<CamelDashboardHawtioTabProps> = props => {
  log.debug('CamelDashboardHawtioTab props:', JSON.stringify(props, null, 2))

  // Pod selection state
  const [isPodSelectOpen, setPodSelectIsOpen] = useState<boolean>(false)
  const [selectedPodName, setSelectedPodName] = useState<string | null>(null)

  // Get the owner resource (Deployment, StatefulSet, etc.)
  const ownerRef = props.obj?.metadata?.ownerReferences?.[0]
  const [owner, ownerLoaded] = useK8sWatchResource<any>(
    ownerRef
      ? {
          name: ownerRef.name,
          namespace: props.obj?.metadata?.namespace,
          groupVersionKind: ownerGvk(ownerRef.kind),
          isList: false,
        }
      : null
  )

  // Query pods using the owner's selector
  const resources = useK8sWatchResources<{
    pods: any[]
  }>({
    pods: ownerLoaded && owner && owner.spec?.selector
      ? {
          isList: true,
          groupVersionKind: {
            group: '',
            version: 'v1',
            kind: 'Pod'
          },
          namespaced: true,
          namespace: props.obj?.metadata?.namespace,
          selector: owner.spec.selector,
        }
      : {
          isList: true,
          groupVersionKind: {
            group: '',
            version: 'v1',
            kind: 'Pod'
          },
          namespaced: false,
          namespace: '',
        }
  })

  // Filter pods to only those with Jolokia port - memoized to prevent unnecessary re-renders
  const jolokiaPods = useMemo(() => {
    return resources.pods.data?.filter(p => connectionService.hasJolokiaPort(p)) || []
  }, [resources.pods.data])

  // Set default selected pod if not set or if the selected pod is no longer available
  useEffect(() => {
    if (jolokiaPods.length > 0) {
      if (!selectedPodName || !findPodByName(jolokiaPods, selectedPodName)) {
        setSelectedPodName(podName(jolokiaPods[0]))
      }
    } else {
      setSelectedPodName(null)
    }
  }, [jolokiaPods.length])

  // Get the currently selected pod
  const pod = selectedPodName ? findPodByName(jolokiaPods, selectedPodName) : null

  // Pod selector handlers
  const onToggleSelectPodClick = () => {
    setPodSelectIsOpen(!isPodSelectOpen)
  }

  const onSelectPod = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    const newPodName = value as string
    if (newPodName !== selectedPodName) {
      setSelectedPodName(newPodName)
    }
    setPodSelectIsOpen(false)
  }

  // Show loading while resources are loading
  if (!ownerLoaded || !resources.pods.loaded) {
    return <ConsoleLoading />
  }

  // Show minimal message if no pods with Jolokia found
  if (jolokiaPods.length === 0) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <div className='camel-dashboard-hawtio-tab__empty-state'>
          <div className='camel-dashboard-hawtio-tab__empty-state-content'>
            <p className='camel-dashboard-hawtio-tab__empty-state-title'>
              Hawtio is not available for this CamelApp.
            </p>
            <p className='camel-dashboard-hawtio-tab__empty-state-subtitle'>
              No pods with Jolokia endpoint detected.
            </p>
          </div>
        </div>
      </PageSection>
    )
  }

  // Render pod selector (only if multiple pods) + HawtioMainTab child
  return (
    <div className='camel-dashboard-hawtio-tab'>
      {jolokiaPods.length > 1 && (
        <Toolbar className='camel-dashboard-hawtio-tab__toolbar'>
          <ToolbarContent>
            <ToolbarItem>
              <Select
                id='camel-dashboard-pod-select'
                isOpen={isPodSelectOpen}
                selected={selectedPodName}
                onSelect={onSelectPod}
                onOpenChange={isOpen => setPodSelectIsOpen(isOpen)}
                shouldFocusToggleOnSelect
                toggle={(toggleRef: Ref<MenuToggleElement>) => (
                  <MenuToggle
                    id='camel-dashboard-pod-select-toggle'
                    isDisabled={jolokiaPods.length === 0}
                    variant='primary'
                    ref={toggleRef}
                    onClick={onToggleSelectPodClick}
                    isExpanded={isPodSelectOpen}
                    icon={<CubesIcon />}
                  >
                    Pod: {selectedPodName}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {jolokiaPods.map(p => (
                    <SelectOption
                      value={podName(p)}
                      key={podUid(p)}
                      isSelected={selectedPodName === podName(p)}
                    >
                      {podName(p)}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}
      <HawtioMainTab
        ns={props.obj?.metadata?.namespace ?? ''}
        name={selectedPodName ?? ''}
        obj={pod}
      />
    </div>
  )
}

export default CamelDashboardHawtioTab