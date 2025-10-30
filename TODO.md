# TODO for Journal Entry Editor Enhancement

## Tasks
- [x] Update Journal schema in server.js to include mood (String) and tags (Array of Strings)
- [x] Modify /api/saveJournal route in server.js to accept and save mood and tags
- [x] Add /api/deleteJournal/:id route in server.js for deleting entries
- [ ] Enhance modal in home.ejs: Add mood selector with 5 buttons (Sad: red, Okay: yellow, Good: green, Great: blue, Loved: pink), only one selectable
- [ ] Add tags input in modal: Type #tagname + Enter to add chips with x to remove
- [ ] Enhance Quill editor with emoji and link support, add toolbar above editor with icons for bold, italic, underline, lists, emoji, link
- [ ] Add Save button (solid primary) and Delete button (red outline with confirmation) in modal
- [ ] Implement autosave on changes (every 5 seconds or on input)
- [ ] Add Preview toggle to view formatted text in modal
- [ ] Ensure dark mode compatibility for modal
- [ ] Update .box display in home.ejs to include mood (as icon/text) and tags (as chips)
- [ ] Add JavaScript for new functionalities (mood selection, tags management, autosave, preview, delete confirmation)
- [ ] Test modal functionality, saving, deleting, autosave, preview
- [ ] Ensure mobile responsiveness and dark mode
