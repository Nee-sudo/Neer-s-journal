document.addEventListener('DOMContentLoaded', function() {
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
        var overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.display = 'block';
        } else {
            console.error('Element with id "overlay" not found.');
        }
    }

    function closeOverlay() {
        var overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.display = 'none';
        } else {
            console.error('Element with id "overlay" not found.');
        }
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

    document.getElementById('inspiration').addEventListener('click', open_inspiration);
    function open_inspiration() {
        window.location.href = "idols";
    }

    function searchEntries() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const boxes = document.querySelectorAll('.entries-box');

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

    document.getElementById('cta-btn').addEventListener('click', function() {
        var writePad = document.getElementById('write-pad');
        if (writePad.style.display === 'none' || writePad.style.display === '') {
            writePad.style.display = 'block';
        } else {
            writePad.style.display = 'none';
        }
    });

    document.getElementById('journal-form').addEventListener('submit', function(event) {
        event.preventDefault();

        // Get the heading, content, and colors
        var heading = document.getElementById('heading').value;
        var content = document.getElementById('content')
        .value;
        var headingColor = document.getElementById('heading-color').value;
        var contentColor = document.getElementById('content-color').value;
        var boxColor = document.getElementById('box-color').value;

        // Create the new card
        var newCard = document.createElement('div');
        newCard.className = 'journal-card'; // Use the correct class for styling
        newCard.style.backgroundColor = boxColor;
        newCard.innerHTML = `
            <h3 style="color: ${headingColor};">${heading}</h3>
            <p style="color: ${contentColor};">${content}</p>
        `;

        // Append the new card to the entries-container
        document.querySelector('.entries-container').appendChild(newCard);

        // Clear the form and hide the write pad
        document.getElementById('journal-form').reset();
        document.getElementById('write-pad').style.display = 'none';
    });

    function handleCardClick(card) {
        // Remove the 'expanded' class from all cards
        document.querySelectorAll('.journal-card').forEach(c => {
            if (c !== card) {
                c.classList.remove('expanded');
                // Remove close button if present
                const btn = c.querySelector('.close-btn');
                if (btn) {
                    btn.remove();
                }
            }
        });

        // Toggle 'expanded' class on the clicked card
        if (card.classList.contains('expanded')) {
            card.classList.remove('expanded');
            const closeBtn = card.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.remove();
            }
        } else {
            card.classList.add('expanded');
            // Add close button to the expanded card
            if (!card.querySelector('.close-btn')) {
                var closeButton = document.createElement('button');
                closeButton.className = 'close-btn';
                closeButton.innerText = 'Close';
                card.appendChild(closeButton);

                // Add click event for the close button
                closeButton.addEventListener('click', function(event) {
                    event.stopPropagation(); // Prevent triggering the card's click event
                    card.classList.remove('expanded');
                    closeButton.remove(); // Remove the close button when collapsing
                });
            }
        }
    }

    // Attach click event to existing cards
    document.querySelectorAll('.journal-card').forEach(card => {
        card.addEventListener('click', function() {
            handleCardClick(card);
        });
    });

    // Attach click event to newly generated cards
    document.querySelector('.entries-container').addEventListener('click', function(event) {
        if (event.target.closest('.journal-card')) {
            handleCardClick(event.target.closest('.journal-card'));
        }
    });
});
