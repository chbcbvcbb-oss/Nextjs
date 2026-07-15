if (process.env.FOO1 === 'x') {
  return false
}
if ('FOO2' in process.env) {
  return true
}
const { FOO3 } = process.env
console.log(FOO3)

// ---

const env = process.env
if (env.FOO4 === 'x') {
  return false
}
if ('FOO5' in env) {
  return true
}

// ---

const p = process
if (p.env.FOO6 === 'x') {
  return false
}
if ('FOO7' in p.env) {
  return true
}

// ---

const p = process
const p1 = p
if (p1.env.FOO8 === 'x') {
  return false
}
if ('FOO9' in p1.env) {
  return true
}

// ---

if (
  typeof process === 'object' &&
  process &&
  process.env &&
  process.env.FOO10 !== 'development'
) {
}

// ---

const NAME = 'FOO11'
console.log(process.env[NAME])
