/*
 * required to patch fetch
 * its constructor sets up the interceptor before importing hawtio
 * so do not move this down the import list below @hawtio/react
 */
import { fetchPatchService } from '../fetch-patch-service'
import React, { useEffect, useRef, useState } from 'react'
import { Alert, Card, CardBody, PageSection, PageSectionVariants } from '@patternfly/react-core'
import '@patternfly/patternfly/patternfly.css'
import { K8sPod } from '../types'
import { hawtioService } from '../hawtio-service'
import { Hawtio } from '@hawtio/react/ui'
import '@hawtio/react/dist/index.css'
import { stack } from '../utils'
import './hawtiomaintab.css'
import { log } from '../globals'
import { ConsoleLoading } from './ConsoleLoading'

/*
 * Necessary since fetchPatchService is otherwise
 * removed from the component.
 */
log.info(`Using base path: ${fetchPatchService.getBasePath()}`)

interface HawtioMainTabProps {
  ns: string
  name: string
  obj: K8sPod | null
}

function podUid(pod: K8sPod | null): string | null {
  if (!pod) return null

  return pod.metadata?.uid ?? null
}

export const HawtioMainTab: React.FunctionComponent<HawtioMainTabProps> = props => {
  const [isLoading, setLoading] = useState<boolean>(true)
  const podIdRef = useRef<string|null>(podUid(props.obj))
  const [error, setError] = useState<Error | null>()

  useEffect(() => {
    fetchPatchService.setupFetch()
    return () => {
      hawtioService.destroy()
    }
  }, [])

  useEffect(() => {
    const newId = podUid(props.obj) ?? ''
    const podChanged = newId !== podIdRef.current

    if (isLoading) {
      const awaitService = async (pod: K8sPod | null) => {
        log.debug(`Intialising Hawtio for pod ${pod?.metadata?.name} ...`)
        await hawtioService.reset(pod)

        if (!hawtioService.isResolved() || hawtioService.getError()) {
          setError(new Error('Failure to initialize the HawtioService', { cause: hawtioService.getError() }))
          setLoading(false) // error occurred so loading is done
          return
        }

        log.debug(`Hawtio initialize complete for ${pod?.metadata?.name} ...`)
        setError(null)
        setLoading(false)
      }
      awaitService(props.obj)

    } else if (podChanged) {
      /*
       * Ensure that we change state to refresh
       * the page on a new pod
       */
      setLoading(true)
      podIdRef.current = newId
    }

  }, [isLoading, props.obj])

  if (isLoading) {
    return <ConsoleLoading />
  }

  if (error) {
    return (
      <PageSection variant={PageSectionVariants.light}>
        <Card>
          <CardBody>
            <Alert variant='danger' title='Error occurred while loading'>
              <textarea
                readOnly
                style={{ width: '100%', height: '100%', resize: 'none', background: 'transparent', border: 'none' }}
              >
                {stack(error)}
              </textarea>
            </Alert>
          </CardBody>
        </Card>
      </PageSection>
    )
  }

  return <Hawtio />
}

export default HawtioMainTab
