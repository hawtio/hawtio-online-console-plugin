import React from 'react'
import { EmptyState, EmptyStateBody } from '@patternfly/react-core'
import {CubesIcon} from '@patternfly/react-icons'

export const DiscoverEmptyContent: React.FunctionComponent = () => {
  return (
    <EmptyState headingLevel='h1' titleText='No Hawtio Containers' icon={CubesIcon}>
      <EmptyStateBody>
        There are no containers running with a port configured whose name is <code>jolokia</code>.
      </EmptyStateBody>
    </EmptyState>
  )
}
