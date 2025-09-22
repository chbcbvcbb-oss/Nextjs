export default function Page() {
  return <p>hello world</p>
}

export function generateStaticParams() {
  return ["should be obj but I'm string", null]
}
