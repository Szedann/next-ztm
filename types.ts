export interface Vehicle {
    line: string;
    geo: [number, number];
    id: string[];
    time: Date;
    brigade: string;
    type: 'tram'|'bus';
    movement?: [number, number];
}

export interface IVehicle {
    id: string;
    type: "bus"|"tram";
    brand: string;
    model: string;
    registrationNumber?: string;
    equipment?: string[];
    ticketMachine?: boolean;
    carrier?: string;
    depot?: string;
    year?: number;
}