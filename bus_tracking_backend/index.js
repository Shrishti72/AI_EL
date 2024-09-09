const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
    throw new Error('MONGODB_URI is not defined in .env file');
}

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define schemas and models
const busSchema = new mongoose.Schema({
    busNumber: { type: String, required: true },
    currentLocation: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    speed: { type: Number, required: true },
    destination: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    eta: { type: Number },
    lastUpdated: { type: Date, required: true }
});

const Bus = mongoose.model('Bus', busSchema);

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Function to calculate ETA
function calculateETA(distance, speed) {
    if (speed <= 0) return Infinity; // Avoid division by zero or negative speed
    return (distance / speed) * 60; // ETA in minutes
}

// Endpoint to update ETA and check for delays
app.post('/update-eta', async (req, res) => {
    const { busNumber, currentLocation, speed, destination, lastUpdated } = req.body;

    if (!busNumber || !currentLocation || !destination || !lastUpdated) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Calculate distance and ETA
        const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            destination.latitude,
            destination.longitude
        );
        const eta = calculateETA(distance, speed);

        // Update bus record
        const updatedBus = await Bus.findOneAndUpdate(
            { busNumber },
            { currentLocation, speed, destination, eta, lastUpdated },
            { new: true, upsert: true }
        );

        // Check for delays
        const delayThreshold = 5; // minutes
        const lastUpdatedDate = new Date(lastUpdated);
        const elapsedTime = (Date.now() - lastUpdatedDate.getTime()) / 60000; // minutes
        const delay = eta - elapsedTime;

        if (delay > delayThreshold) {
            console.log(`Bus ${busNumber} is delayed by ${delay.toFixed(2)} minutes.`);
            // Simulate sending a notification
            console.log(`Notification: Bus ${busNumber} is delayed by ${delay.toFixed(2)} minutes.`);
            // Here you could send an email or push notification
        } else {
            console.log(`Bus ${busNumber} is on time.`);
        }

        res.json(updatedBus);
    } catch (error) {
        console.error('Error updating ETA:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
