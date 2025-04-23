// Add this at the very top to confirm script injection
console.log("XMage Downloader: Script injected on:", window.location.href);

// --- MTGGoldfish Specific Functions ---

function extractMtgGoldfishDeck() {
    console.log('XMage Downloader: Starting MTGGoldfish deck extraction...');
    let deckTitleElement = document.querySelector('h1.title');
    if (!deckTitleElement) deckTitleElement = document.querySelector('.page-title');

    let deckName;
    if (deckTitleElement) {
        deckName = deckTitleElement.textContent.replace(/\s+/g, ' ').replace(/ Deck$/i, '').replace(/ Archetype$/i, '').trim();
    } else {
        deckName = "MTGGoldfish Deck"; // Fallback name
    }

    const formatElement = document.querySelector('p.deck-container-information');
    let format = 'unknown';
    if (formatElement) {
        const formatMatch = formatElement.textContent.match(/Format:\s*([^\n]+)/i);
        if (formatMatch && formatMatch[1]) format = formatMatch[1].trim().toLowerCase();
    }
    if (format === 'unknown') {
         const pathSegments = window.location.pathname.split('/');
         if (pathSegments.length > 2 && (pathSegments[1] === 'archetype' || pathSegments[1] === 'deck')) {
             format = pathSegments[2].toLowerCase();
         }
    }
    const isCommanderFormat = (format === 'commander' || format === 'edh');

    // Helper function to extract card info
    function extractGoldfishCardInfo(row) {
        const quantityCell = row.querySelector('td:first-child');
        const nameCell = row.querySelector('td span.card_name, td a.card-name')?.closest('td');
        if (!quantityCell || !nameCell) return null;
        const nameLink = nameCell.querySelector('a[data-card-id]');
        if (!nameLink) { // Fallback if link with data-card-id is missing
             let potentialName = nameCell.textContent.trim().split('//')[0].trim().replace(/<.*?>/g, '').trim();
             const quantity = quantityCell.textContent.trim();
              if (!/^\d+$/.test(quantity) || potentialName === '') return null;
             return { quantity, name: potentialName, set: 'UNKNOWN', setNr: '-1' };
        }

        const quantity = quantityCell.textContent.trim();
        let name = nameLink.textContent.trim();
        let set = 'UNKNOWN';
        const cardId = nameLink.getAttribute('data-card-id');

        if (cardId) {
            // Regex: Looks for 3-5 letters/numbers inside EITHER square brackets OR parentheses
            const setMatch = cardId.match(/(?:\[|\()([A-Z0-9]{1,5})(?:\]|\))/i);
            if (setMatch && setMatch[1]) {
                set = setMatch[1].toUpperCase();
            } else {
                 // Attempt fallback: check if cardId *starts* with a potential SET code
                 const prefixMatch = cardId.match(/^([A-Z0-9]{3,5})\s/);
                 if (prefixMatch && prefixMatch[1]) {
                     set = prefixMatch[1].toUpperCase();
                 }
            }
        }

        name = name.split('//')[0].trim();
        name = name.replace(/<.*?>/g, '').trim();
        name = name.replace(/\*F\*/g, '').trim();
        const setNr = '-1';

        if (!/^\d+$/.test(quantity) || name === '') return null;
        return { quantity, name, set, setNr };
    }

    const commanders = [];
    const mainboardCards = [];
    const sideboardCards = [];
    let table = document.querySelector('table.deck-view-deck-table');
    if (!table) table = document.querySelector('.archetype-deck-card-table');

    if (!table) {
        console.error('XMage Downloader: Could not find deck table on MTGGoldfish.');
        throw new Error('Could not find a deck list table on the page.');
    }

    const rows = table.querySelectorAll('tbody tr');
    let currentSection = isCommanderFormat ? 'commander_header_expected' : 'mainboard';
    let foundCommanderHeader = false;

    for (const row of rows) {
        const headerCell = row.querySelector('th[colspan], td[colspan]');
        let isHeader = false;
        if (headerCell && headerCell.textContent.trim() !== '') {
            const headerText = headerCell.textContent.toLowerCase().trim();
            isHeader = true;
            if (headerText.includes('commander')) {
                currentSection = 'commander';
                foundCommanderHeader = true;
            } else if (headerText.includes('sideboard')) {
                currentSection = 'sideboard';
            } else if (foundCommanderHeader && headerText.match(/(creatures?|spells?|artifacts?|enchantments?|planeswalkers?|lands?)/i)) {
                currentSection = 'mainboard';
            } else if (currentSection === 'commander_header_expected' && !headerText.match(/^\d+\s+cards total/i)) {
                 // Any non-total header after expecting commander means we start mainboard
                 currentSection = 'mainboard';
            }
        }
        if (isHeader || (row.cells.length > 0 && row.cells[0].tagName === 'TH') || row.cells.length < 2) continue;

        const cardInfo = extractGoldfishCardInfo(row);
        if (cardInfo) {
            if (currentSection === 'commander' || (isCommanderFormat && !foundCommanderHeader && currentSection !== 'sideboard')) {
                commanders.push(cardInfo);
                // If we identified by position, mark header as 'found' implicitly for subsequent cards
                if (!foundCommanderHeader) foundCommanderHeader = true;
            } else if (currentSection === 'sideboard') {
                sideboardCards.push(cardInfo);
            } else { // mainboard
                mainboardCards.push(cardInfo);
            }
        }
    }

    if (mainboardCards.length === 0 && sideboardCards.length === 0 && commanders.length === 0) {
        console.error('XMage Downloader: No cards extracted from MTGGoldfish.');
        throw new Error('No cards extracted from MTGGoldfish page.');
    }

    return { format, deckName, commanders, mainboard: mainboardCards, sideboard: sideboardCards };
}


