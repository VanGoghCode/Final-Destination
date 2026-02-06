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

    if (!container || !addBtn) {
        console.error("Required elements not found");
        return;
    }

    // Get current tab
    let tab = null;
    try {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = currentTab;
    } catch (e) {
        console.error("Failed to get tab", e);
    }

    // Storage key based on tab URL (so different jobs have different saved data)
    const tabUrl = tab?.url || 'default';
    const storageKey = `form_data_${btoa(tabUrl).slice(0, 50)}`;

    // Load saved form data from storage
    try {
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

    // Set job URL if not already saved
    if (!jobUrlInput.value && tab?.url) {
        jobUrlInput.value = tab.url;
    }

    // Save form data on every input change
    const saveFormData = () => {
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

    // Load profiles
    let profiles = [];
    container.innerHTML = '<span style="font-size:11px;color:#999;">Loading...</span>';

    const updateSelection = (id) => {
        profileIdInput.value = id;
        document.querySelectorAll('.profile').forEach(item => {
            if (item.dataset.id === id) item.classList.add('selected');
            else item.classList.remove('selected');
        });
        // Clear profile error styling
        container.style.borderColor = "";
        saveFormData();
    };

    try {
        const res = await fetch('https://final-destination-rose.vercel.app/api/profiles');
        if (res.ok) {
            profiles = await res.json();
            container.innerHTML = '';

            if (profiles.length > 0) {
                // Don't auto-select any profile - leave profileId empty unless restored from storage
                const savedProfileId = profileIdInput.value;

                profiles.forEach((p) => {
                    const item = document.createElement('div');
                    // Only mark as selected if this was the saved profile
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
                container.innerHTML = '<span style="font-size:11px;color:#666;">No profiles</span>';
            }
        } else {
            container.innerHTML = '<span style="font-size:11px;color:#666;">No profiles</span>';
        }
    } catch (e) {
        console.error("Failed to load profiles", e);
        container.innerHTML = '<span style="font-size:11px;color:#999;">Offline</span>';
    }

    // Basic extraction from URL (no AI)
    if (!companyNameInput.value || !companyUrlInput.value) {
        try {
            const hostname = new URL(tab?.url || '').hostname;
            const parts = hostname.replace(/^(www\.|careers\.|jobs\.|apply\.|hire\.)/, '').split('.');
            if (parts.length >= 1) {
                const main = parts[0];
                if (!companyNameInput.value) {
                    companyNameInput.value = main.charAt(0).toUpperCase() + main.slice(1);
                    saveFormData();
                }
                if (!companyUrlInput.value) {
                    companyUrlInput.value = `https://www.${parts.join('.')}`;
                    saveFormData();
                }
            }
        } catch { }
    }

    // Extract job description from page selection if available
    if (!jobDescriptionInput.value && tab?.id && tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
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
            companyWebsite: companyUrlInput.value.trim()
        };

        // Validation - check all required fields including profile
        let hasErrors = false;
        statusEl.textContent = "";
        statusEl.className = "";

        // Reset all border colors
        companyNameInput.style.borderColor = "#E5E5E5";
        positionTitleInput.style.borderColor = "#E5E5E5";
        jobUrlInput.style.borderColor = "#E5E5E5";
        jobDescriptionInput.style.borderColor = "#E5E5E5";
        container.style.border = "";

        // Validate profile first (mandatory)
        if (!selectedProfileId) {
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(job)
            });

            if (response.ok) {
                // Clear saved data on successful submission
                await chrome.storage.local.remove(storageKey);

                statusEl.textContent = "✓ Added!";
                statusEl.className = "success";
                setTimeout(() => window.close(), 1000);
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
