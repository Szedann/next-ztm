import { JSDOM } from "jsdom";
import mongoose from "mongoose";
import { NextApiRequest, NextApiResponse } from "next"
import { URLSearchParams } from "url";
import Vehicle from "../../models/vehicleModel";
import { IVehicle } from "../../types";
import { connectDB } from "../../utils/connectDB";

const getVehicleDetails = async ({id, type}:{id:string, type:'tram'|'bus'}) => {
    await connectDB()
    console.log({id, type})
    const details = await Vehicle.findOne({id, type}) as IVehicle
    if(details && details.year){
        console.log("found vehicle details.")
        mongoose.connection.close()
        return details
    }
    console.log("no vehicle details found")
    const urlParams = new URLSearchParams({
        ztm_traction:type=='bus'?'1':'4',
        ztm_make:'',
        ztm_model:'',
        ztm_year:'',
        ztm_registration:'',
        ztm_vehicle_number:id,
        ztm_carrier:'',
        ztm_depot:''
    }).toString()
    const searchDOM = new JSDOM(await (await fetch("https://www.ztm.waw.pl/en/vehicle-database/?"+urlParams)).text())
    //@ts-expect-error
    const href = searchDOM.window.document.querySelector(".grid-body")?.children.item(0)?.href
    const vehicleDOM = new JSDOM(await (await fetch(href)).text())
    const detailBlocks = vehicleDOM.window.document.querySelector('.vehicle-details')?.children
    if(!detailBlocks) return undefined
    const getValue = (n1:number,n2:number) => detailBlocks.item(n1)?.children.item(n2)?.children.item(1)?.textContent
    const data:IVehicle = {
        brand: getValue(0,0) as string,
        model: getValue(0,1) as string,
        year: parseInt(getValue(0,2) as string),
        type,
        registrationNumber: getValue(1,1) as string,
        id: getValue(1,2) as string,
        carrier: getValue(2,0) as string,
        depot: getValue(2,1) as string,
        ticketMachine: getValue(3,0) == 'available',
        equipment: (getValue(3,1) as string).split(', ')
    }
    console.log(data)
    await Vehicle.findOneAndUpdate({id, type}, data)
    mongoose.connection.close()
    return data

}   

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if(req.query.type!=='bus'&& req.query.type!=='tram') return res.status(300)
    const q = {
        id: req.query.id as string,
        type: req.query.type as 'bus'|'tram'
    }
    res.json(await getVehicleDetails(q))
}