function addGoldfishDownloadMenuItem(dropdownMenu) {
    if (dropdownMenu.querySelector('#xmage-download-menu-item')) return; // Prevent duplicate

    const listItem = document.createElement('a');
    listItem.id = 'xmage-download-menu-item';
    listItem.className = 'dropdown-item';
    listItem.href = '#';
    listItem.textContent = 'Download for XMage (.dck)';
    listItem.style.fontWeight = 'bold';
    listItem.style.color = '#198754';

    listItem.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const originalText = listItem.textContent;
        listItem.textContent = 'Processing...';
        listItem.style.pointerEvents = 'none';
        listItem.style.opacity = '0.7';

        setTimeout(() => {
            try {
                const deckData = extractMtgGoldfishDeck();
                const xmageContent = convertToXMageFormat(deckData);
                const blob = new Blob([xmageContent], { type: 'text/plain;charset=utf-8' });
                const downloadUrl = URL.createObjectURL(blob);
                const filename = `${sanitizeFilename(deckData.deckName)}.dck`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
                console.log(`XMage Downloader: MTGGoldfish deck "${filename}" download triggered.`);
                listItem.textContent = 'Downloaded!';
                 setTimeout(() => {
                    listItem.textContent = originalText;
                    listItem.style.pointerEvents = 'auto';
                    listItem.style.opacity = '1';
                 }, 1500);
            } catch (error) {
                console.error('XMage Downloader: Error during Goldfish download:', error);
                alert(`Error extracting Goldfish deck: ${error.message}`);
                listItem.textContent = originalText;
                listItem.style.pointerEvents = 'auto';
                listItem.style.opacity = '1';
            }
        }, 50);
    });

    dropdownMenu.appendChild(listItem);
    console.log('XMage Downloader: Goldfish menu item added.');
}

// --- Moxfield Specific Functions ---

function parseMoxfieldFullFormat(text, format) {
    const lines = text.split('\n');
    const commanders = [];
    const mainboard = [];
    const sideboard = [];
    let currentSection = 'mainboard';
    let cardsProcessedCounter = 0;
    const isCommanderFormat = (format === 'commander' || format === 'edh');

    const lineRegex = /^(\d+)\s+(.+?)\s+(?:\(|\[)([A-Z0-9]{3,5})(?:\)|\])(?:\s+([\w-]+))?(.*)$/i;
    const basicLineRegex = /^(\d+)\s+(.+?)$/;
    let deckName = 'Moxfield Deck';

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === '') continue;

        const upperLine = trimmedLine.toUpperCase();
        if (upperLine === 'SIDEBOARD:' || upperLine === 'SIDEBOARD') {
            currentSection = 'sideboard';
             if (cardsProcessedCounter === 0) cardsProcessedCounter = 99; // Prevent first SB card being CMDR
            continue;
        }
        if (trimmedLine.toLowerCase().startsWith('deck') || trimmedLine.toLowerCase().startsWith('name') || trimmedLine.toLowerCase().startsWith('//') || trimmedLine.toLowerCase().startsWith('about')) {
             if (trimmedLine.toLowerCase().startsWith('deck') || trimmedLine.toLowerCase().startsWith('name')) {
                  const nameMatch = trimmedLine.match(/^(?:deck|name)\s*[:]?\s*(.+)/i);
                  if (nameMatch && nameMatch[1]) deckName = nameMatch[1].trim();
             }
             continue;
         }

        let match = trimmedLine.match(lineRegex);
        let quantity, name, set, setNr, trailing;

        if (match) {
            quantity = match[1]; name = match[2].trim(); set = match[3] ? match[3].toUpperCase() : 'UNKNOWN'; setNr = match[4] || '-1'; trailing = match[5] ? match[5].trim() : '';
        } else {
            match = trimmedLine.match(basicLineRegex);
            if (match) { quantity = match[1]; name = match[2].trim(); set = 'UNKNOWN'; setNr = '-1'; trailing = ''; }
            else { continue; } // Skip unparseable lines
        }

         name = name.split('//')[0].trim();
         name = name.replace(/<.*?>/g, '').trim();
         if(trailing.includes('*F*')) name = name.replace(/\*F\*/g, '').trim();
         name = name.replace(/\*F\*/g, '').trim();

         const cardData = { quantity, name, set, setNr };
         cardsProcessedCounter++;

         // Commander Heuristic (1st/2nd card, Qty 1, Not Sideboard)
         if (isCommanderFormat && cardsProcessedCounter <= 2 && quantity === '1' && currentSection !== 'sideboard') {
             commanders.push(cardData);
         } else if (currentSection === 'sideboard') {
             sideboard.push(cardData);
         } else { // Mainboard
             mainboard.push(cardData);
             // Ensure subsequent cards aren't treated as commanders
             if (cardsProcessedCounter < 3) cardsProcessedCounter = 99;
         }
     }
    return { deckName, commanders, mainboard, sideboard };
}

