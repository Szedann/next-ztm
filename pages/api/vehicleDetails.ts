import { JSDOM } from "jsdom";
import { NextApiRequest, NextApiResponse } from "next"
import { URLSearchParams } from "url";

export interface VehicleDetails{
    make:string;
    model:string;
    year:number;
    type:string;
    registrationId:string;
    vehicleNumber:string;
    carrier:string;
    depot:string;
    ticketMachine:boolean;
    equipment:string[];
}

const getVehicleDetails = async ({vehicleNumber, type}:{vehicleNumber:string, type:'tram'|'bus'}) => {
    const urlParams = new URLSearchParams({
        ztm_traction:type=='bus'?'1':'2',
        ztm_make:'',
        ztm_model:'',
        ztm_year:'',
        ztm_registration:'',
        ztm_vehicle_number:vehicleNumber,
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
    const data:VehicleDetails = {
        make: getValue(0,0) as string,
        model: getValue(0,1) as string,
        year: parseInt(getValue(0,2) as string),
        type,
        registrationId: getValue(1,1) as string,
        vehicleNumber: getValue(1,2) as string,
        carrier: getValue(2,0) as string,
        depot: getValue(2,1) as string,
        ticketMachine: getValue(3,0) == 'available',
        equipment: (getValue(3,1) as string).split(', ')
    }
    return data

}   

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if(req.query.type!=='bus'&& req.query.type!=='tram') return res.status(300)
    const q = {
        vehicleNumber: req.query.vehicleNumber as string,
        type: req.query.type as 'bus'|'tram'
    }
    res.json(await getVehicleDetails(q))
}