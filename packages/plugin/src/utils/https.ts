/*
 * Function for extracting the CSRF Token necessary
 * for correct authentication when making requests
 * to the cluster from the console
 *
 * Taken from
 * https://github.com/openshift/console/blob/master/frontend/packages/console-dynamic-plugin-sdk/src/utils/fetch/console-fetch-utils.ts#L10
 */
export function getCSRFToken() {
  const cookiePrefix = 'csrf-token='
  return (
    document &&
    document.cookie &&
    document.cookie
      .split(';')
      .map(c => c.trim())
      .filter(c => c.startsWith(cookiePrefix))
      .map(c => c.slice(cookiePrefix.length))
      .pop()
  )
}
