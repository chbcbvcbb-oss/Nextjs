import { logStartInfo, logExperimentalInfo, getEnvInfo } from './app-info-log'
import { loadEnvConfig } from '@next/env'
import * as Log from '../../build/output/log'
import * as inspector from 'inspector'

jest.mock('@next/env', () => ({
  loadEnvConfig: jest.fn(),
}))

jest.mock('../../build/output/log', () => ({
  prefixes: { ready: '▲' },
  bootstrap: jest.fn(),
  info: jest.fn(),
}))

jest.mock('inspector', () => ({
  url: jest.fn(),
}))

jest.mock('../config-schema', () => ({
  experimentalSchema: {
    booleanFeature: {},
    numberFeature: {},
    stringFeature: {},
  },
}))

const bootstrapMock = Log.bootstrap as jest.Mock
const infoMock = Log.info as jest.Mock
const inspectorUrlMock = inspector.url as jest.Mock
const loadEnvConfigMock = loadEnvConfig as jest.Mock

function bootstrapLines(): string[] {
  return bootstrapMock.mock.calls.map((call) => call[0])
}

describe('logStartInfo', () => {
  const originalEnv = {
    TURBOPACK: process.env.TURBOPACK,
    NEXT_RSPACK: process.env.NEXT_RSPACK,
    __NEXT_VERSION: process.env.__NEXT_VERSION,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.TURBOPACK
    delete process.env.NEXT_RSPACK
    process.env.__NEXT_VERSION = '15.0.0-test'
  })

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  const baseOptions = {
    networkUrl: null,
    appUrl: null,
    logBundler: false,
  }

  it('always logs the Next.js version banner first', () => {
    logStartInfo(baseOptions)

    expect(bootstrapMock).toHaveBeenCalled()
    expect(bootstrapLines()[0]).toContain('Next.js 15.0.0-test')
  })

  describe('bundler suffix', () => {
    it('does not append a bundler suffix when logBundler is false', () => {
      process.env.TURBOPACK = '1'
      logStartInfo(baseOptions)

      expect(bootstrapLines()[0]).not.toContain('(')
    })

    it('logs Turbopack when TURBOPACK is set', () => {
      process.env.TURBOPACK = '1'
      logStartInfo({ ...baseOptions, logBundler: true })

      expect(bootstrapLines()[0]).toContain('(Turbopack)')
    })

    it('logs Rspack when NEXT_RSPACK is set', () => {
      process.env.NEXT_RSPACK = '1'
      logStartInfo({ ...baseOptions, logBundler: true })

      expect(bootstrapLines()[0]).toContain('(Rspack)')
    })

    it('prefers Turbopack when both TURBOPACK and NEXT_RSPACK are set', () => {
      process.env.TURBOPACK = '1'
      process.env.NEXT_RSPACK = '1'
      logStartInfo({ ...baseOptions, logBundler: true })

      expect(bootstrapLines()[0]).toContain('(Turbopack)')
      expect(bootstrapLines()[0]).not.toContain('Rspack')
    })

    it('falls back to webpack when no bundler env is set', () => {
      logStartInfo({ ...baseOptions, logBundler: true })

      expect(bootstrapLines()[0]).toContain('(webpack)')
    })
  })

  describe('URLs', () => {
    it('logs the local URL when appUrl is provided', () => {
      logStartInfo({ ...baseOptions, appUrl: 'http://localhost:3000' })

      expect(bootstrapLines()).toContainEqual(expect.stringContaining('Local:'))
      expect(bootstrapLines()).toContainEqual(
        expect.stringContaining('http://localhost:3000')
      )
    })

    it('logs the network URL when networkUrl is provided', () => {
      logStartInfo({ ...baseOptions, networkUrl: 'http://192.168.0.5:3000' })

      expect(bootstrapLines()).toContainEqual(
        expect.stringContaining('Network:')
      )
      expect(bootstrapLines()).toContainEqual(
        expect.stringContaining('http://192.168.0.5:3000')
      )
    })

    it('omits the Local and Network lines when URLs are null', () => {
      logStartInfo(baseOptions)

      expect(bootstrapLines()).not.toContainEqual(
        expect.stringContaining('Local:')
      )
      expect(bootstrapLines()).not.toContainEqual(
        expect.stringContaining('Network:')
      )
    })
  })

  describe('debugger port', () => {
    it('logs the debugger port when the inspector is active', () => {
      inspectorUrlMock.mockReturnValue('ws://127.0.0.1:9229/abc')
      logStartInfo(baseOptions)

      expect(bootstrapLines()).toContainEqual(
        expect.stringContaining(`Debugger port: ${process.debugPort}`)
      )
    })

    it('omits the debugger line when the inspector is inactive', () => {
      inspectorUrlMock.mockReturnValue(undefined)
      logStartInfo(baseOptions)

      expect(bootstrapLines()).not.toContainEqual(
        expect.stringContaining('Debugger port:')
      )
    })
  })

  describe('environments', () => {
    it('logs loaded env files as a comma-separated list', () => {
      logStartInfo({ ...baseOptions, envInfo: ['.env.local', '.env'] })

      expect(bootstrapLines()).toContainEqual(
        expect.stringContaining('Environments: .env.local, .env')
      )
    })

    it('omits the environments line for an empty list', () => {
      logStartInfo({ ...baseOptions, envInfo: [] })

      expect(bootstrapLines()).not.toContainEqual(
        expect.stringContaining('Environments:')
      )
    })

    it('omits the environments line when envInfo is undefined', () => {
      logStartInfo(baseOptions)

      expect(bootstrapLines()).not.toContainEqual(
        expect.stringContaining('Environments:')
      )
    })
  })
})

