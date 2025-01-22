/*
 * Warning:
 * Careful when this is imported as it
 * cannot precede the initialisation of the
 * fetch-patch-service in HawtioMainTab
 */
import { Logger } from "@hawtio/react"

export const moduleName = 'hawtio-online-console'
export const log = Logger.get(moduleName)
