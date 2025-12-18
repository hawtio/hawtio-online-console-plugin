import React, { useEffect, useState } from 'react'
import { hawtioService } from '../hawtio-service'
import { preferencesRegistry } from '@hawtio/react'
import { HawtioLoadingPage } from '@hawtio/react/ui'
import '@hawtio/react/dist/index.css'
import { log } from '../globals'
import {
  Alert,
  Card,
  CardBody,
  Divider,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  PageSectionVariants,
} from '@patternfly/react-core'
import '@patternfly/patternfly/patternfly.css'
import './openshift-console-plugin.css'
import './hawtiomainprefs.css'
import { useOpenShiftTheme } from '../hooks'
import { stack } from '../utils'

interface HawtioMainPrefsProps {
  id: string
}

export const HawtioMainPrefs: React.FunctionComponent<HawtioMainPrefsProps> = props => {
  const [isLoading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>()
  const [prefsPageId, setPrefsPageId] = useState<string>('')

  // Ensure the correct theme for OpenShift version
  useOpenShiftTheme()

  useEffect(() => {
    if (isLoading) {
      const awaitServices = async () => {
        log.debug(`Intialising Hawtio Preferences ...`)
        await hawtioService.reset(null)

        /*
         * Plugins will not necessarily be resolved
         * since their is no pod attached to the preferences
         * However, the preferences will have been added to registry
         */
        if (!hawtioService.isInitialized()) {
          setError(new Error('Failure to initialize the HawtioService', { cause: hawtioService.getError() }))
          setLoading(false) // error occurred so loading is done
          return
        }

        if (preferencesRegistry.getPreferences().length > 0) setPrefsPageId(preferencesRegistry.getPreferences()[0].id)

        setLoading(false)
      }

      awaitServices()
    }
  }, [isLoading])

  if (isLoading) {
    return <HawtioLoadingPage />
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

  const onPreferencePageClick = (itemId: string | number) => {
    setPrefsPageId(itemId.toString())
  }

  return (
    <Page id='hawtio-preferences'>
      <PageSection type='tabs' hasShadowBottom>
        <Nav aria-label='Nav' variant='tertiary'>
          <NavList>
            {preferencesRegistry.getPreferences().map(prefs => (
              <NavItem
                key={prefs.id}
                itemId={prefs.id}
                isActive={prefsPageId === prefs.id}
                onClick={(event, itemId: string | number) => {
                  onPreferencePageClick(itemId)
                }}
              >
                {prefs.title}
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSection>
      <Divider />
      <PageSection>
        {preferencesRegistry
          .getPreferences()
          .filter(prefs => {
            return prefs.id === prefsPageId
          })
          .map(prefs => {
            return React.createElement(prefs.component)
          })}
      </PageSection>
    </Page>
  )
}

export default HawtioMainPrefs
