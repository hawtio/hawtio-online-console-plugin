import React, { useEffect, useState } from 'react'
import { hawtioService } from '../hawtio-service'
import { preferencesRegistry } from '@hawtio/react'
import { HawtioLoadingPage } from '@hawtio/react/ui'
import '@hawtio/react/dist/index.css'
import { log } from '../globals'
import { Alert } from '@patternfly/react-core'
import './openshift-console-plugin.css'
import './hawtiomainprefs.css'
import { useOpenShiftTheme } from '../hooks'
import { stack } from '../utils'

interface HawtioMainPrefsProps {
  id: string
}

export const HawtioMainPrefs: React.FunctionComponent<HawtioMainPrefsProps> = () => {
  const [isLoading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>()

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
      <div>
        <Alert variant='danger' title='Error occurred while loading' isInline>
          <textarea
            readOnly
            rows={10}
            style={{
              width: '100%',
              resize: 'none',
              background: 'transparent',
              border: 'none',
            }}
            value={stack(error)}
          />
        </Alert>
      </div>
    )
  }

  return (
    <div id='hawtio-preferences' className='pf-v6-c-form'>
      {preferencesRegistry.getPreferences().map(prefs => (
        <React.Fragment key={prefs.id}>
          {/*
            React renders the upstream component.
            Even if it contains a <Form> or <CardBody>, our custom css
            will flatten it, and <div> wrapper prevents illegal HTML nesting.
          */}
          {React.createElement(prefs.component)}
        </React.Fragment>
      ))}
    </div>
  )
}

// OpenShift Console plugin API strictly requires default exports for dynamic components
// eslint-disable-next-line import/no-default-export
export default HawtioMainPrefs
