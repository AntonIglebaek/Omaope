let correctAnswer = ''; // Muuttuja oikean vastauksen tallentamiseen

document.getElementById('chatbot-send-button').addEventListener('click', sendChatMessage);

document.getElementById('chatbot-user-input').addEventListener('keypress', function (keyPressed) {
    if (keyPressed.key === 'Enter') {
        sendChatMessage();
    }
  });

document.getElementById('send-images-button').addEventListener('click', sendImages);
  
document.getElementById('send-answer-button').addEventListener('click', sendAnswer);

async function sendChatMessage() {
    console.log('viesti lähetetään');
    var userChatMessage = document.getElementById('chatbot-user-input').value;
    console.log(userChatMessage);
    document.getElementById('chatbot-user-input').value = '';
    addMessageToChatbox("Me: " + userChatMessage, "user-message", "chatbox"); 


        const response = await fetch('/chat',{
            method: 'POST',
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify({question:userChatMessage})
        });
        
        console.log(response);

        if(response.status === 200){
            const data = await response.json();
            console.log(data);
            addMessageToChatbox("ChatGPT: " + data.answer, "bot-message", "chatbox");
        }
        else{
                addMessageToChatbox("An error occurred. Try again later.", "bot-message", "chatbox")
        }
    }
    


function addMessageToChatbox(message, className, box){
    console.log('viesti lisätään chatboxiin');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', className)
    messageElement.innerText = message;
    console.log(messageElement);
    document.getElementById(box).appendChild(messageElement);


}
    
async function sendImages(){
    const imageInput = document.getElementById('image-files');
    const files = imageInput.files;
  
    if (files.length === 0) {
      alert('Choose images first.');
      return;
    }  
    console.log(files);

    const formData = new FormData();
    for (const file of files) {
        formData.append('images', file);
    }
    
    console.log(formData);
    //logataan että nähdään tiedostot
    console.log(formData.getAll('images'));

    const response = await fetch('/upload-images',{
        method: 'POST',
        body: formData
    })

    if(response.status === 200){
        const data = await response.json();
        console.log(data.question);
        addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message', 'omaopebox');
        correctAnswer = data.answer;
    }
    else{
        const data = await response.json();
        console.log(data.error);
        alert(data.error);
    }

  }

  async function sendAnswer(){
    const answerInput = document.getElementById('answer-input').value;
    addMessageToChatbox("you: " + answerInput, "user-message", "omaopebox");
    document.getElementById('answer-input').value = '';
    if (answerInput.trim() === '') return;
    console.log(answerInput);
    
    const response = await fetch('/check-answer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
                    },
        body: JSON.stringify({ user_answer: answerInput, correct_answer: correctAnswer })    
    });

    const data = await response.json();
  
    if(response.status === 200){
      console.log(data.evaluation);
      addMessageToChatbox("OmaOpe: " + data.evaluation, "bot-message", "omaopebox");
      fetchNextQuestion();

    }
    else{
        console.log(data);
        alert(data.error);
    }
  }



  async function fetchNextQuestion() {
  
    try {
  
      const response = await fetch('/next-question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        
    });
  
    const data = await response.json();
        currentQuestion = data.question;
        correctAnswer = data.answer;
        console.log(currentQuestion);
        console.log(correctAnswer);
        addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message', 'omaopebox');
  
  } catch(error) {
    console.error('Error:', error);
    addMessageToChatbox('ChatGPT: Somthing went wrong. Try again later.', 'bot-message', 'omaopebox'); 
  }; 
  };
  