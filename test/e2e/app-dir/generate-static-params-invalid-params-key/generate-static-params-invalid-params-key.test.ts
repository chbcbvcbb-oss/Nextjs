import { nextTestSetup } from 'e2e-utils'
import { assertHasRedbox, getRedboxDescription } from 'next-test-utils'

describe('generate-static-params-invalid-params-key', () => {
  const { next, isNextDev, skipped } = nextTestSetup({
    files: __dirname,
    skipStart: true,
    skipDeployment: true,
  })

  if (skipped) {
    return
  }

  if (isNextDev) {
    it('should error and list the invalid params keys', async () => {
      await next.start()
      const browser = await next.browser('/1')
      await assertHasRedbox(browser)
      expect(await getRedboxDescription(browser)).toMatchInlineSnapshot(`
       "Invalid params keys found in generateStaticParams for "/[id]":
         - "id1"
         - "id2""
      `)
    })
  } else {
    it('should throw and list the invalid params keys', async () => {
      const buildResult = await next.build()
      expect(buildResult?.exitCode).toBe(1)

      expect(next.cliOutput).toContain(
        `Error: Invalid params keys found in generateStaticParams for "/[id]":
  - "id1"
  - "id2"`
      )
    })
  }
})
