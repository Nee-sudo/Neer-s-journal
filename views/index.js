const BACKEND_URL = 'https://neersjournal.up.railway.app';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Quill Editor
    const quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Write your journal entry...'
    });

    // Editor Container Toggle
    document.getElementById('cta-btn').addEventListener('click', () => {
        const editorContainer = document.getElementById('editor-container');
        editorContainer.style.display = editorContainer.style.display === 'none' || editorContainer.style.display === '' ? 'block' : 'none';
    });

    // Submit Journal Entry
    document.getElementById('submit-entry').addEventListener('click', async () => {
        const content = quill.root.innerHTML;
        if (!content.trim()) return alert('Please write something before submitting.');

        const journalEntry = { content, id: Date.now(), timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) };

        try {
            await fetch(`${BACKEND_URL}/api/saveText`, { // Adjusted to match backend route
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: journalEntry.content })
            });
            addJournalEntry(journalEntry);
            quill.setContents([]);
            document.getElementById('editor-container').style.display = 'none';
        } catch (error) {
            console.error('Error saving to backend:', error);
            alert('Failed to save to server. Saved locally.');
            addJournalEntry(journalEntry);
            quill.setContents([]);
            document.getElementById('editor-container').style.display = 'none';
        }
    });

    function addJournalEntry(entry) {
        const entriesContainer = document.querySelector('.entries-container');
        const card = document.createElement('div');
        card.className = 'journal-card';
        card.dataset.id = entry.id;
        card.innerHTML = `
            <h3 style="color: #333;">Entry - ${new Date(entry.timestamp).toLocaleDateString()}</h3>
            <div style="color: #555;">${entry.content}</div>
            <div class="card-actions">
                <button class="delete-btn">Delete</button>
            </div>
        `;
        entriesContainer.prepend(card); // Add to top
    }

    // Load Existing Entries
    async function loadJournalEntries() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/getAllTexts`);
            const entries = await response.json();
            entries.forEach(entry => addJournalEntry({
                content: entry.content,
                id: entry._id,
                timestamp: entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            }));
        } catch (error) {
            console.error('Error loading entries:', error);
            // Fallback to local storage if needed (currently not implemented in backend)
        }
    }
    loadJournalEntries();

    // Delete Journal Entry
    document.querySelector('.entries-container').addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const card = event.target.closest('.journal-card');
            if (confirm('Are you sure you want to delete this entry?')) {
                const id = card.dataset.id;
                try {
                    await fetch(`${BACKEND_URL}/api/saveText/${id}`, { method: 'DELETE' }); // Adjust if backend has a delete route
                    card.remove();
                } catch (error) {
                    console.error('Error deleting from backend:', error);
                    alert('Failed to delete from server. Removed locally.');
                    card.remove();
                }
            }
        }
    });

    // Overlay Handling
    function openOverlay() {
        const overlay = document.getElementById('overlays');
        if (overlay) overlay.style.display = 'block';
    }

    function closeOverlay() {
        const overlay = document.getElementById('overlays');
        if (overlay) overlay.style.display = 'none';
    }

    // Navigation Scroll
    document.getElementById('idolsNav').addEventListener('click', () => scrollToSection('idols-section'));
    document.getElementById('friendsNav').addEventListener('click', () => scrollToSection('friends-section'));
    document.getElementById('lifeNav').addEventListener('click', () => scrollToSection('life-section'));

    function scrollToSection(sectionId) {
        document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
    }

    // Friend List Fetch and Display
    async function fetchFriends() {
        try {
            const response = await fetch(`${BACKEND_URL}/friends`);
            const friends = await response.json();
            const friendsElement = document.getElementById('friends');
            friendsElement.innerHTML = '';
            friends.forEach(friend => {
                const friendDiv = document.createElement('div');
                friendDiv.className = 'about-me-box';
                friendDiv.innerHTML = `
                    <center><div class="profile-picture"><img src="${friend.profilePicture || 'https://via.placeholder.com/100'}" alt="${friend.name}"></div></center>
                    <div class="details">
                        <p><strong>Name:</strong> ${friend.name}</p>
                        <p><strong>Country:</strong> ${friend.country}</p>
                        <p><strong>Joined:</strong> ${new Date(friend.joinDate).toLocaleDateString()}</p>
                    </div>
                `;
                friendsElement.appendChild(friendDiv);
            });
        } catch (error) {
            console.error('Error fetching friends:', error);
            document.getElementById('friends').innerHTML = '<p>Failed to load friends. Please try again later.</p>';
        }
    }

    document.getElementById('aboutfriends').addEventListener('click', () => {
        openOverlay();
        fetchFriends();
    });

    // Search Functionality
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function searchEntries() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const boxes = document.querySelectorAll('.about-me-box, .journal-card');

        boxes.forEach(box => {
            const text = box.innerText.toLowerCase();
            box.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    }

    document.getElementById('search-input').addEventListener('input', debounce(searchEntries, 300));
    document.getElementById('search-button').addEventListener('click', searchEntries);

    // Logout Modal
    document.getElementById('logout-button').addEventListener('click', () => $('#logoutModal').modal('show'));
    document.getElementById('confirm-logout').addEventListener('click', () => {
        window.location.href = '/logout';
        $('#logoutModal').modal('hide');
    });
    document.getElementById('cancel-logout').addEventListener('click', () => $('#logoutModal').modal('hide'));

    // Other Navigation
    document.getElementById('diary').addEventListener('click', () => scrollToSection('entries-container'));
    document.getElementById('projects').addEventListener('click', () => scrollToSection('box-container'));
    document.getElementById('inspiration').addEventListener('click', () => scrollToSection('idols-section'));
});