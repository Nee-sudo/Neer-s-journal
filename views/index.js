var quill = new Quill('#editor', {
    theme: 'snow'
  });
  
  async function saveText() {
    const text = quill.root.innerHTML;
  
    try {
      await fetch('/api/saveText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: text })
      });
      // Clear the editor after successful submission
      quill.setText('');
    } catch (error) {
      console.error(error);
      // Handle errors if needed
    }
  }
  
    async function deleteText(textId) {
      try {
        // Make a DELETE request to your API endpoint
        await fetch(`/api/deleteText/${textId}`, {
          method: 'DELETE',
        });
    
        // Reload the text list after deleting the text
        loadTexts();
      } catch (error) {
        console.error('Error deleting text:', error);
        // Handle errors if needed
      }
    }
    // Your existing JavaScript code for loading texts can go here
    function open_editor() {
        // Get the button
        var btn = document.getElementById('cta-btn');
        
        // Change the text
        btn.innerText = "Close";
        
        // Add a class to change the color
        btn.classList.add("change-color");
        
        // Change the click event handler
        btn.addEventListener("click", close_editor);
        
        // Show the editor container
        document.getElementById('editor-container').style.display = "block";
    }
    
    function close_editor() {
        // Get the button
        var btn = document.getElementById('cta-btn');
        
        // Change the text
        btn.innerText = "Start Journaling";
        
        // Remove the class to change the color
        btn.classList.remove("change-color");
        
        // Change the click event handler
        btn.addEventListener("click", open_editor);
        
        // Hide the editor container
        document.getElementById('editor-container').style.display = "none";
    }
    
    // function for overlay
    function openOverlay() {
      document.getElementById('overlay').style.display = 'block';
  }
  
  function closeOverlay() {
      document.getElementById('overlay').style.display = 'block';
  }
  
 

// diary opening function

document.getElementById('diary').addEventListener('click', open_diary);

function open_diary(){
  window.location.href="diary";
}

document.getElementById('projects').addEventListener('click', open_projects);

function open_projects(){
  window.location.href="projects";
}

document.getElementById('aboutfriends').addEventListener('click', aboutfriends);

function aboutfriends(){
  window.location.href="friendslist";
}

function open_inspiration(){
  window.location.href="idols";
}



function searchEntries() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const boxes = document.querySelectorAll('.about-me-box');
  
  boxes.forEach(box => {
      const title = box.querySelector('h2').innerText.toLowerCase();
      const content = box.querySelectorAll('p')[1].innerText.toLowerCase();
      
      if (title.includes(searchTerm) || content.includes(searchTerm)) {
          box.style.display = 'block';
      } else {
          box.style.display = 'none';
      }
  });
}
