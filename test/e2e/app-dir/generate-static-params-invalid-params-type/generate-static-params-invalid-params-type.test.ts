import { nextTestSetup } from 'e2e-utils'
import { assertHasRedbox, getRedboxDescription } from 'next-test-utils'

describe('generate-static-params-invalid-params-type', () => {
  const { next, isNextDev, skipped } = nextTestSetup({
    files: __dirname,
    skipStart: true,
    skipDeployment: true,
  })

  if (skipped) {
    return
  }

  if (isNextDev) {
    it('should error on invalid params type', async () => {
      await next.start()
      const browser = await next.browser('/1')
      await assertHasRedbox(browser)
      expect(await getRedboxDescription(browser)).toMatchInlineSnapshot(
        `"generateStaticParams returned a non-object "string" value "should be obj but I'm string" while processing page "/[id]"."`
      )
    })
  } else {
    it('should throw on invalid params type', async () => {
      const buildResult = await next.build()
      expect(buildResult?.exitCode).toBe(1)

      expect(next.cliOutput).toContain(
        `Error: generateStaticParams returned a non-object "string" value "should be obj but I'm string" while processing page "/[id]".`
      )
    })
  }
})
