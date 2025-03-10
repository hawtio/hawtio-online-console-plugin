import { MenuToggle, MenuToggleElement, Page, PageSection, Select, SelectList, SelectOption, Text, TextContent, Title } from '@patternfly/react-core'
import { CheckCircleIcon, CubesIcon } from '@patternfly/react-icons'
import { k8sListItems, K8sResourceCommon, NamespaceBar, useActiveNamespace, useK8sModel } from '@openshift-console/dynamic-plugin-sdk'
import { Ref, useEffect, useState } from 'react'
import { K8sPod } from '../types'
import { ConsoleLoading } from './ConsoleLoading'
import './hawtiodiscover.css'
import { HawtioMainTab } from './HawtioMainTab'

interface HawtioDiscoverProps {
  ns: string
  name: string
}

const noPods = 'None Available'

function podName(pod: K8sPod): string {
  if (!pod.metadata || !pod.metadata.name)
    return '<no pod metadata>'

  return pod.metadata.name
}

function k8sPod(pods: K8sPod[], name: string): K8sPod | null {
  return pods.find(pod => podName(pod) === name) ?? null
}

export const HawtioDiscover: React.FunctionComponent<HawtioDiscoverProps> = props => {
  const [k8sPodModel] = useK8sModel({ group: 'core', version: 'v1', kind: 'Pod' })
  const [activeNamespace] = useActiveNamespace()
  const [namespace, setNamespace] = useState<string>(activeNamespace ?? '')
  const [pods, setPods] = useState<K8sPod[]>([])

  const [isLoading, setLoading] = useState<boolean>(true)

  /* Select Pod Dropdown */
  const [isPodSelectOpen, setPodSelectIsOpen] = useState<boolean>(false)
  const [selectedPod, setSelectedPod] = useState<string>(noPods)

  const [error, setError] = useState<Error | null>()

  useEffect(() => {
    if (!namespace || namespace.length === 0) {
      setPods([])
      setSelectedPod(noPods)
      return
    }

    console.log('Updating pods')

    k8sListItems({ model: k8sPodModel, queryParams: { ns: namespace } })
      .then((response: K8sResourceCommon[]) => {
        const newPods: K8sPod[] = []
        for (const res of response) {
          newPods.push(res as K8sPod)
        }
        setPods(newPods)
        setSelectedPod(() => {
          return newPods.length === 0 ? noPods : podName(newPods[0])
        })
        setLoading(false)
      })
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

  return (
    <Page>
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

      <PageSection variant="dark">
        <Title headingLevel="h1">{selectedPod}</Title>

        {isLoading && (
          <ConsoleLoading />
        )}

        {!isLoading && (
          <HawtioMainTab
            ns={namespace}
            name={selectedPod}
            obj={k8sPod(pods, selectedPod)}
          />
        )}
      </PageSection>
    </Page>
  )
}

export default HawtioDiscover
