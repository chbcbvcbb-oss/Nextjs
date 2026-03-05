import { execSync } from 'child_process'
import { getPkgManager } from './get-pkg-manager'
import { getFormattedNodeOptionsWithoutInspect } from '../../server/lib/utils'

/**
 * Returns the package registry using the user's package manager.
 * The URL will have a trailing slash.
 * @default https://registry.npmjs.org/
 */
export function getRegistry(baseDir: string = process.cwd()) {
  const pkgManager = getPkgManager(baseDir)
  // Since `npm config` command fails in npm workspace to prevent workspace config conflicts,
  // add `--no-workspaces` flag to run under the context of the root project only.
  // Safe for non-workspace projects as it's equivalent to default `--workspaces=false`.
  // x-ref: https://github.com/vercel/next.js/issues/47121#issuecomment-1499044345
  // x-ref: https://github.com/npm/statusboard/issues/371#issue-920669998
  const resolvedFlags = pkgManager === 'npm' ? '--no-workspaces' : ''
  let registry = `https://registry.npmjs.org/`

  try {
    const output = execSync(
      `${pkgManager} config get registry ${resolvedFlags}`,
      {
        env: {
          ...process.env,
          NODE_OPTIONS: getFormattedNodeOptionsWithoutInspect(),
        },
      }
    )
      .toString()
      .trim()

    if (output.startsWith('http')) {
      registry = output.endsWith('/') ? output : `${output}/`
    }
  } catch (err) {
    throw new Error(`Failed to get registry from "${pkgManager}".`, {
      cause: err,
    })
  }

  return registry
}

/**
 * Returns the auth token for the given registry URL, if configured
 * in the user's package manager config (e.g., .npmrc).
 * @returns The auth token string, or undefined if not configured.
 */
export function getRegistryAuthToken(
  registryUrl: string,
  baseDir: string = process.cwd()
): string | undefined {
  const pkgManager = getPkgManager(baseDir)
  // x-ref: https://github.com/vercel/next.js/pull/68522
  const resolvedFlags = pkgManager === 'npm' ? '--no-workspaces' : ''

  let scope: string
  try {
    const url = new URL(registryUrl)
    scope = `//${url.host}${url.pathname}`
    if (!scope.endsWith('/')) scope += '/'
  } catch {
    return undefined
  }

  try {
    const output = execSync(
      `${pkgManager} config get "${scope}:_authToken" ${resolvedFlags}`,
      {
        env: {
          ...process.env,
          NODE_OPTIONS: getFormattedNodeOptionsWithoutInspect(),
        },
      }
    )
      .toString()
      .trim()

    if (output && output !== 'undefined') {
      return output
    }
  } catch {
    // Auth token is not required — fall through to return undefined
  }

  return undefined
}
