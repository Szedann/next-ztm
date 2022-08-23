// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import {JSDOM} from 'jsdom'
import { sleep } from '../../functions';
import { connectDB } from '../../utils/connectDB';
import Vehicle from '../../models/vehicleModel';
import mongoose, { Query } from 'mongoose';
import { IVehicle } from '../../types';

export interface Model{
    brand: string;
    model: string;
    type:'bus'|'tram';
    amount:number;
}

const vehiclesBasicDetails:IVehicle[] = []

const getVehiclesBasicDetailsFromDOM = async (dom:JSDOM, array:IVehicle[], type:'bus'|'tram')=>{
    //@ts-expect-error
    const elements = dom.window.document.querySelector(".grid-body").children
    const nthValue = (element:any, n:number)=>element.children.item(n).textContent as string
    for(let i = 0; i<elements.length;i++){
        const element = elements[i]
        const vehicle = {
            id: nthValue(element, 0),
            brand: nthValue(element, 1),
            model: nthValue(element, 2),
            carrier: nthValue(element, 3),
            depot: nthValue(element, 4),
            type
        }
        if(array.indexOf(vehicle) !== -1) return
        console.log(vehicle)
        array.push(vehicle)
        await Vehicle.create({
            id: vehicle.id,
            type: vehicle.type,
            brand: vehicle.brand,
            model: vehicle.model,
            carrier: vehicle.carrier,
            depot: vehicle.depot,
        })
      };
}

const models:Model[] = []

const refreshAllVehiclesBasicDetails = async ()=>{
    await connectDB()
    console.log('refreshing all vehicles basic details')
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
        await getVehiclesBasicDetailsFromDOM(dom, vehiclesBasicDetails,'bus')
        // sleep(100)//try to avoid 429 error
    }
    
    const tramData = await (await fetch('https://www.ztm.waw.pl/en/vehicle-database/?ztm_traction=4')).text()
    const tramDom = new JSDOM(tramData)
    //@ts-expect-error
    const tramPageAmount = parseInt(tramDom.window.document.getElementsByClassName("nav-links").item(0)?.children.item(3)?.children.item(0)?.textContent?.split(' ')[1])
    getVehiclesBasicDetailsFromDOM(tramDom, vehiclesBasicDetails,'tram')
    for(let page = 1; page <= tramPageAmount; page++){
        const data = await (await fetch(`https://www.ztm.waw.pl/en/vehicle-database/page/${page}/?ztm_traction=4?`)).text()
        console.log('tram', page)
        const dom = new JSDOM(data)
        getVehiclesBasicDetailsFromDOM(dom, vehiclesBasicDetails,'tram')
    }
    mongoose.connection.close()
}

const getModels = (array:IVehicle[])=>{
    for(const vehicle of array){
        if(models.findIndex(m=>m.brand==vehicle.brand&&m.model==vehicle.model&&m.type==vehicle.type) != -1){
            const model = models.find(m=>m.brand==vehicle.brand&&m.model==vehicle.model&&m.type==vehicle.type)!
            model.amount+=1
            continue
        }
        models.push({
            brand: vehicle.brand,
            model: vehicle.model,
            type: vehicle.type,
            amount: 1,
        })
    }
    return models
}

const loadVehicles = async ()=>{
    await connectDB()
    const vehicles = await Vehicle.find({})
    mongoose.connection.close()
    return vehicles as IVehicle[]
}

(async ()=>{
    const vehicles = await loadVehicles()
    if(!vehicles.length){ 
        await refreshAllVehiclesBasicDetails()
        vehicles.push(...await loadVehicles())
    }
    console.log(getModels(vehicles))
})()


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
    ) {
    await connectDB()
    const offset = parseInt((req.query.offset as string)||'0')
    const limit = parseInt((req.query.limit as string)||'0')
    const ids = ((req.query.ids as string) || '').split(',')
    const brand = (req.query.brand as string) || ''
    const model = (req.query.model as string) || ''
    const brandRegex = new RegExp(`.*${brand}.*`, 'i')
    const modelRegex = new RegExp(`.*${model}.*`, 'i')
    console.log(req.query)
    delete req.query.limit
    delete req.query.offset
    delete req.query.ids
    delete req.query.brand
    delete req.query.model
    const options = {...req.query} as Partial<IVehicle>
    const filter:mongoose.FilterQuery<IVehicle> = {...options, brand: {$regex: brandRegex}, model: {$regex: modelRegex}}
    console.log(filter)
    const vehicles:IVehicle[] = await Vehicle.find(filter).skip(offset).limit(limit)
    mongoose.connection.close()
    res.json(vehicles)
}
