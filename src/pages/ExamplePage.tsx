import { useTranslation } from 'react-i18next'
import { Page, PageSection, Text, TextContent, Title } from '@patternfly/react-core'
import { CheckCircleIcon } from '@patternfly/react-icons'
import './example.css'

export default function ExamplePage() {
  const { t } = useTranslation('plugin__hawtio-online-console-plugin')

  return (
    <>
      <Page>
        <PageSection variant="light">
          <Title headingLevel="h1">{t('Hello, Plugin!')}</Title>
        </PageSection>
        <PageSection variant="light">
          <TextContent>
            <Text component="p">
              <span className="hawtio-online-console-plugin__nice">
                <CheckCircleIcon /> {t('Success!')}
              </span>{' '}
              {t('Your plugin is working.')}
            </Text>
            <Text component="p">
              {t(
                'This is a custom page contributed by the console plugin template. The extension that adds the page is declared in console-extensions.json in the project root along with the corresponding nav item. Update console-extensions.json to change or add extensions. Code references in console-extensions.json must have a corresponding property',
              )}
              <code>{t('exposedModules')}</code>{' '}
              {t('in package.json mapping the reference to the module.')}
            </Text>
            <Text component="p">
              {t('After cloning this project, replace references to')}{' '}
              <code>{t('console-template-plugin')}</code>{' '}
              {t('and other plugin metadata in package.json with values for your plugin.')}
            </Text>
          </TextContent>
        </PageSection>
      </Page>
    </>
  )
}
