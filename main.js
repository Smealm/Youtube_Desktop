const path = require('path');
const fs = require('fs').promises;
const { app, BrowserWindow, session } = require('electron');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

// Function to download a file from a URL
const downloadFile = async (url, targetPath) => {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        await fs.writeFile(targetPath, response.data);
        console.log(`Downloaded: ${url}`);
    } catch (err) {
        console.error(`Failed to download file from ${url}:`, err);
        throw err;
    }
};

// Function to extract a ZIP file
const extractZipFile = async (sourcePath, targetFolder) => {
    try {
        const zip = new AdmZip(sourcePath);
        zip.extractAllTo(targetFolder, true);
        console.log(`Extracted ZIP to: ${targetFolder}`);
    } catch (err) {
        console.error(`Failed to extract ZIP:`, err);
        throw err;
    }
};

// Function to process and load an extension (ZIP only)
const processAndLoadExtension = async (url, targetFolder) => {
    try {
        const fileName = path.basename(url); // Get the file name from the URL
        const filePath = path.join(targetFolder, fileName); // Path to save the downloaded file

        // Download the file
        await downloadFile(url, filePath);

        // Extract ZIP files
        if (fileName.endsWith('.zip')) {
            await extractZipFile(filePath, targetFolder);
        } else {
            throw new Error(`Unsupported file type: ${fileName}`);
        }

        // Load the extracted extension
        const extension = await session.defaultSession.loadExtension(targetFolder);
        console.log(`Extension loaded: ${extension.name}`);
    } catch (err) {
        console.error(`Failed to process and load extension from ${url}:`, err);
    }
};

// Load extensions from URLs
const loadExtensions = async (extensionUrls) => {
    const extensionsFolder = path.join(app.getPath('userData'), 'extensions');
    await fs.mkdir(extensionsFolder, { recursive: true });

    for (const url of extensionUrls) {
        const targetFolder = path.join(extensionsFolder, path.basename(url, '.zip'));
        await fs.mkdir(targetFolder, { recursive: true });

        // Process and load each extension
        await processAndLoadExtension(url, targetFolder);
    }
};

// Function to load and set up blocking
const setupBlocking = async () => {
const blocker = await ElectronBlocker.fromLists(fetch, [
    // UBlock Origin filters
    'https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/filters.txt',
    'https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/privacy.txt',
    'https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/badware.txt',
    'https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/quick-fixes.txt',
    'https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/unbreak.txt',
    
    // Easylist filters
    'https://easylist.to/easylist/easylist.txt',
    'https://easylist.to/easylist/easyprivacy.txt',
    
    // Generic filters
    'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt',
    
    // Peter Lowe's list
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=1&mimetype=plaintext',
  ]);

  // Enable ad blocking in the current session
  blocker.enableBlockingInSession(session.defaultSession);
};

// Main window creation function
async function createMainWindow() {
    console.log('Creating main window...');
    const myWindow = new BrowserWindow({
		autoHideMenuBar: true,
        title: 'YouTube',
        width: 1280,
        height: 720,
        icon: path.join(__dirname, 'assets/icon/256x256.png'), // Ensure the path is correct
        webPreferences: {
            nodeIntegration: false, // Security: Disable direct Node.js access in renderer
            contextIsolation: true, // Recommended: Isolate the context
            preload: path.join(__dirname, 'preload.js'), // Use preload for secure API exposure
        },
    });

    // Array of CRX or ZIP URLs
    const extensionUrls = [
        'https://github.com/Anarios/return-youtube-dislike/releases/latest/download/chrome.zip',
        'https://github.com/ajayyy/SponsorBlock/releases/latest/download/ChromeExtension.zip',
    ];

    // Load all extensions
    await loadExtensions(extensionUrls);

    // Load YouTube
    console.log('Loading YouTube...');
    await myWindow.loadURL('https://www.youtube.com').catch(err => {
    console.error('Failed to load YouTube:', err);
    });

    console.log('Main window created.');
}


// App lifecycle management
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length) {
            const myWindow = windows[0];
            if (myWindow.isMinimized()) myWindow.restore();
            myWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await setupBlocking();
        await createMainWindow();


        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}