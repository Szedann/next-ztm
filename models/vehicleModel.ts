import mongoose, { Schema, model, models } from "mongoose";
import { IVehicle } from "../types";
import { connectDB } from "../utils/connectDB";

const vehicleSchema = new Schema({
    id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["bus", "tram"],
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    registrationNumber: {
        type: String,
        required: false
    },
    ticketMachine: {
        type: Boolean,
        required: false
    },
    equipment: {
        type: [String],
        required: false
    },
    carrier: {
        type: String,
        required: false
    },
    depot: {
        type: String,
        required: false
    },
    year: {
        type: Number,
        required: false
    }
})

const Vehicle = models.Vehicle || model<IVehicle>("Vehicle", vehicleSchema);

export default Vehicle;