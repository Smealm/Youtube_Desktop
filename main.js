const path = require('path');
const fs = require('fs').promises;
const { app, BrowserWindow, session } = require('electron');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const lastDownloadFile = path.join(app.getPath('userData'), 'lastDownload.json');

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

// Function to check if an extension needs to be redownloaded
const needsRedownload = async (url) => {
    const currentTime = Date.now();
    let lastDownloadData = {};

    try {
        const data = await fs.readFile(lastDownloadFile);
        lastDownloadData = JSON.parse(data);
    } catch (err) {
        console.log('No previous download record found.');
    }

    const extensionId = path.basename(url, '.zip');
    const lastDownloadedTime = lastDownloadData[extensionId] || 0;

    return (currentTime - lastDownloadedTime) > 24 * 60 * 60 * 1000;
};

// Function to update the last downloaded timestamp
const updateLastDownloadTime = async (url) => {
    const extensionId = path.basename(url, '.zip');

    let lastDownloadData = {};
    try {
        const data = await fs.readFile(lastDownloadFile);
        lastDownloadData = JSON.parse(data);
    } catch (err) {
        console.log('No previous download record found.');
    }

    lastDownloadData[extensionId] = Date.now();
    await fs.writeFile(lastDownloadFile, JSON.stringify(lastDownloadData));
};

// Function to process and load an extension (ZIP only)
const processAndLoadExtension = async (url, targetFolder) => {
    try {
        const fileName = path.basename(url);
        const filePath = path.join(targetFolder, fileName);

        if (await needsRedownload(url)) {
            await downloadFile(url, filePath);
            await updateLastDownloadTime(url);
            await extractZipFile(filePath, targetFolder);
        } else {
            console.log(`Using already unpacked extension: ${targetFolder}`);
        }

        await session.defaultSession.loadExtension(targetFolder);
        console.log(`Extension loaded from: ${url}`);
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
        await processAndLoadExtension(url, targetFolder);
    }
};

// Function to load and set up blocking with caching
const setupBlocking = async () => {
  const cachePath = path.join(app.getPath('userData'), 'engine.bin');; // Root app directory
  
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
  ], {
    path: cachePath, // Saving the cache in the root app directory
    read: fs.readFile,
    write: fs.writeFile,
  });

  // Enable ad blocking in the current session
  blocker.enableBlockingInSession(session.defaultSession);
};

const cookiesFilePath = path.join(app.getPath('userData'), 'cookies.json');

// Function to dump cookies to a file
const dumpCookies = async () => {
    try {
        const cookies = await session.defaultSession.cookies.get({});
        const cookieData = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expirationDate: cookie.expirationDate,
            url: `http${cookie.secure ? 's' : ''}://${cookie.domain}` // Add URL to the cookie data
        }));

        await fs.writeFile(cookiesFilePath, JSON.stringify(cookieData, null, 2));
        console.log('Cookies dumped to cookies.json');
    } catch (err) {
        console.error('Error dumping cookies:', err);
    }
};

const loadCookies = async () => {
    try {
        const cookieData = await fs.readFile(cookiesFilePath, 'utf-8');

        // Check if the file is empty
        if (!cookieData) {
            console.log('Cookies file is empty, no cookies loaded.');
            return;
        }

        const cookies = JSON.parse(cookieData);

        for (const cookie of cookies) {
            // Validate cookie's domain attribute and set it only for valid domains
            if (cookie.url && cookie.domain) {
                // Correct the domain format if it starts with '.'
                const validDomain = cookie.domain.startsWith('.') || cookie.domain === 'youtube.com';

                if (validDomain) {
                    try {
                        // Ensure the domain is properly formatted with 'https://'
                        cookie.url = 'https://' + (cookie.domain.startsWith('.') ? 'www.' + cookie.domain.slice(1) : cookie.domain);

                        // If the cookie has __Host- or __Secure- prefix, ensure it meets the necessary conditions
                        if (cookie.name.startsWith('__Host-') || cookie.name.startsWith('__Secure-')) {
                            // Check for secure cookie requirements
                            cookie.secure = true;
                            cookie.sameSite = 'None'; // or 'Strict' based on your needs
                        }

                        // Ensure SameSite=None is used with Secure attribute
                        if (cookie.sameSite === 'None' && !cookie.secure) {
                            console.error('Cannot set SameSite=None without Secure flag.');
                            continue; // Skip this cookie if it doesn't meet the requirements
                        }

                        // Set the cookie in the session
                        await session.defaultSession.cookies.set(cookie);
                        console.log(`Cookie set for domain: ${cookie.domain}`);
                    } catch (err) {
                        console.error('Error setting cookie for domain:', cookie.domain, err);
                    }
                } else {
                    console.error('Skipping cookie with invalid domain:', cookie);
                }
            }
        }

        console.log('Cookies loaded from cookies.json');
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('No cookies file found, starting with fresh session.');
        } else if (err instanceof SyntaxError) {
            console.error('Error parsing cookies file. The file might be corrupted.');
        } else {
            console.error('Error loading cookies:', err);
        }
    }
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
    
	// Load cookies before loading the URL
    await loadCookies();

    
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
        // Ensure asynchronous tasks are handled correctly
        (async () => {
            await dumpCookies(); // Ensure dumpCookies is defined elsewhere
            if (process.platform !== 'darwin') app.quit();
        })();
    });
}