function addMoxfieldDownloadButton(modalFooter) {
    if (modalFooter.querySelector('#xmage-download-button-modal')) return;

    const mtgoButton = modalFooter.querySelector('a.btn-primary[href*="/download?"]');
    if (!mtgoButton) return;

    const button = document.createElement('button');
    button.id = 'xmage-download-button-modal';
    button.textContent = 'Download for XMage';
    button.className = 'btn btn-success ms-2';
    button.style.fontWeight = 'bold';

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        button.textContent = 'Processing...';
        button.disabled = true;

        try {
            let format = 'unknown';
            const formatElement = document.querySelector('.deckheader-content .mb-4 a.badge-header');
            if (formatElement) {
                format = formatElement.textContent.replace(/<svg.*<\/svg>/i, '').trim().toLowerCase();
                 if (format.includes('commander') || format.includes('edh')) format = 'commander';
            }

            const modalContent = modalFooter.closest('.modal-content');
            const textarea = modalContent?.querySelector('.modal-body textarea[name="full"]');
            if (!textarea) throw new Error("Could not find detailed decklist textarea");

            const parsedData = parseMoxfieldFullFormat(textarea.value, format);
            const deckTitleElement = document.querySelector('span.deckheader-name');
            const headerDeckName = deckTitleElement ? deckTitleElement.textContent.trim() : null;
            const finalDeckName = headerDeckName || parsedData.deckName;

            const deckDataForConversion = { format, commanders: parsedData.commanders, mainboard: parsedData.mainboard, sideboard: parsedData.sideboard };
            const xmageContent = convertToXMageFormat(deckDataForConversion);
            const blob = new Blob([xmageContent], { type: 'text/plain;charset=utf-8' });
            const downloadUrl = URL.createObjectURL(blob);
            const filename = `${sanitizeFilename(finalDeckName)}.dck`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            console.log(`XMage Downloader: Moxfield deck "${filename}" download triggered.`);

            button.textContent = 'Downloaded!';
            setTimeout(() => { button.textContent = 'Download for XMage'; button.disabled = false; }, 1500);
        } catch (error) {
            console.error('XMage Downloader: Error during Moxfield download:', error);
            alert(`Error processing Moxfield deck: ${error.message}`);
            button.textContent = 'Download for XMage';
            button.disabled = false;
        }
    });

    mtgoButton.parentNode.insertBefore(button, mtgoButton.nextSibling);
    console.log('XMage Downloader: Moxfield button added to modal.');
}

function setupMoxfieldObserver() {
    console.log("XMage Downloader: Setting up MutationObserver for Moxfield modals.");
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const modalTitle = node.querySelector ? node.querySelector('.modal-title') : null;
                        const modalFooter = node.querySelector ? node.querySelector('.modal-footer') : null;
                        if (modalTitle && modalTitle.textContent.includes('Download Options') && modalFooter) {
                             setTimeout(() => addMoxfieldDownloadButton(modalFooter), 100);
                        }
                    }
                });
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// --- Shared Helper Functions ---

