

export const money = (value:number) => `${new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)} WVC`

export const dateTime = (value:number) => new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(value)

export const atlasPosition = (index:number) => `${(index%5)*25}% ${Math.floor(index/5)*(100/3)}%`

export const categoryLabel={Originals:'Originaux',Table:'Casino',Arcade:'Arcade'} as const
