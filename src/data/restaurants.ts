export type Restaurant = {
  id: string
  name: string
  area: string
  embedUrl: string
}

export const restaurants: Restaurant[] = [
  {
    id: 'vilhelm',
    name: 'Cafe Vilhelm',
    area: 'Ahjokatu 18, Seppälä',
    embedUrl: 'https://www.cafevilhelm.fi/lounas',
  },
  {
    id: 'papas',
    name: "Ravintola Papa's",
    area: 'Laukaantie 4, Grafila (2. krs)',
    embedUrl: 'https://www.ravintola-papas.fi/',
  },
  {
    id: 'tourula',
    name: 'Tourulan lounasravintola',
    area: 'Vapaaherrantie 2, Tourula',
    embedUrl: 'https://www.tourulanravintola.fi/buffet-lounas/',
  },
  {
    id: 'leivos',
    name: 'Lounas & Leivos Butik',
    area: 'Sorastajantie 2, Seppälänkangas',
    embedUrl: 'https://leivosbutik.fi/lounas-jyvaskyla/',
  },
  {
    id: 'seppala',
    name: 'Seppälän lounaskeskus',
    area: 'Vasarakatu 29, Seppälä',
    embedUrl: 'https://www.seppalanlounaskeskus.fi/',
  },
]
