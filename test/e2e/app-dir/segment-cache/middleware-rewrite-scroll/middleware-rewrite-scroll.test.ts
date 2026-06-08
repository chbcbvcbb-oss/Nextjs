import { nextTestSetup } from 'e2e-utils'
import { retry } from '../../../../lib/next-test-utils'

describe('segment cache - middleware rewrite scroll', () => {
  const { next, isNextDev, isNextDeploy } = nextTestSetup({
    files: __dirname,
  })

  if (isNextDev) {
    test('skipped in dev mode', () => {})
    return
  }

  // Regression test: when middleware rewrites a short URL to a deeper
  // internal path (common in i18n/multi-tenant apps), clicking a
  // <Link scroll={false} prefetch={false}> that changes search params
  // should not scroll to top.
  //
  // Root cause: the optimistic navigation triggers a dynamic data fetch.
  // The server response's page segment key includes the search params,
  // which doesn't match the optimistic tree, so a SERVER_PATCH retry is
  // dispatched. The server-patch reducer hardcoded ScrollBehavior.Default,
  // dropping the original scroll={false}. The retry created new cache
  // nodes with scrollRef = { current: true } that were never neutralized.
  it('should not scroll to top when clicking a Link with scroll={false} that changes search params', async () => {
    const browser = await next.browser('/')

    // Verify the page loaded via middleware rewrite
    await browser.waitForElementByCss('#main-page')

    // Scroll down to an item near the bottom
    await browser.eval(
      'document.getElementById("link-item-40").scrollIntoView({ behavior: "instant" })'
    )
    const scrollBefore = await browser.eval('window.scrollY')
    expect(scrollBefore).toBeGreaterThan(100)

    // Click a link that only changes search params (scroll={false})
    await browser.elementById('link-item-40').click()

    // Wait for the navigation to complete (URL should change)
    await retry(async () => {
      const url = await browser.url()
      expect(url).toContain('?item=40')
    })

    // Scroll position should be preserved
    const scrollAfter = await browser.eval('window.scrollY')
    expect(scrollAfter).toBe(scrollBefore)
  })
})
