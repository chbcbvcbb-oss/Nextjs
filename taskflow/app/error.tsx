'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="empty">
      <h1>Something went wrong</h1>
      <p className="task-meta">
        {error.digest ? `Error digest: ${error.digest}` : 'Unexpected error.'}
      </p>
      <p style={{ marginTop: '1rem' }}>
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
      </p>
    </div>
  )
}
