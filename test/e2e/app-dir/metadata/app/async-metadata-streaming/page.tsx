import { connection } from 'next/server'

export async function generateMetadata() {
  await connection()
  await new Promise((resolve) => setTimeout(resolve, 100))

  return {
    title: 'Async Metadata Page',
    description: 'This page has async metadata that should stream',
  }
}

export default function Page() {
  return (
    <div>
      <h1>Async Metadata Streaming Test</h1>
      <p id="async-metadata-page">
        This page tests that manifest links remain in the head even when
        metadata is streamed
      </p>
    </div>
  )
}
