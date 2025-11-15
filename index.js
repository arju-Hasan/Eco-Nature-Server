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
    const db = client.db('ChallengesTrackerDB');
    const challengesCollection = db.collection('challenges');
    const userCollection = db.collection('users');
    app.locals.challengesCollection = challengesCollection;
    app.locals.userCollection = userCollection;

    console.log("Successfully connected to MongoDB!");


    

    app.get('/', (req, res) => res.send('Challange Tracker Server is running!'));

    // app.post('/users', async (req, res) => {
    //   const user = req.body;
    //   const query = { email: user.email };
    //   const existingUser = await userCollection.findOne(query);
    //   if (existingUser) {
    //     return res.send({ message: 'User already exists', insertedId: null });
    //   }
    //   const result = await userCollection.insertOne(user);
    //   res.send(result);
    // });

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


//  
//     app.post('/users', async (req, res) => {
//   const user = req.body;
//   const query = { email: user.email };
//   const existingUser = await userCollection.findOne(query);
//   if (existingUser) {
//     return res.send({ message: 'User already exists', insertedId: null });
//   }
//   const result = await userCollection.insertOne(user);
//   res.send(result);
// });



    app.get('/challenges/featured', async (req, res) => {
        const featuredchallenges = await challengesCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
        res.send(featuredchallenges);
    });
    app.get('/challenges', async (req, res) => {
        const category = req.query.category;
        const searchTerm = req.query.search;
        let query = {};
        if (category) query.category = category;
        if (searchTerm) query.title = { $regex: searchTerm, $options: 'i' };
        const challenges = await challengesCollection.find(query).toArray();
        res.send(challenges);
    });


    app.post('/challenges', verifyToken, async (req, res) => {
        const challengesData = req.body;
        if (req.decodedEmail !== challengesData.userEmail) {
           return res.status(403).send({ message: 'Token email does not match user email.' });
        }
        challengesData.createdAt = new Date(); 
        challengesData.completionHistory = []; 
        const result = await challengesCollection.insertOne(challengesData);
        // res.send(result);
        res.send({ insertedId: result.insertedId });

    });
// ============ User Challenges =============
    const userChallengesCollection = db.collection('userchallenges');
    app.post('/userchallenges', verifyToken, async (req, res) => {
//       const existing = await userChallengesCollection.findOne({
//         userId,
//         challengeId: new ObjectId(challengeId)
//       });
// 
//     if (existing) return res.status(409).send({ message: 'Already joined' });
// 
//     const doc = { ...req.body, joinDate: new Date() };
//     const result = await userChallengesCollection.insertOne(doc);
//     res.send(result);
// });
// // ============= user Challenges End =============
// app.post("/userchallenges", async (req, res) => {
  try {
    const { userId, challengeId, status, progress, joinDate } = req.body;

    const query = {
      userId,
      challengeId: new ObjectId(challengeId),
    };

    // Already joined?
    const exists = await userChallengesCollection.findOne(query);
    if (exists) {
      return res.status(409).send({ message: "already joined" });
    }

    const doc = {
      userId,
      challengeId: new ObjectId(challengeId),
      status,
      progress,
      joinDate: new Date(joinDate),
    };

    const result = await userChallengesCollection.insertOne(doc);
    res.send(result);

  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to join challenge" });
  }
});


//================= get user challenges ==============
app.get("/userchallenges/:email", async (req, res) => {
  const email = req.params.email;

  try {
    const result = await userChallengesCollection
      .find({ userId: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to load user's challenges" });
  }
});

// ==========================
    app.get('/challenges/user/:email', verifyToken, async (req, res) => {
        if (req.decodedEmail !== req.params.email) {
            return res.status(403).send({ message: 'Unauthorized access' });
        }
        const userchallenges = await challengesCollection.find({ userEmail: req.params.email }).toArray();
        res.send(userchallenges);
    });
    app.get('/challenges/id/:id', verifyToken, async (req, res) => {
        const challange = await challengesCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!challange) return res.status(404).send({ message: 'Challange not found' });
        res.send(challange);
    });
    app.delete('/challenges/id/:id', verifyToken, async (req, res) => {
        const challange = await challengesCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!challange) return res.status(404).send({ message: 'Challange not found' });
        if (challange.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        const result = await challengesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
    });
    app.patch('/challenges/id/:id', verifyToken, async (req, res) => {
        const challange = await challengesCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!challange) return res.status(404).send({ message: 'Challange not found' });
        if (challange.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        const updatedData = req.body;
        const updateDoc = {
            $set: {
                title: updatedData.title,
                description: updatedData.description,
                category: updatedData.category,
                reminderTime: updatedData.reminderTime,
                image: updatedData.image,
                participants: updatedData.participants,    // this line was missing before add 
            },
        };
        const result = await challengesCollection.updateOne({ _id: new ObjectId(req.params.id) }, updateDoc);
        res.send(result);
    });
    app.patch('/challenges/complete/:id', verifyToken, async (req, res) => {
        const challange = await challengesCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!challange) return res.status(404).send({ message: 'Challange not found' });
        if (challange.userEmail !== req.decodedEmail) return res.status(403).send({ message: 'Unauthorized' });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alreadyCompleted = challange.completionHistory.some(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
        });
        if (alreadyCompleted) {
            return res.send({ message: 'Challange already completed today.', modifiedCount: 0 });
        }
        const updateDoc = { $push: { completionHistory: { date: new Date() } } };
        const result = await challengesCollection.updateOne({ _id: new ObjectId(req.params.id) }, updateDoc);
        res.send(result);
    });

    
    app.listen(port, () => {
      console.log(`Challange Tracker Server is running on port: ${port}`);
    });

  } catch (error) {
    console.error("Failed to connect to MongoDB and start server:", error);
  }
}


run().catch(console.dir); 
