import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import multer from 'multer';
import vision from '@google-cloud/vision';
import fs from 'fs';

let currentQuestion = ''; 
let correctAnswer = ''; 

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

dotenv.config();

const upload = multer({ dest: 'uploads/'});

const client = new vision.ImageAnnotatorClient({
  keyFilename: 'omaope-vision.json' 
});

let koealueTekstina = '';
let context = [];

app.post('/chat', async (req,res) =>{
  const userMessage = req.body.question;
  console.log(userMessage);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: userMessage }
      ],
      max_tokens: 150
    })
  });

  console.log(response);

  if(response.status === 200){
    const data = await response.json();
    console.log(data.choices[0].message.content);
    res.json({answer: data.choices[0].message.content});
  }


});

app.post('/upload-images', upload.array('images', 10), async (req,res) =>{
  const files = req.files;
  console.log("kuvat vastaaotettu")
  console.log(files);

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }
  else{
    //Odotetaan, että kaikki kuvat on käsitelty OCR:n avulla, eli jokaisen kuvan teksti tunnistetaan.
    const texts = await Promise.all(files.map(async file => {
      // suoritetaan, että saadaan tiedostopolku kuvalle, jonka OCR-tunnistus halutaan suorittaa. 
      const imagePath = file.path;
      console.log(imagePath);
      // kutsu GCV API:lle, joka suorittaa OCR:n annetulle kuvalle
      const [result] = await client.textDetection(imagePath);
      //ottaa result-muuttujasta kaikki tekstintunnistusmerkinnät (textAnnotations), jotka sisältävät kaikki kuvasta tunnistetut tekstialueet.
      const detections = result.textAnnotations;
      console.log('OCR Detected Text:', detections);
      // poistaa tiedoston, joka on luotu kuvan lähettämisen yhteydessä
      fs.unlinkSync(imagePath);
      // Koodi tarkistaa, löytyykö kuvasta OCR-tunnistuksen perusteella tekstiä. Jos löytyy, se palauttaa tämän tekstin. Jos ei, se palauttaa tyhjän merkkijonon 
      return detections.length > 0 ? detections[0].description : '';
     }));

    console.log(texts);
    koealueTekstina = texts.join(' ');
     console.log('OCR Combined Text:', koealueTekstina);

     context = [{ role: 'user', content: koealueTekstina }];
     const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: context.concat([{ role: 'user', content: 'Luo yksi yksinkertainen ja selkeä kysymys kenttään Kysymys: ja sen vastaus kenttään Vastaus yllä olevasta tekstistä englanniksi. Kysy vain yksi asia kerrallaan.' }]),
        max_tokens: 150
      })
    });

    if(response.status===200){
      const data = await response.json();
      console.log(data.choices[0].message);
      
      const responseText = data.choices[0].message.content.trim();
      console.log('Response Text:', responseText);

        // Tarkistaa, onko Response textissä 'Vastaus:'. Jos on, se jakaa vastauksen kysymykseen ja vastaukseen. Jos ei, se asettaa kysymykseksi koko vastauksen ja jättää vastauksen tyhjäksi.
        const [question, answer] = responseText.includes('Vastaus:') ? responseText.split('Vastaus:'): [responseText, null]; 
        console.log('Parsed Question:', question);
        console.log('Parsed Answer:', answer);

        if (!question || !answer) {
          return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
        }


      currentQuestion = question.trim();
      correctAnswer = answer.trim();

      // lisää kysymys ja vastaus chatin context-taulukkoon
      context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
      context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

      console.log(context);

      
      res.json({question: currentQuestion, answer: correctAnswer});

    }
    else{
      console.log('API response error:', response);
    }
    
  }


});

app.post('/check-answer', async (req,res) =>{
  const userAnswer = req.body.user_answer;
  const correctAnswer = req.body.correct_answer;
  console.log("Users answer: " + userAnswer);
  console.log("Computers answer: " + correctAnswer);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Olet ilkeä opettaja jonka tehtävä on arvioida oppilasta ja olet.' },
        { role: 'user', content: `Kysymys: ${currentQuestion}` },
        { role: 'user', content: `Oikea vastaus: ${correctAnswer}` },
        { role: 'user', content: `Opiskelijan vastaus: ${userAnswer}` },
        { role: 'user', content: 'Arvioi opiskelijan vastaus asteikolla 0-10 ja anna lyhyt selitys. Hauku oppilasta. Puhu suomea. Anna lyhyt vastaus.' }
      ],
      max_tokens: 150
    })
  });

  if(response.status === 200){
    const data = await response.json();
    //console.log('API response:', JSON.stringify(data));
    const evaluation = data.choices[0].message.content.trim();
    console.log('Evaluation:', evaluation);

    res.json({ evaluation });  
 }

});

app.post('/next-question', async (req, res) => {
  console.log('Fetching next question');

  try {

      // Generate the next question in Finnish using GPT-4
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: context.concat([{ role: 'user', content: 'Luo toinen yksinkertainen ja selkeä koetehtävä ja eri kysymys ja sen vastaus yllä olevasta tekstistä suomeksi: "${combinedText}". Kysy vain yksi asia kerrallaan.' }]),
              max_tokens: 150
          })
      });

      const data = await response.json();
      console.log('API response:', JSON.stringify(data, null, 2));

      if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
          throw new Error('No valid choices returned from API');
      }

      const responseText = data.choices[0].message.content.trim();
      console.log('Response Text:', responseText);

    
      const [question, answer] = responseText.includes("Vastaus:")
          ? responseText.split("Vastaus:")
          : [responseText, null];
          
      console.log('Parsed Question:', question);
      console.log('Parsed Answer:', answer);

      if (!question || !answer) {
          return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
      }

      currentQuestion = question.trim(); // Päivitetään nykyinen kysymys
      correctAnswer = answer.trim(); // Päivitetään oikea vastaus

      // Update context with the new question and answer
      context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
      context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

      res.json({ question: currentQuestion, answer: correctAnswer });
  } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
