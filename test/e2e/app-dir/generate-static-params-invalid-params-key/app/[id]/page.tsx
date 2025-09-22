export default function Page() {
  return <p>hello world</p>
}

export function generateStaticParams() {
  return [{ id1: '1' }, { id2: '2' }]
}
