import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TaskFlow',
    template: '%s · TaskFlow',
  },
  description:
    'A full-stack task manager built with Next.js App Router, Server Components, and Server Actions.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              ⚡ TaskFlow
            </Link>
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <a
                href="/api/tasks"
                target="_blank"
                rel="noopener noreferrer"
              >
                API
              </a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            Built with Next.js — Server Components, Server Actions, and Route
            Handlers.
          </div>
        </footer>
      </body>
    </html>
  )
}