function convertToXMageFormat(deckData) {
    const format = deckData.format || 'unknown';
    const isCommanderFormat = (format === 'commander' || format === 'edh');
    console.log(`XMage Downloader: Converting format (IsCommander: ${isCommanderFormat})...`);

    let mainboardContent = '';
    let sideboardAndCommanderContent = '';

    // Format Mainboard
    if (deckData.mainboard && deckData.mainboard.length > 0) {
        deckData.mainboard.forEach(card => {
            const setCode = card.set || 'UNKNOWN';
            const setNr = card.setNr || '-1';
            const setInfo = `[${setCode}:${setNr}]`;
            mainboardContent += `${card.quantity} ${setInfo} ${card.name}\n`;
        });
    }

    // Format Commanders (always add to SB section for XMage)
     if (deckData.commanders && deckData.commanders.length > 0) {
         deckData.commanders.forEach(card => {
             const setCode = card.set || 'UNKNOWN';
             const setNr = card.setNr || '-1';
             const setInfo = `[${setCode}:${setNr}]`;
             sideboardAndCommanderContent += `SB: ${card.quantity} ${setInfo} ${card.name}\n`;
         });
     }

    // Format Regular Sideboard (only if NOT commander)
    if (!isCommanderFormat && deckData.sideboard && deckData.sideboard.length > 0) {
        // Add newline separator if commanders were already added
        if (deckData.commanders && deckData.commanders.length > 0 && !sideboardAndCommanderContent.endsWith('\n')) {
             sideboardAndCommanderContent += '\n';
        }
        deckData.sideboard.forEach(card => {
             const setCode = card.set || 'UNKNOWN';
             const setNr = card.setNr || '-1';
             const setInfo = `[${setCode}:${setNr}]`;
            sideboardAndCommanderContent += `SB: ${card.quantity} ${setInfo} ${card.name}\n`;
        });
    } else if (isCommanderFormat && deckData.sideboard && deckData.sideboard.length > 0) {
        console.log(`XMage Downloader: Skipping ${deckData.sideboard.length} regular sideboard cards (Commander format).`);
    }

    // Combine
    let finalContent = mainboardContent.trim();
    if (sideboardAndCommanderContent.length > 0) {
        if (finalContent.length > 0) {
            finalContent += '\n\n'; // Double newline separator
        }
        finalContent += sideboardAndCommanderContent.trim();
    }
    return finalContent;
}

function sanitizeFilename(name) {
    if (!name) return 'Unnamed Deck';
    let cleanName = name.replace(/[<>:"/\\|?*]/g, '_');
    cleanName = cleanName.trim();
    cleanName = cleanName.replace(/[^\w\s\-_.]/g, ''); // Keep spaces, alphanumeric, underscore, hyphen, dot
    if (cleanName.startsWith('.') || /^\.\.?$/.test(cleanName)) {
        cleanName = 'deck' + cleanName;
    }
    cleanName = cleanName.replace(/\s+/g, ' '); // Collapse multiple spaces
    cleanName = cleanName.substring(0, 150);
    return cleanName || 'deck';
}

// --- Goldfish Event Delegation Setup ---
function setupGoldfishDownloadTriggerListener() {
    console.log("XMage Downloader: Setting up MTGGoldfish download listener.");
    document.body.addEventListener('click', (event) => {
        const triggerButton = event.target.closest('a.dropdown-toggle[href*="/deck/download/"]');
        if (triggerButton) {
            console.log('XMage Downloader: MTGGoldfish download trigger clicked.');
            setTimeout(() => { // Wait briefly for menu to appear
                const toolsContainer = triggerButton.closest('.tools-container');
                let dropdownMenu = null;
                if (toolsContainer) dropdownMenu = toolsContainer.querySelector('.dropdown-menu.show');
                if (!dropdownMenu) dropdownMenu = document.querySelector('.dropdown-menu.show a[href*="/deck/download/"]')?.closest('.dropdown-menu.show'); // Fallback

                if (dropdownMenu) addGoldfishDownloadMenuItem(dropdownMenu);
                else console.error('XMage Downloader: Could not find Goldfish download menu.');
            }, 150); // Delay may need adjustment
        }
    }, true);
}


// --- Main Execution & Initialization ---
function initialize() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    console.log("XMage Downloader: Initializing for:", hostname, pathname);

    const isMtgGoldfish = hostname === 'www.mtggoldfish.com' && (pathname.startsWith('/deck/') || pathname.startsWith('/archetype/'));
    const isMoxfield = (hostname === 'www.moxfield.com' || hostname === 'moxfield.com') && pathname.startsWith('/decks/');

    if (isMtgGoldfish) {
        console.log("XMage Downloader: MTGGoldfish page detected.");
        setupGoldfishDownloadTriggerListener();
    } else if (isMoxfield) {
        console.log("XMage Downloader: Moxfield page detected.");
         if (document.readyState === 'loading') {
             document.addEventListener('DOMContentLoaded', setupMoxfieldObserver);
         } else {
             setupMoxfieldObserver();
         }
    } else {
        console.log("XMage Downloader: Not on a supported URL.");
    }
}

initialize();