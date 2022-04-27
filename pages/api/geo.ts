// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { Vehicle } from '../../types';

type Data = Vehicle[]

const vehicles:Vehicle[] = []

const transformFromApi = (data:any[],targetArray:Vehicle[], type:'tram'|'bus') => {
  if(data[0].Lines){
    const tempArray = targetArray.filter(v=>v.type!=type)
    targetArray.splice(0,targetArray.length)
    targetArray.push(...tempArray)
    for(const vehicle of data){
      targetArray.push({
        line: vehicle.Lines as string,
        geo: [vehicle.Lon as number, vehicle.Lat as number],
        vehicleNumbers: (vehicle.VehicleNumber as string).split("+"),
        brigade: vehicle.Brigade as string,
        time: new Date(vehicle.Time),
        type
      })
    }
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
  // console.log(vehicles.find(v=>v.type=='bus'), vehicles.find(v=>v.type=='tram'))
}

refreshData()

setInterval(refreshData,30000)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const time = new Date()
  res.status(200).json(vehicles.filter((v,i)=>vehicles.findIndex(a=>a.vehicleNumbers==v.vehicleNumbers&&a.type==v.type)==i).filter(v=>v.time.valueOf()>time.valueOf()-60000))
}