describe('logExperimentalInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('logs nothing but a trailing empty info line when called with no data', () => {
    logExperimentalInfo({})

    expect(bootstrapMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith('')
  })

  it('logs the cache components line when enabled', () => {
    logExperimentalInfo({ cacheComponents: true })

    expect(bootstrapLines()).toContainEqual(
      expect.stringContaining('Cache Components enabled')
    )
  })

  it('omits the cache components line when disabled', () => {
    logExperimentalInfo({ cacheComponents: false })

    expect(bootstrapMock).not.toHaveBeenCalled()
  })

  it('does not log the experiments header for an empty feature list', () => {
    logExperimentalInfo({ experimentalFeatures: [] })

    expect(bootstrapMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith('')
  })

  it('logs the experiments header when features are present', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'booleanFeature', value: true } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringContaining('Experiments (use with caution):')
    )
  })

  it('marks enabled boolean features with a check mark', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'booleanFeature', value: true } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringMatching(/✓.*booleanFeature/)
    )
  })

  it('marks disabled boolean features with a cross mark', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'booleanFeature', value: false } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringMatching(/⨯.*booleanFeature/)
    )
  })

  it('logs numeric feature values with a middle dot and the value', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'numberFeature', value: 5 } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringMatching(/·.*numberFeature: 5/)
    )
  })

  it('logs string feature values JSON-stringified', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'stringFeature', value: 'abc' } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringContaining('stringFeature: "abc"')
    )
  })

  it('appends the reason when one is provided', () => {
    logExperimentalInfo({
      experimentalFeatures: [
        {
          key: 'booleanFeature',
          value: true,
          reason: 'enabled by flag',
        } as any,
      ],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringContaining('(enabled by flag)')
    )
  })

  it('flags keys missing from the experimental schema as invalid', () => {
    logExperimentalInfo({
      experimentalFeatures: [{ key: 'notARealFeature', value: true } as any],
    })

    expect(bootstrapLines()).toContainEqual(
      expect.stringContaining('(invalid experimental key)')
    )
    expect(bootstrapLines()).not.toContainEqual(
      expect.stringMatching(/✓.*notARealFeature/)
    )
  })

  it('logs each feature on its own line', () => {
    logExperimentalInfo({
      experimentalFeatures: [
        { key: 'booleanFeature', value: true } as any,
        { key: 'numberFeature', value: 1 } as any,
        { key: 'notARealFeature', value: 'x' } as any,
      ],
    })

    // 1 header line + 3 feature lines
    expect(bootstrapMock).toHaveBeenCalledTimes(4)
  })

  it('always ends with an empty info line', () => {
    logExperimentalInfo({
      cacheComponents: true,
      experimentalFeatures: [{ key: 'booleanFeature', value: true } as any],
    })

    expect(infoMock).toHaveBeenCalledTimes(1)
    expect(infoMock).toHaveBeenCalledWith('')
  })
})

describe('getEnvInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the paths of loaded env files', () => {
    loadEnvConfigMock.mockReturnValue({
      loadedEnvFiles: [{ path: '.env.local' }, { path: '.env' }],
    })

    expect(getEnvInfo('/some/dir')).toEqual(['.env.local', '.env'])
  })

  it('returns an empty array when no env files are loaded', () => {
    loadEnvConfigMock.mockReturnValue({ loadedEnvFiles: [] })

    expect(getEnvInfo('/some/dir')).toEqual([])
  })

  it('loads env config for the given directory without forcing a reload', () => {
    loadEnvConfigMock.mockReturnValue({ loadedEnvFiles: [] })

    getEnvInfo('/some/dir')

    expect(loadEnvConfigMock).toHaveBeenCalledWith(
      '/some/dir',
      true,
      console,
      false
    )
  })
})
