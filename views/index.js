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
        quill.setText('');
    } catch (error) {
        console.error(error);
    }
}

async function deleteText(textId) {
    try {
        await fetch(`/api/deleteText/${textId}`, {
            method: 'DELETE',
        });
        loadTexts();
    } catch (error) {
        console.error('Error deleting text:', error);
    }
}

function open_editor() {
    var btn = document.getElementById('cta-btn');
    btn.innerText = "Close";
    btn.classList.add("change-color");
    btn.removeEventListener("click", open_editor);
    btn.addEventListener("click", close_editor);
    document.getElementById('editor-container').style.display = "block";
}

function close_editor() {
    var btn = document.getElementById('cta-btn');
    btn.innerText = "Start Journaling";
    btn.classList.remove("change-color");
    btn.removeEventListener("click", close_editor);
    btn.addEventListener("click", open_editor);
    document.getElementById('editor-container').style.display = "none";
}

function openOverlay() {
    document.getElementById('overlay').style.display = 'block';
}

function closeOverlay() {
    document.getElementById('overlay').style.display = 'none';
}

document.getElementById('diary').addEventListener('click', open_diary);

function open_diary() {
    window.location.href = "diary";
}

document.getElementById('projects').addEventListener('click', open_projects);

function open_projects() {
    window.location.href = "projects";
}

document.getElementById('aboutfriends').addEventListener('click', aboutfriends);

function aboutfriends() {
    window.location.href = "friendslist";
}

function open_inspiration() {
    window.location.href = "idols";
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

   // Get the modal
   var modal = document.getElementById("loginModal");

   // Get the div that opens the modal
   var restrictedDiv = document.getElementById("restricted-info");

   // Get the <span> element that closes the modal
   var closeModal = document.getElementById("closeModal");

   // When the user clicks on the div, open the modal
   restrictedDiv.onclick = function() {
       modal.style.display = "block";
   }

   // When the user clicks on <span> (x), close the modal
   closeModal.onclick = function() {
       modal.style.display = "none";
   }

   // When the user clicks anywhere outside of the modal, close it
   window.onclick = function(event) {
       if (event.target == modal) {
           modal.style.display = "none";
       }
   }