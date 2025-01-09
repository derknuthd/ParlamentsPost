const express = require('express')
const axios = require('axios')
require('dotenv').config()

const app = express()
app.use(express.json())

app.post('/generate', async (req, res) => {
  const { prompt } = req.body

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/EleutherAI/gpt-neo-125M',
      { inputs: prompt },
      {
        headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` },
      }
    )

    res.json(response.data)
  } catch (error) {
    console.error(error)
    res.status(500).send('Fehler bei der Generierung.')
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Backend läuft auf Port ${PORT}`)
})
