import React from 'react'
import {
  EmptyState,
  EmptyStateHeader,
  EmptyStateIcon,
  EmptyStateBody,
} from '@patternfly/react-core'
import { CubesIcon } from '@patternfly/react-icons'

export const DiscoverEmptyContent: React.FunctionComponent = () => {
  return (
    <EmptyState>
      <EmptyStateHeader
        titleText='No Hawtio Containers'
        icon={<EmptyStateIcon icon={CubesIcon} />}
        headingLevel='h1'
      />
      <EmptyStateBody>
        There are no containers running with a port configured whose name is <code>jolokia</code>.
      </EmptyStateBody>
    </EmptyState>
  )
}
