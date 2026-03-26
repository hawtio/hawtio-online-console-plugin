import { useLayoutEffect } from 'react'
import { HAWTIO_PF6_MODE_CLASS } from '../constants'

// Global counter to track how many components are currently using the theme
let themeUserCount = 0

interface OpenShiftGlobals {
  releaseVersion?: string
}

// Augment the global Window interface
declare global {
  interface Window {
    SERVER_FLAGS?: OpenShiftGlobals
  }
}

export const useOpenShiftTheme = (): void => {
  useLayoutEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('Hawtio: Detecting the OpenShift Version for Theming')

    // Detect the OpenShift Version
    // Use an intersection type to tell TS that window might have SERVER_FLAGS
    const serverFlags = window.SERVER_FLAGS

    // Default to false if can't read the version
    let isPatternFly6 = false

    // eslint-disable-next-line no-console
    console.debug('Hawtio: serverFlags', serverFlags)

    if (serverFlags?.releaseVersion) {
      const [major, minor] = serverFlags.releaseVersion.split('.').map((v: string) => parseInt(v, 10))

      // Check for 4.19+
      if (major > 4 || (major === 4 && minor >= 19)) {
        isPatternFly6 = true
      }
    }

    // eslint-disable-next-line no-console
    console.debug(`Hawtio: is PatternFly6? ${isPatternFly6}`)

    // Apply Theme (Increment Count)
    if (isPatternFly6) {
      themeUserCount++

      // Only touch the DOM if this is the first component requesting the theme
      if (themeUserCount === 1) {
        document.documentElement.classList.add(HAWTIO_PF6_MODE_CLASS)
        // eslint-disable-next-line no-console
        console.debug(`Hawtio: PatternFly 6 detected. Theme class (${HAWTIO_PF6_MODE_CLASS}) added.`)
      }
    }

    // Cleanup (Decrement Count)
    return () => {
      if (isPatternFly6) {
        themeUserCount--

        // Only remove the class if NO other components are using it
        if (themeUserCount === 0) {
          document.documentElement.classList.remove(HAWTIO_PF6_MODE_CLASS)
          // eslint-disable-next-line no-console
          console.debug(`Hawtio: All components unmounted. Theme class (${HAWTIO_PF6_MODE_CLASS}) removed.`)
        }
      }
    }
  }, []) // Empty dependency array = run once on mount/unmount
}
