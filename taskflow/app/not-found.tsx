import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="empty">
      <h1>404 — Not found</h1>
      <p>That task doesn&apos;t exist (it may have been deleted).</p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/">← Back to dashboard</Link>
      </p>
    </div>
  )
}
