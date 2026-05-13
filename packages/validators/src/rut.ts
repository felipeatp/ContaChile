export function validateRUT(rut: string): boolean {
  const clean = rut.replace(/[\.\-]/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/i.test(clean)) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  let sum = 0
  let mult = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }

  const expectedDV = 11 - (sum % 11)
  const expectedChar =
    expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : String(expectedDV)

  return dv === expectedChar
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[\.\-]/g, '')
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formattedBody}-${dv}`
}
