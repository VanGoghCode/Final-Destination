document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('profileContainer');
    const addBtn = document.getElementById('addBtn');
    const statusEl = document.getElementById('status');
    const companyNameInput = document.getElementById('companyName');
    const positionTitleInput = document.getElementById('positionTitle');
    const companyUrlInput = document.getElementById('companyUrl');
    const jobUrlInput = document.getElementById('jobUrl');
    const jobDescriptionInput = document.getElementById('jobDescription');
    const profileIdInput = document.getElementById('profileId');

    const passcodeInput = document.getElementById('passcode');
    const copyBtn = document.getElementById('copyBtn');
    const pasteBtn = document.getElementById('pasteBtn');

    if (!container || !addBtn || !passcodeInput) {
        console.error("Required elements not found");
        return;
    }

    // Check if chrome.storage is available
    const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

    // Copy/Paste storage key (global, not tab-specific)
    const CLIPBOARD_STORAGE_KEY = 'fd_clipboard';

    // Copy button handler
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const data = {
                companyName: companyNameInput.value.trim(),
                companyUrl: companyUrlInput.value.trim()
            };

            if (!data.companyName && !data.companyUrl) {
                statusEl.textContent = "Nothing to copy";
                statusEl.className = "error";
                setTimeout(() => { statusEl.textContent = ""; statusEl.className = ""; }, 1500);
                return;
            }

            if (hasStorage) {
                try {
                    await chrome.storage.local.set({ [CLIPBOARD_STORAGE_KEY]: data });
                    copyBtn.classList.add('success');
                    statusEl.textContent = "✓ Copied!";
                    statusEl.className = "success";
                    setTimeout(() => {
                        copyBtn.classList.remove('success');
                        statusEl.textContent = "";
                        statusEl.className = "";
                    }, 1500);
                } catch (e) {
                    console.error("Failed to copy", e);
                    statusEl.textContent = "Copy failed";
                    statusEl.className = "error";
                }
            }
        });
    }

    // Paste button handler
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            if (hasStorage) {
                try {
                    const result = await chrome.storage.local.get(CLIPBOARD_STORAGE_KEY);
                    const data = result[CLIPBOARD_STORAGE_KEY];

                    if (data) {
                        if (data.companyName) {
                            companyNameInput.value = data.companyName;
                        }
                        if (data.companyUrl) {
                            companyUrlInput.value = data.companyUrl;
                        }
                        saveFormData();
                        pasteBtn.classList.add('success');
                        statusEl.textContent = "✓ Pasted!";
                        statusEl.className = "success";
                        setTimeout(() => {
                            pasteBtn.classList.remove('success');
                            statusEl.textContent = "";
                            statusEl.className = "";
                        }, 1500);
                    } else {
                        statusEl.textContent = "Nothing to paste";
                        statusEl.className = "warning";
                        setTimeout(() => { statusEl.textContent = ""; statusEl.className = ""; }, 1500);
                    }
                } catch (e) {
                    console.error("Failed to paste", e);
                    statusEl.textContent = "Paste failed";
                    statusEl.className = "error";
                }
            }
        });
    }

    // Get current tab
    let tab = null;
    try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tab = currentTab;
        }
    } catch (e) {
        console.error("Failed to get tab", e);
    }

    // Global storage key for passcode (same for all tabs)
    const PASSCODE_STORAGE_KEY = 'fd_passcode';
    // Storage key based on tab URL (so different jobs have different saved data)
    const tabUrl = tab?.url || 'default';
    const storageKey = `form_data_${btoa(tabUrl).slice(0, 50)}`;

    // Load saved form data from storage
    const passcodeField = document.getElementById('passcodeField');
    if (hasStorage) {
        try {
            // Load global passcode
            const passcodeResult = await chrome.storage.local.get(PASSCODE_STORAGE_KEY);
            if (passcodeResult[PASSCODE_STORAGE_KEY]) {
                passcodeInput.value = passcodeResult[PASSCODE_STORAGE_KEY];
                // Hide passcode field if already stored
                if (passcodeField) {
                    passcodeField.style.display = 'none';
                }
            }

            // Load tab-specific form data
            const result = await chrome.storage.local.get(storageKey);
            const savedData = result[storageKey];
            if (savedData) {
                if (savedData.companyName) companyNameInput.value = savedData.companyName;
                if (savedData.positionTitle) positionTitleInput.value = savedData.positionTitle;
                if (savedData.companyUrl) companyUrlInput.value = savedData.companyUrl;
                if (savedData.jobUrl) jobUrlInput.value = savedData.jobUrl;
                if (savedData.jobDescription) jobDescriptionInput.value = savedData.jobDescription;
                if (savedData.profileId) profileIdInput.value = savedData.profileId;
                statusEl.textContent = "📋 Restored saved data";
                statusEl.className = "";
            }
        } catch (e) {
            console.error("Failed to load saved data", e);
        }
    }

    // Set job URL if not already saved
    if (!jobUrlInput.value && tab?.url) {
        jobUrlInput.value = tab.url;
    }

    // Auto-extract position title from tab title (page name)
    if (!positionTitleInput.value && tab?.title) {
        // Clean up the title - remove common suffixes like "| Company" or "- Company"
        let title = tab.title;
        // Remove common job site suffixes
        title = title.replace(/\s*[-|·•]\s*(LinkedIn|Indeed|Glassdoor|ZipRecruiter|Monster|Dice|Hired|AngelList|Wellfound|Lever|Greenhouse|Workday|Careers|Jobs).*$/i, '');
        // Remove "Apply" or similar suffixes
        title = title.replace(/\s*[-|·•]\s*(Apply|Application|Job Posting|Job Description).*$/i, '');
        // Trim and set
        positionTitleInput.value = title.trim();
    }

    // Extract company website from job URL
    const extractCompanyWebsite = (jobUrl) => {
        try {
            const url = new URL(jobUrl);
            const hostname = url.hostname.toLowerCase();

            // Common ATS and job board patterns - extract company from path or subdomain
            const atsPatterns = [
                { domain: 'greenhouse.io', pathPattern: /^\/([^\/]+)/ },
                { domain: 'lever.co', pathPattern: /^\/([^\/]+)/ },
                { domain: 'ashbyhq.com', pathPattern: /^\/([^\/]+)/ },
                { domain: 'jobs.lever.co', subdomainCompany: true },
                { domain: 'boards.greenhouse.io', pathPattern: /^\/([^\/]+)/ },
                { domain: 'workday.com', pathPattern: /^\/([^\/]+)/ },
                { domain: 'myworkdayjobs.com', subdomainCompany: true },
                { domain: 'icims.com', subdomainCompany: true },
                { domain: 'smartrecruiters.com', pathPattern: /^\/([^\/]+)/ },
                { domain: 'jobvite.com', subdomainCompany: true },
            ];

            // Check if it's a known ATS
            for (const pattern of atsPatterns) {
                if (hostname.includes(pattern.domain)) {
                    if (pattern.subdomainCompany) {
                        // Company is in subdomain (e.g., company.lever.co)
                        const subdomain = hostname.split('.')[0];
                        if (subdomain && subdomain !== 'www' && subdomain !== 'jobs' && subdomain !== 'careers') {
                            return `https://www.${subdomain}.com`;
                        }
                    } else if (pattern.pathPattern) {
                        // Company is in path
                        const match = url.pathname.match(pattern.pathPattern);
                        if (match && match[1]) {
                            return `https://www.${match[1]}.com`;
                        }
                    }
                }
            }

            // For job boards like LinkedIn, Indeed - can't extract company website
            const jobBoards = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com', 'dice.com'];
            if (jobBoards.some(board => hostname.includes(board))) {
                return ''; // Can't reliably extract company website from these
            }

            // For direct company career pages, extract the main domain
            const cleanHostname = hostname.replace(/^(www\.|careers\.|jobs\.|apply\.|hire\.|recruiting\.)/, '');
            return `https://www.${cleanHostname}`;
        } catch {
            return '';
        }
    };

    // Save form data on every input change
    const saveFormData = () => {
        if (!hasStorage) return;

        // Save global passcode
        chrome.storage.local.set({ [PASSCODE_STORAGE_KEY]: passcodeInput.value }).catch(console.error);

        // Save tab-specific data
        const data = {
            companyName: companyNameInput.value,
            positionTitle: positionTitleInput.value,
            companyUrl: companyUrlInput.value,
            jobUrl: jobUrlInput.value,
            jobDescription: jobDescriptionInput.value,
            profileId: profileIdInput.value
        };
        chrome.storage.local.set({ [storageKey]: data }).catch(console.error);
    };

    // Attach save handler to all inputs
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => {
            el.style.borderColor = "#E5E5E5";
            saveFormData();
        });
    });

    // Refresh profiles when passcode changes
    passcodeInput.addEventListener('input', () => {
        if (passcodeInput.value.length === 8) {
            loadProfiles();
        }
    });

    // Load profiles
    let profiles = [];
    const loadProfiles = async () => {
        const passcode = passcodeInput.value;
        if (!passcode) {
            container.innerHTML = '<span style="font-size:11px;color:#999;">Enter passcode above</span>';
            return;
        }

        if (passcode.length < 8) {
            container.innerHTML = '<span style="font-size:11px;color:#999;">Need 8-digit passcode</span>';
            return;
        }

        container.innerHTML = '<span style="font-size:11px;color:#999;">Loading...</span>';

        try {
            const res = await fetch('https://final-destination-rose.vercel.app/api/profiles', {
                headers: { 'x-passcode': passcode }
            });

            if (res.ok) {
                profiles = await res.json();
                container.innerHTML = '';

                if (profiles.length > 0) {
                    const savedProfileId = profileIdInput.value;

                    profiles.forEach((p) => {
                        const item = document.createElement('div');
                        const isSelected = savedProfileId === p.id;
                        item.className = 'profile' + (isSelected ? ' selected' : '');
                        item.dataset.id = p.id;
                        item.onclick = () => updateSelection(p.id);

                        let bg = "#3b82f6";
                        if (p.color) {
                            if (p.color.includes("red")) bg = "#ef4444";
                            else if (p.color.includes("orange")) bg = "#f97316";
                            else if (p.color.includes("green")) bg = "#10b981";
                            else if (p.color.includes("teal")) bg = "#14b8a6";
                            else if (p.color.includes("blue")) bg = "#3b82f6";
                            else if (p.color.includes("indigo")) bg = "#6366f1";
                            else if (p.color.includes("purple")) bg = "#8b5cf6";
                            else if (p.color.includes("pink")) bg = "#ec4899";
                        }

                        const dot = document.createElement('div');
                        dot.className = 'dot';
                        dot.style.background = bg;
                        dot.textContent = p.avatarText || (p.firstName ? p.firstName[0] : "?");

                        const name = document.createElement('span');
                        name.textContent = p.name;

                        item.appendChild(dot);
                        item.appendChild(name);
                        container.appendChild(item);
                    });
                } else {
                    container.innerHTML = '<span style="font-size:11px;color:#666;">No profiles found</span>';
                }
            } else if (res.status === 401) {
                container.innerHTML = '<span style="font-size:11px;color:#ef4444;">Invalid passcode</span>';
            } else {
                container.innerHTML = '<span style="font-size:11px;color:#666;">Error loading profiles</span>';
            }
        } catch (e) {
            console.error("Failed to load profiles", e);
            container.innerHTML = '<span style="font-size:11px;color:#999;">Offline</span>';
        }
    };

    const updateSelection = (id) => {
        profileIdInput.value = id;
        document.querySelectorAll('.profile').forEach(item => {
            if (item.dataset.id === id) item.classList.add('selected');
            else item.classList.remove('selected');
        });
        container.style.borderColor = "";
        saveFormData();
    };

    // Initial load
    await loadProfiles();

    // Basic extraction from URL (no AI)
    if (!companyNameInput.value || !companyUrlInput.value) {
        try {
            const jobUrl = tab?.url || '';
            const hostname = new URL(jobUrl).hostname;
            const parts = hostname.replace(/^(www\.|careers\.|jobs\.|apply\.|hire\.)/, '').split('.');
            if (parts.length >= 1) {
                const main = parts[0];
                if (!companyNameInput.value) {
                    companyNameInput.value = main.charAt(0).toUpperCase() + main.slice(1);
                    saveFormData();
                }
                // Use the smart extractCompanyWebsite function
                if (!companyUrlInput.value) {
                    const extractedWebsite = extractCompanyWebsite(jobUrl);
                    if (extractedWebsite) {
                        companyUrlInput.value = extractedWebsite;
                    } else {
                        // Fallback to basic extraction
                        companyUrlInput.value = `https://www.${parts.join('.')}`;
                    }
                    saveFormData();
                }
            }
        } catch { }
    }

    // Extract job description from page selection if available
    // Check for both Chrome and Edge internal URLs
    const isInternalUrl = (url) => {
        if (!url) return true;
        return url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('edge://') ||
            url.startsWith('extension://') ||
            url.startsWith('about:');
    };

    const hasScripting = typeof chrome !== 'undefined' && chrome.scripting;

    if (!jobDescriptionInput.value && tab?.id && tab?.url && !isInternalUrl(tab.url) && hasScripting) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const selection = window.getSelection().toString();
                    return selection || "";
                }
            });

            if (results && results[0]?.result) {
                jobDescriptionInput.value = results[0].result;
                saveFormData();
            }
        } catch (e) {
            console.log("Could not get page selection", e);
        }
    }

    // Handle Add Button
    addBtn.addEventListener('click', async () => {
        const passcode = passcodeInput.value.trim();
        const selectedProfileId = profileIdInput.value;
        const selectedProfile = profiles.find(p => p.id === selectedProfileId);

        const job = {
            companyName: companyNameInput.value.trim(),
            positionTitle: positionTitleInput.value.trim(),
            companyUrl: jobUrlInput.value.trim(),
            jobDescription: jobDescriptionInput.value.trim(),
            personalDetails: document.getElementById('personalDetails')?.value?.trim() || '',
            profileId: selectedProfileId || undefined,
            profileName: selectedProfile ? selectedProfile.name : undefined,
            profileColor: selectedProfile ? selectedProfile.color : undefined,
            companyWebsite: companyUrlInput.value.trim(),
            includeCoverLetter: false
        };

        // Validation - check all required fields including profile and passcode
        let hasErrors = false;
        statusEl.textContent = "";
        statusEl.className = "";

        // Reset all border colors
        companyNameInput.style.borderColor = "#E5E5E5";
        positionTitleInput.style.borderColor = "#E5E5E5";
        jobUrlInput.style.borderColor = "#E5E5E5";
        jobDescriptionInput.style.borderColor = "#E5E5E5";
        passcodeInput.style.borderColor = "#E5E5E5";
        container.style.border = "";

        // Validate passcode
        if (!passcode || passcode.length !== 8) {
            passcodeInput.style.borderColor = "#ef4444";
            statusEl.textContent = "8-digit passcode required";
            statusEl.className = "error";
            hasErrors = true;
        }

        // Validate profile first (mandatory)
        if (!selectedProfileId && !hasErrors) {
            container.style.border = "2px solid #ef4444";
            container.style.borderRadius = "8px";
            statusEl.textContent = "Select a profile";
            statusEl.className = "error";
            hasErrors = true;
        }

        if (!job.companyName) {
            companyNameInput.style.borderColor = "#ef4444";
            hasErrors = true;
        }
        if (!job.positionTitle) {
            positionTitleInput.style.borderColor = "#ef4444";
            hasErrors = true;
        }
        if (!job.companyUrl) {
            jobUrlInput.style.borderColor = "#ef4444";
            hasErrors = true;
        }
        if (!job.jobDescription) {
            jobDescriptionInput.style.borderColor = "#ef4444";
            hasErrors = true;
        }

        if (hasErrors) {
            if (!statusEl.textContent) {
                statusEl.textContent = "Fill all fields";
                statusEl.className = "error";
            }
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = "Adding...";
        statusEl.textContent = "";

        try {
            const response = await fetch('https://final-destination-rose.vercel.app/api/queue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-passcode': passcode
                },
                body: JSON.stringify(job)
            });

            if (response.ok) {
                // Clear saved data on successful submission
                if (hasStorage) {
                    await chrome.storage.local.remove(storageKey);
                }

                statusEl.textContent = "✓ Added!";
                statusEl.className = "success";
                setTimeout(() => window.close(), 1000);
            } else if (response.status === 401) {
                throw new Error("Invalid passcode");
            } else {
                const err = await response.json();
                throw new Error(err.error || "Server error");
            }
        } catch (e) {
            console.error(e);
            statusEl.textContent = "Error: " + e.message;
            statusEl.className = "error";
            addBtn.disabled = false;
            addBtn.textContent = "Add to Queue";
        }
    });
});
