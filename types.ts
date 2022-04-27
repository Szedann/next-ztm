export interface Vehicle {
    line: string;
    geo: [number, number];
    vehicleNumbers: string[];
    time: Date;
    brigade: string;
    type: 'tram'|'bus';
}