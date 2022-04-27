// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import {JSDOM} from 'jsdom'
import savedVehicles from '../../data/vehiclesDB'


export interface VehicleBasicDetails{
    vehicleNumber:string;
    make: string;
    model: string;
    carrier:string;
    depot:string;
    type:'bus'|'tram';
}

export interface Model{
    make: string;
    model: string;
    type:'bus'|'tram';
    amount:number;
}

const vehiclesBasicDetails:VehicleBasicDetails[] = []

const getVehiclesBasicDetailsFromDOM = (dom:JSDOM, array:VehicleBasicDetails[], type:'bus'|'tram')=>{
    //@ts-expect-error
    const elements = dom.window.document.querySelector(".grid-body").children
    const nthValue = (element:any, n:number)=>element.children.item(n).textContent as string
    for(let i = 0; i<elements.length;i++){
        const element = elements[i]
        const vehicle = {
            vehicleNumber: nthValue(element, 0),
            make: nthValue(element, 1),
            model: nthValue(element, 2),
            carrier: nthValue(element, 3),
            depot: nthValue(element, 4),
            type
        }
        if(array.indexOf(vehicle) !== -1) return
        array.push(vehicle)
      };
}

const models:Model[] = []

const refreshAllVehiclesBasicDetails = async ()=>{
    vehiclesBasicDetails.splice(0, vehiclesBasicDetails.length)
    vehiclesBasicDetails.splice(0, vehiclesBasicDetails.length)
    const busData = await (await fetch('https://www.ztm.waw.pl/en/vehicle-database/?ztm_traction=1')).text()
    const busDom = new JSDOM(busData)
    //@ts-expect-error
    const busPageAmount = parseInt(busDom.window.document.getElementsByClassName("nav-links").item(0)?.children.item(3)?.children.item(0)?.textContent?.split(' ')[1])
    getVehiclesBasicDetailsFromDOM(busDom, vehiclesBasicDetails,'bus')
    for(let page = 1; page <= busPageAmount; page++){
        console.log('bus', page)
        const data = await (await fetch(`https://www.ztm.waw.pl/en/vehicle-database/page/${page}/?ztm_traction=1?`)).text()
        const dom = new JSDOM(data)
        getVehiclesBasicDetailsFromDOM(dom, vehiclesBasicDetails,'bus')
    }

    const tramData = await (await fetch('https://www.ztm.waw.pl/en/vehicle-database/?ztm_traction=2')).text()
    const tramDom = new JSDOM(tramData)
    //@ts-expect-error
    const tramPageAmount = parseInt(tramDom.window.document.getElementsByClassName("nav-links").item(0)?.children.item(3)?.children.item(0)?.textContent?.split(' ')[1])
    getVehiclesBasicDetailsFromDOM(tramDom, vehiclesBasicDetails,'tram')
    for(let page = 1; page <= tramPageAmount; page++){
        const data = await (await fetch(`https://www.ztm.waw.pl/en/vehicle-database/page/${page}/?ztm_traction=2?`)).text()
        console.log('tram', page)
        const dom = new JSDOM(data)
        getVehiclesBasicDetailsFromDOM(dom, vehiclesBasicDetails,'tram')
    }
   
    console.log(models)
}

const getModels = ()=>{
    for(const vehicle of vehiclesBasicDetails){
        if(models.findIndex(m=>m.make==vehicle.make&&m.model==vehicle.model&&m.type==vehicle.type) != -1){
            const model = models.find(m=>m.make==vehicle.make&&m.model==vehicle.model&&m.type==vehicle.type)!
            model.amount+=1
            continue
        }
        models.push({
            make: vehicle.make,
            model: vehicle.model,
            type: vehicle.type,
            amount: 1,
        })
    }
}
(async ()=>{
    if(!savedVehicles){
        await refreshAllVehiclesBasicDetails()
    }else{
        vehiclesBasicDetails.push(...savedVehicles.filter((v,i)=>savedVehicles.findIndex(a=>a.vehicleNumber==v.vehicleNumber&&a.type==v.type)==i))
    }
    getModels()
})()


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const offset = parseInt((req.query.offset as string)||'0')
    const limit = parseInt((req.query.limit as string)||'0')
    const ids = ((req.query.ids as string) || '').split(',')
    delete req.query.limit
    delete req.query.offset
    delete req.query.ids
    const options = {...req.query} as Partial<VehicleBasicDetails>
    
    res.json(vehiclesBasicDetails.filter(v=>{
        if(ids[0] != '' && ids.findIndex(e=>e == v.vehicleNumber) == -1){
            console.log("0")
            return false
        }
        let ret = true
        for(const option in options){
            if(v[option as keyof VehicleBasicDetails] !== options[option as keyof VehicleBasicDetails]) {ret = false; break}
        }
        return ret
    }).slice(offset,offset+limit))
}
