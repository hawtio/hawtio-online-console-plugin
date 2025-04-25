import { MenuToggle, MenuToggleElement, Page, PageSection, Select, SelectList, SelectOption, Text, TextContent, Title } from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'
import { k8sListItems, K8sModel, K8sResourceCommon, NamespaceBar, useActiveNamespace, useK8sModel } from '@openshift-console/dynamic-plugin-sdk'
import { Ref, useEffect, useState } from 'react'
import { K8sNamespace, K8sPod } from '../types'
import { ConsoleLoading } from './ConsoleLoading'
import './hawtiodiscover.css'
import { HawtioMainTab } from './HawtioMainTab'
import { connectionService } from 'src/connection-service'
import { DiscoverEmptyContent } from './DiscoverEmptyContent'

interface HawtioDiscoverProps {
  ns: string
  name: string
}

const noPods = 'None Available'
const allNS = '#ALL_NS#'

function podName(pod: K8sPod): string {
  if (!pod.metadata || !pod.metadata.name)
    return '<no pod metadata>'

  return pod.metadata.name
}

function k8sPod(pods: K8sPod[], name: string): K8sPod | null {
  return pods.find(pod => podName(pod) === name) ?? null
}

async function fetchJolokiaPods(podModel: K8sModel, namespace: string): Promise<K8sPod[]> {
  const response = await k8sListItems({ model: podModel, queryParams: { ns: namespace } })

  const pods: K8sPod[] = []
  for (const res of response) {
    const pod: K8sPod = res as K8sPod
    if (connectionService.hasJolokiaPort(pod)) {
      pods.push(res as K8sPod)
    }
  }

  return pods
}

export const HawtioDiscover: React.FunctionComponent<HawtioDiscoverProps> = props => {
  const [k8sPodModel] = useK8sModel({ group: 'core', version: 'v1', kind: 'Pod' })
  const [k8sNSModel] = useK8sModel({ group: 'core', version: 'v1', kind: 'Namespace'})

  const [activeNamespace] = useActiveNamespace()
  const [namespace, setNamespace] = useState<string>(activeNamespace ?? '')
  const [pods, setPods] = useState<K8sPod[]>([])

  const [isLoading, setLoading] = useState<boolean>(true)

  /* Select Pod Dropdown */
  const [isPodSelectOpen, setPodSelectIsOpen] = useState<boolean>(false)
  const [selectedPod, setSelectedPod] = useState<string>(noPods)

  useEffect(() => {
    setLoading(true)

    if (!namespace || namespace.length === 0) {
      setPods([])
      setSelectedPod(noPods)
      setLoading(false)
      return
    }

    if (namespace === allNS) {
      /*
       * Find pods in all namespaces
       */
      k8sListItems({ model: k8sNSModel, queryParams: {} })
        .then(async (response: K8sResourceCommon[]) => {
          const jPods: K8sPod[] = []
          for (const res of response) {
            const ns: K8sNamespace = res as K8sNamespace
            if (ns && ns.metadata && ns.metadata.name) {
              const pods = await fetchJolokiaPods(k8sPodModel, ns.metadata.name)
              jPods.push(...pods)
            }
          }

          setPods(jPods)
          setSelectedPod(() => {
            return jPods.length === 0 ? noPods : podName(jPods[0])
          })
          setLoading(false)
        })
    } else {
      /*
       * Find pods in the selected namespace
       */
      fetchJolokiaPods(k8sPodModel, namespace)
        .then(pods => {
          setPods(pods)
          setSelectedPod(() => {
            return pods.length === 0 ? noPods : podName(pods[0])
          })
          setLoading(false)
        })
    }
  }, [ namespace ])

  const onToggleSelectPodClick = () => {
    setPodSelectIsOpen(!isPodSelectOpen)
  }

  const onSelectPod = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    setSelectedPod(value as string)
    setPodSelectIsOpen(false)
  }

  const onNamespaceChange = async (namespace: string) => {
    setNamespace(namespace)
  }

  const pageTitle = () => {
    if (!selectedPod || selectedPod === noPods)
      return ''

    return selectedPod
  }

  const displayHawtio = () => {
    if (!selectedPod || selectedPod === noPods)
      return ( <DiscoverEmptyContent/> )

    return (
      <HawtioMainTab
        ns={namespace}
        name={selectedPod}
        obj={k8sPod(pods, selectedPod)}
      />
    )
  }

  return (
    <Page>
      <PageSection id='hawtio-discover-namespace-section'>
        <NamespaceBar
          onNamespaceChange={onNamespaceChange}>
          <Select
            id='pod-select'
            className=''
            isOpen={isPodSelectOpen}
            selected={selectedPod}
            onSelect={onSelectPod}
            onOpenChange={isOpen => setPodSelectIsOpen(isOpen)}
            shouldFocusToggleOnSelect
            toggle={(toggleRef: Ref<MenuToggleElement>) => (
              <MenuToggle
                id='pod-select-dropdown-toggle'
                className='pod-select-dropdown-toggle'
                isDisabled={pods.length === 0}
                variant={'primary'}
                ref={toggleRef}
                onClick={onToggleSelectPodClick}
                isExpanded={isPodSelectOpen}
                icon={<CubesIcon/>}
              >
                Pod: {selectedPod}
              </MenuToggle>
            )}
          >
            <SelectList>
              {
                pods.length > 0 &&
                  pods.map(pod => (
                    <SelectOption
                      value={podName(pod)}
                      key={pod.metadata?.uid}
                      isSelected={selectedPod === podName(pod)}
                    >
                      {podName(pod)}
                    </SelectOption>
                  ))
              }
            </SelectList>
          </Select>
        </NamespaceBar>
      </PageSection>

      <PageSection id='hawtio-discover-title-section'>
        <Title headingLevel="h3">{pageTitle()}</Title>

        {isLoading && (
          <ConsoleLoading />
        )}

        {!isLoading && (
          displayHawtio()
        )}
      </PageSection>
    </Page>
  )
}

export default HawtioDiscover
