document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    
    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        if (currentUrl.includes('mtggoldfish.com/deck/') ||
            currentUrl.includes('moxfield.com/decks/') ||
            currentUrl.includes('archidekt.com/decks/')) {
            statusDiv.textContent = 'Deck download available!';
            statusDiv.className = 'status supported';
        } else {
            statusDiv.textContent = 'Not on a supported deck page';
            statusDiv.className = 'status unsupported';
        }
    });
}); 