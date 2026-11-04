export interface CardData{card?:string;rank?:number;suit?:string;hidden?:boolean}

const SUIT_NAME:Record<string,string>={S:'pique',H:'cœur',D:'carreau',C:'trèfle'}
const RANK_LABEL:Record<number,string>={11:'V',12:'D',13:'R',14:'A'}
const RANK_NAME:Record<number,string>={11:'Valet',12:'Dame',13:'Roi',14:'As'}

export const rankLabel=(rank:number)=>RANK_LABEL[rank]??String(rank)
export const cardName=(card:CardData)=>card.hidden||!card.rank||!card.suit?'Carte cachée':`${RANK_NAME[card.rank]??card.rank} de ${SUIT_NAME[card.suit]}`
