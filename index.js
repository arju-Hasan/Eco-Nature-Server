const express = require('express')
const cors = require('cors');
const app = express()
const port = process.env.POTR || 3000

app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Eco Server is running...')
})

app.listen(port, () => {
  console.log(`Eco Server is running... on port ${port}`)
})