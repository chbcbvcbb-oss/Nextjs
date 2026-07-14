import { type NextInstance, nextTestSetup } from 'e2e-utils'

async function execute(next: NextInstance, envKey: string, id: string) {
  await next.stop()
  if (envKey !== 'default') {
    next.env[envKey] = id
  }
  try {
    await next.start()

    let keyRoot: string,
      keyPrerender: string,
      dataRoot: string,
      dataPrerender: string
    {
      const match = next.cliOutput.match(
        /^CustomCacheHandler::get .* \[\["_N_T_\/layout","_N_T_\/prerender\/layout","_N_T_\/prerender\/page","_N_T_\/prerender"\]\]$/m
      )
      expect(match).toBeArray()
      keyPrerender = match[0]
      const browser = await next.browser(`/prerender`)
      dataPrerender = await browser.elementById('data').text()
    }

    {
      const logs = next.getCliOutputFromHere()
      const browser = await next.browser(`/`)
      dataRoot = await browser.elementById('data').text()
      const match = logs().match(
        /^CustomCacheHandler::get .* \[\["_N_T_\/layout","_N_T_\/page","_N_T_\/","_N_T_\/index"\]\]$/m
      )
      expect(match).toBeArray()
      keyRoot = match[0]
    }
    return { keyRoot, keyPrerender, dataRoot, dataPrerender }
  } finally {
    if (envKey !== 'default') {
      delete next.env[envKey]
    }
  }
}

describe.each(['NEXT_DEPLOYMENT_ID', 'BUILD_ID', 'default'])(
  'use-cache-cross-deployment with %s',
  (envKey) => {
    const { next, skipped } = nextTestSetup({
      files: __dirname,
      disableAutoSkewProtection: true,
      skipStart: true,
    })

    if (skipped) return

    // In the future, this assertion can be relaxed to only prevent sharing if the implementation
    // changed.
    it('should not have the same cache key across deployments', async () => {
      const key1 = await execute(next, envKey, 'dpl-id-1')
      const key2 = await execute(next, envKey, 'dpl-id-2')
      // Second run should not use the same key
      expect(key1.keyRoot).not.toBe(key2.keyRoot)
      expect(key1.keyPrerender).not.toBe(key2.keyPrerender)
      expect(key1.dataRoot).not.toBe(key2.dataRoot)
      expect(key1.dataPrerender).not.toBe(key2.dataPrerender)
    })
  }
)

// durableUseCacheEntries is only supported in Turbopack
;(process.env.IS_TURBOPACK_TEST ? describe : describe.skip)(
  'use-cache-cross-deployment with durableUseCacheEntries',
  () => {
    const { next, skipped } = nextTestSetup({
      files: __dirname,
      disableAutoSkewProtection: true,
      skipStart: true,
      env: { DURABLE_USE_CACHE_ENTRIES: '1' },
    })

    if (skipped) return

    it('should not recompute when nothing changes', async () => {
      const key1 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-1')
      const key2 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-2')
      // Should be the same key (because the implementation didn't change)
      expect(key1.keyRoot).toBe(key2.keyRoot)
      expect(key1.keyPrerender).toBe(key2.keyPrerender)
      expect(key1.dataRoot).toBe(key2.dataRoot)
      expect(key1.dataPrerender).toBe(key2.dataPrerender)
    })

    it('should recompute when transitive implementation changes', async () => {
      const key1 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-1')

      let value = String(Math.random())
      await next.patchFile(
        'app/logic.ts',
        `export function getDate() {
  return ${JSON.stringify(value)}
}`,
        async () => {
          const key2 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-2')
          // Should not be the same key (because the implementation did change)
          expect(key1.keyRoot).not.toBe(key2.keyRoot)
          expect(key1.keyPrerender).not.toBe(key2.keyPrerender)
          expect(key1.dataRoot).not.toBe(key2.dataRoot)
          expect(key2.dataRoot).toBe(value)
          expect(key1.dataPrerender).not.toBe(key2.dataPrerender)
          expect(key2.dataPrerender).toBe(value)
        }
      )
    })

    it('should recompute when runtime env var changes', async () => {
      let foobar1 = String(Math.random())
      let foobar2 = String(Math.random())
      try {
        next.env['FOOBAR'] = foobar1
        const key1 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-1')

        next.env['FOOBAR'] = foobar2
        const key2 = await execute(next, 'NEXT_DEPLOYMENT_ID', 'dpl-id-2')
        // Should not be the same key (because process.env.FOOBAR is read at runtime and changed)
        expect(key1.keyRoot).not.toBe(key2.keyRoot)
        expect(key1.keyPrerender).not.toBe(key2.keyPrerender)
        expect(key1.dataRoot).toEndWith(`:${foobar1}`)
        expect(key2.dataRoot).toEndWith(`:${foobar2}`)
        expect(key1.dataPrerender).toEndWith(`:${foobar1}`)
        expect(key2.dataPrerender).toEndWith(`:${foobar2}`)
      } finally {
        delete next.env['FOOBAR']
      }
    })
  }
)
