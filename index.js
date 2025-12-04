const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@econature.eb2s0v0.mongodb.net/?appName=EcoNature`;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



app.get('/', (req, res) => {
  res.send("Eco tracker Server is running");
})



async function run() {
  try {

    const db = client.db("EcoTrackerDB");
    const usersCollection  = db.collection("users");
    const challengesCollection = db.collection("challenges");
    const ecoTipsCollection = db.collection("eco_tips");
    const eventsCollection = db.collection("events");
    const subscribersCollection = db.collection("subscribers");
    const challengesParticipantsCollection = db.collection("challengesParticipants");
    const joinedEventsCollection = db.collection("joined_events");


    // ALl Methords 
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email }
      const existingUser = await usersCollection 
      .findOne(query);
      if (existingUser) {
        res.send({ message: 'User already exist, Do not need to insert again.' });
      }
      else {
        const result = await usersCollection 
        .insertOne(newUser);
        res.send(result);

      }
    })

// POST /api/joined_events - Join a challenge/event
app.post('/api/joined-events', async (req, res) => {
  try {
    const { participantName, participantEmail, participantLocation, challengeId } = req.body;

    if (!participantName || !participantEmail || !participantLocation || !challengeId) {
      return res.status(400).send({ message: "All fields are required" });
    }

    // Check if participant already joined this challenge
    const existing = await joinedEventsCollection.findOne({ participantEmail, challengeId });
    if (existing) {
      return res.status(400).send({ message: "You have already joined this challenge!" });
    }

    // Insert new joined event record
    const result = await joinedEventsCollection.insertOne({
      participantName,
      participantEmail,
      participantLocation,
      challengeId,
      joinedAt: new Date(),
    });

    // Update participants count in challengesCollection
    await challengesCollection.updateOne(
      { _id: new ObjectId(challengeId) },
      { $inc: { participants: 1 } }
    );

    res.status(201).send({
      message: "Successfully joined the event",
      result,
    });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).send({ message: "Server error", error });
  }
});
// GET all participants for a specific challenge/event
app.get('/api/joined-events/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const participants = await joinedEventsCollection.find({ challengeId }).toArray();
    res.send(participants);
  } catch (error) {
    console.error("Error fetching joined events:", error);
    res.status(500).send({ message: "Server error", error });
  }
});

// PATCH /api/events/:id/join
//===============================
app.patch("/api/events/:id/join", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, location } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the event
    const event = await eventsCollection.findOne({ _id: id });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if full
    if (event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ message: "Event is full" });
    }

    // Initialize joinBy if not exists
    let joinByArray = Array.isArray(event.joinBy) ? event.joinBy : [];

    // Check duplicate
    if (joinByArray.includes(email)) {
      return res.status(400).json({ message: "You already joined this event" });
    }

    // Add user email to joinBy array & increment currentParticipants
    joinByArray.push(email);

    await eventsCollection.updateOne(
      { _id: id },
      {
        $set: { joinBy: joinByArray },
        $inc: { currentParticipants: 1 },
      }
    );

    res.json({ message: "Joined successfully" });
  } catch (error) {
    console.error("JOIN ERROR:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//==============================


    app.get('/api/challenges',  async (req, res) => {
      try {
        // Get query parameters from URL
        const { participantsMin, participantsMax, category, startDateFrom, startDateTo } = req.query;

        // Create dynamic filter object
        const filter = {};

        if (participantsMin || participantsMax) {
          filter.participants = {};
          if (participantsMin) filter.participants.$gte = parseInt(participantsMin);
          if (participantsMax) filter.participants.$lte = parseInt(participantsMax);
        }
        if (category) {

          const categories = Array.isArray(category) ? category : category.split(',');
          filter.category = { $in: categories };
        }

    // StartDate range filter
    if (startDateFrom || startDateTo) {
      filter.startDate = {};
      if (startDateFrom) filter.startDate.$gte = startDateFrom;
      if (startDateTo) filter.startDate.$lte = startDateTo;
    }
    
        // Fetch filtered data from MongoDB
        const result = await challengesCollection.find(filter).toArray();

        // Send response
        res.send(result);
      } catch (error) {
        console.error('Error fetching challenges:', error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });


    // find  challengesCollection all data
    app.get('/api/participants', async (req, res) => {
      const cursor = challengesParticipantsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })


    // Add challenges Method
    app.post('/api/challenges',  async (req, res) => {
      const newChallenge = req.body;
      const { createdBy, title } = newChallenge;

      // Check if the same user already added this specific challenge title
      const query = { createdBy: createdBy, title: title };
      const existingChallenge = await challengesCollection.findOne(query);

      if (existingChallenge) {
        return res.status(400).send({
          success: false,
          message: 'You have already added this challenge. Please choose a different title.'
        });
      }

      // If not found, insert the new challenge
      const result = await challengesCollection.insertOne(newChallenge);
      res.send({ success: true, result });
    });



    // POST /api/participants - Add new participant and increase challenge count
    app.post('/api/participants', async (req, res) => {
      try {
        const participant = req.body;
        const { participantEmail, challengeId } = participant;

        // Check if the participant already joined this challenge
        const existing = await challengesParticipantsCollection.findOne({
          participantEmail,
          challengeId
        });

        if (existing) {
          return res.status(400).send({
            message: 'You have already joined this challenge!',
          });
        }

        // Insert the new participant
        const result = await challengesParticipantsCollection.insertOne(participant);

        //  Update participants count in related challenge
        await challengesCollection.updateOne(
          { _id: new ObjectId(challengeId) },
          { $inc: { participants: 1 } }
        );
        res.status(201).send({
          message: 'Participant joined successfully',
          result,
        });
      } catch (error) {
        console.error('Error adding participant:', error);
        res.status(500).send({ message: 'Server error', error });
      }
    });

    // New subscriber Api 
    app.post("/api/subscribe", async (req, res) => {
      const { name, email } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: "Name and Email are required" });
      }

      try {
        // Check if email already exists
        const existing = await subscribersCollection.findOne({ email });
        if (existing) {
          return res.status(400).json({ message: "Email already subscribed" });
        }

        // Insert new subscriber
        const result = await subscribersCollection.insertOne({
          name,
          email,
          createdAt: new Date(),
        });

        res.status(201).json({ message: "Subscribed successfully!", subscriberId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // EcoTips Collection 
app.get('/api/eco-tips', async (req, res) => {
  const cursor = ecoTipsCollection.find();
  const result = await cursor.toArray();
  res.send(result)
})

// PATCH /api/eco-tips/:id/upvote
app.patch("/api/eco-tips/:id/upvotes", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const tip = await ecoTipsCollection.findOne({ _id: id });
    if (!tip) return res.status(404).json({ message: "Tip not found" });

    if (tip.upvotedBy && tip.upvotedBy.includes(email)) {
      return res.status(400).json({ message: "Already upvoted" });
    }

    await ecoTipsCollection.updateOne(
      { _id: id },
      {
        $inc: { upvotes: 1 },
        $addToSet: { upvotedBy: email },
        $set: { updatedAt: new Date() },
      }
    );

    res.json({ message: "Upvoted successfully" });
  } catch (err) {
    console.error("Upvote Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//******************************************************* */
    // events Collection 
    app.get('/api/events', async (req, res) => {
      const cursor = eventsCollection.find();
      const result = await cursor.toArray();
      res.send(result)
      // console.log(result);
    })

    // Find single event
    app.get('/api/events/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      // const query = { _id: new ObjectId(id) };
      const query = { _id: id};
      const result = await eventsCollection.findOne(query);
      res.send(result);
    })

// UPDATE a challenge (by ID)
app.patch('/api/challenges/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        title: updatedData.title,
        category: updatedData.category,
        description: updatedData.description,
        duration: updatedData.duration,
        target: updatedData.target,
        impactMetric: updatedData.impactMetric,
        startDate: updatedData.startDate,
        endDate: updatedData.endDate,
        imageUrl: updatedData.imageUrl,
        updatedAt: new Date(),
      },
    };
    const result = await challengesCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error updating challenge:", error);
    res.status(500).send({ message: "Failed to update challenge" });
  }
});

// DELETE a challenge (by ID)
app.delete('/api/challenges/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await challengesCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error deleting challenge:", error);
    res.status(500).send({ message: "Failed to delete challenge" });
  }
});

    // Find single Challenges by id
    app.get('/api/challenges/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await challengesCollection.findOne(query);
      res.send(result);
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Eco Server is running on port: ${port}`);
})

