// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { Vehicle } from '../../types';

type Data = Vehicle[]

const vehicles:Vehicle[] = []

const transformFromApi = (data:any[],targetArray:Vehicle[], type:'tram'|'bus') => {
  if(!data[0].Lines) return
  const tempArray = targetArray.filter(v=>v.type!=type)
  const oldArray = targetArray.slice()
  targetArray.splice(0,targetArray.length)
  targetArray.push(...tempArray)
  for(const vehicle of data){
    const oldVehicle = oldArray.find(v=>v.id==(vehicle.VehicleNumber as string).split("+")&&v.type==type)
    targetArray.push({
      line: vehicle.Lines as string,
      geo: [vehicle.Lon as number, vehicle.Lat as number],
      id: (vehicle.VehicleNumber as string).split("+"),
      brigade: vehicle.Brigade as string,
      time: new Date(vehicle.Time),
      type,
      movement: oldVehicle ? [(vehicle.Lon as number)-oldVehicle?.geo[0],(vehicle.Lon as number)-oldVehicle?.geo[1]]: undefined
    })
  }
  
}

const refreshData = async ()=>{
  const url = "https://api.um.warszawa.pl/api/action/busestrams_get/"
  const data = {
    resource_id: 'f2e5503e-927d-4ad3-9500-4ab9e55deb59',
    apikey: process.env.UM_WWA_API_TOKEN,
    limit: 3
  }
  //@ts-expect-error
  const busParams = new URLSearchParams({...data, type: 1})
  //@ts-expect-error
  const tramParams = new URLSearchParams({...data, type: 2})
  
  const busData = (await (await fetch(`${url}?${busParams.toString()}`)).json()).result
  const tramData = (await (await fetch(`${url}?${tramParams.toString()}`)).json()).result
  
  transformFromApi(busData, vehicles, 'bus')
  transformFromApi(tramData, vehicles, 'tram')
}

const promise = refreshData()

setInterval(refreshData,10000)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await promise
  const time = new Date()
  res.status(200).json(vehicles.filter((v,i)=>vehicles.findIndex(a=>a.id==v.id&&a.type==v.type)==i).filter(v=>v.time.valueOf()>time.valueOf()-60000))
}
