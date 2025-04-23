# XMage Deck Downloader

A Chrome extension that allows you to download MTG decks from various platforms in XMage format.

## Supported Platforms
- MTGGoldfish
- Moxfield
## Easy Installation Method

1. Go to realses.
2. Download the newest .crx file.
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Drag the .crx file to the extension window.

## Manual Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `Xmage-Downloader` folder

## Usage

1. Navigate to a deck page on one of the supported platforms
3. Go to the area for download/Exporting a deck for the site, you should see a download for Xmage button.
4. Click the button to download the deck in a .dck format.

## Features

- Downloads decks in XMage-compatible (.dck) format
- Preserves card quantities and set information
- Handles both mainboard and sideboard cards
- Keeps the deck name.
- Supports commander.
- Simple and intuitive interface

## Development

The extension is built using:
- Chrome Extension Manifest V3
- Vanilla JavaScript
- HTML/CSS for the popup interface

## TODO
- add support for mtgtop8
- add support for archidekt
- Improve the downloading mechansim
## License

MIT License 