const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

const serviceAccount = require("./eco-nature-client-firebase.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// --- Middleware ---
app.use(cors());
app.use(express.json());


async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'No token provided or invalid format' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.decodedEmail = decodedToken.email;
        next();
    } catch (error) {
        console.error("Error verifying token:", error.code);
        return res.status(403).send({ message: 'Forbidden access' });
    }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@econature.eb2s0v0.mongodb.net/?appName=EcoNature`;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
  
    await client.connect();
    const db = client.db('habitTrackerDB');
    const habitCollection = db.collection('habits');
    const userCollection = db.collection('users');
    app.locals.habitCollection = habitCollection;
    app.locals.userCollection = userCollection;

    console.log("Successfully connected to MongoDB!");


    

    app.get('/', (req, res) => res.send('Habit Tracker Server is running!'));
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get('/habits/featured', async (req, res) => {
        const featuredHabits = await habitCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
        res.send(featuredHabits);
    });
    app.get('/habits', async (req, res) => {
        const category = req.query.category;
        const searchTerm = req.query.search;
        let query = {};
        if (category) query.category = category;
        if (searchTerm) query.title = { $regex: searchTerm, $options: 'i' };
        const habits = await habitCollection.find(query).toArray();
        res.send(habits);
    });


    app.post('/habits', verifyToken, async (req, res) => {
        const habitData = req.body;
        if (req.decodedEmail !== habitData.userEmail) {
           return res.status(403).send({ message: 'Token email does not match user email.' });
        }
        habitData.createdAt = new Date(); 
        habitData.completionHistory = []; 
        const result = await habitCollection.insertOne(habitData);
        res.send(result);
    });
    app.get('/habits/:email', verifyToken, async (req, res) => {
        if (req.decodedEmail !== req.params.email) {
            return res.status(403).send({ message: 'Unauthorized access' });
        }
        const userHabits = await habitCollection.find({ userEmail: req.params.email }).toArray();
        res.send(userHabits);
    });
    app.get('/habit/:id', verifyToken, async (req, res) => {
        const habit = await habitCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!habit) return res.status(404).send({ message: 'Habit not found' });
        res.send(habit);
    });
    app.delete('/habits/:id', verifyToken, async (req, res) => {
        const habit = await habitCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!habit) return res.status(404).send({ message: 'Habit not found' });
        if (habit.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        const result = await habitCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
    });
    app.patch('/habits/:id', verifyToken, async (req, res) => {
        const habit = await habitCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!habit) return res.status(404).send({ message: 'Habit not found' });
        if (habit.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        const updatedData = req.body;
        const updateDoc = {
            $set: {
                title: updatedData.title,
                description: updatedData.description,
                category: updatedData.category,
                reminderTime: updatedData.reminderTime,
                image: updatedData.image,
            },
        };
        const result = await habitCollection.updateOne({ _id: new ObjectId(req.params.id) }, updateDoc);
        res.send(result);
    });
    app.patch('/habits/complete/:id', verifyToken, async (req, res) => {
        const habit = await habitCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!habit) return res.status(404).send({ message: 'Habit not found' });
        if (habit.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alreadyCompleted = habit.completionHistory.some(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
        });
        if (alreadyCompleted) {
            return res.send({ message: 'Habit already completed today.', modifiedCount: 0 });
        }
        const updateDoc = { $push: { completionHistory: { date: new Date() } } };
        const result = await habitCollection.updateOne({ _id: new ObjectId(req.params.id) }, updateDoc);
        res.send(result);
    });

    
    app.listen(port, () => {
      console.log(`Habit Tracker Server is running on port: ${port}`);
    });

  } catch (error) {
    console.error("Failed to connect to MongoDB and start server:", error);
  }
}


run().catch(console.dir); 
