import { nextTestSetup } from 'e2e-utils'
import { retry } from 'next-test-utils'

describe('next-config-serialized', () => {
  const { next, skipped } = nextTestSetup({
    files: __dirname,
    skipStart: true,
    skipDeployment: true,
  })

  if (skipped) {
    return
  }

  it('should use .next/required-server-files.json when distDir is .next', async () => {
    await next.build()
    expect(await next.hasFile('.next/required-server-files.json')).toBe(true)

    // Rename the config file so it can't be loaded.
    await next.renameFile('next.config.js', 'next.config.noop.js')
    await retry(async () => {
      expect(await next.hasFile('next.config.noop.js')).toBe(true)
    })

    await next.start({ skipBuild: true })

    const browser = await next.browser('/')
    expect(await browser.elementByCss('p').text()).toBe('hello world foo')

    // Restore the file for the next case.
    await next.renameFile('next.config.noop.js', 'next.config.js')
    await next.stop()
  })

  it('should use next-config-serialized.json when distDir is not .next', async () => {
    await next.patchFile('next.config.js', (content) => {
      return content.replace(`// distDir: 'out',`, `distDir: 'out',`)
    })

    await next.build()
    expect(await next.hasFile('out/required-server-files.json')).toBe(true)
    // next-config-serialized.json created next to next.config.js
    expect(await next.hasFile('next-config-serialized.json')).toBe(true)

    // Rename the config file so it can't be loaded.
    await next.renameFile('next.config.js', 'next.config.noop.js')
    await retry(async () => {
      expect(await next.hasFile('next.config.noop.js')).toBe(true)
    })

    await next.start({ skipBuild: true })

    const browser = await next.browser('/')
    expect(await browser.elementByCss('p').text()).toBe('hello world foo')

    // Restore the file for the next case.
    await next.renameFile('next.config.noop.js', 'next.config.js')
    await next.stop()
  })
})
