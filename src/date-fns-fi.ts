/** Viikonpäivän pitkä nimi suomeksi (Europe/Helsinki). */
export function getFiWeekdayLong(d = new Date()): string {
  return d.toLocaleDateString('fi-FI', {
    weekday: 'long',
    timeZone: 'Europe/Helsinki',
  })
}

/** Päivämäärä muodossa 8.4. tai 08.04. tekstin tunnistusta varten */
export function getFiDatePatterns(d = new Date()): string[] {
  const helsinki = new Date(
    d.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }),
  )
  const day = helsinki.getDate()
  const month = helsinki.getMonth() + 1
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return [
    `${dd}.${mm}.`,
    `${day}.${month}.`,
    `${dd}.${month}.`,
    `${day}.${mm}.`,
  ]
}
