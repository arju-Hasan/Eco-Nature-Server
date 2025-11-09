const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const app = express()
const port = process.env.POTR || 3000


const uri = "mongodb+srv://Arju-hasan:ArjuArju@cluster0.rzhc4zj.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Eco Server is running...')

})

async function run(){
     try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
    await client.close();
}
}
run().catch(console.dir)



app.listen(port, () => {
  console.log(`Eco Server is running... on port ${port}`)
})