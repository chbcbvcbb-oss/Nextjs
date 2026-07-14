import { nextTestSetup } from 'e2e-utils'
import { retry } from 'next-test-utils'

describe('navigation-focus', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('navigation to an interactive segment', async () => {
    const browser = await next.browser('/')
    await browser.elementByCss('a[href="/interactive-segment"]').click()

    await retry(async () => {
      // Good debug info is a moving target. Use Playwright traces to find out
      // what was focused if this fails
      expect(await browser.eval(() => document.activeElement.localName)).toBe(
        'body'
      )
    })
  })

  it('navigation to a scrollable segment', async () => {
    const browser = await next.browser('/')
    await browser.elementByCss('a[href="/scrollable-segment"]').click()

    await retry(async () => {
      expect(await browser.eval(() => document.activeElement.localName)).toBe(
        'body'
      )
    })
  })

  it('navigation to a segment with a focusable descendant', async () => {
    const browser = await next.browser('/')
    await browser
      .elementByCss('a[href="/segment-with-focusable-descendant"]')
      .click()

    await retry(async () => {
      expect(await browser.eval(() => document.activeElement.localName)).toBe(
        'body'
      )
    })
  })

  it('navigation to a fragment within a page', async () => {
    const browser = await next.browser('/')
    await browser.elementByCss('a[href="/uri-fragments#section-2"]').click()

    await retry(async () => {
      expect(await browser.eval(() => document.activeElement.localName)).toBe(
        'body'
      )
    })
    // Fragment URI not targetted unlike native behavior
    expect(await browser.locator(':target').isVisible()).toEqual(false)
  })

  it('navigation within a page to fragments', async () => {
    const browser = await next.browser('/uri-fragments')
    await browser.elementByCss('a[href="#section-1"]').click()

    await retry(async () => {
      expect(await browser.eval(() => document.activeElement.localName)).toBe(
        'body'
      )
    })
    // Fragment URI not targetted unlike native behavior
    expect(await browser.locator(':target').isVisible()).toEqual(false)
  })
})
