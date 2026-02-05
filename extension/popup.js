document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('profileContainer');
    const addBtn = document.getElementById('addBtn');
    const statusEl = document.getElementById('status');

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

    // Set job URL immediately
    if (tab?.url) {
        document.getElementById('jobUrl').value = tab.url;
    }

    // Load profiles
    let profiles = [];
    container.innerHTML = '<span style="font-size:11px;color:#999;">Loading...</span>';

    const updateSelection = (id) => {
        document.getElementById('profileId').value = id;
        document.querySelectorAll('.profile').forEach(item => {
            if (item.dataset.id === id) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    };

    try {
        const res = await fetch('https://final-destination-rose.vercel.app/api/profiles');
        if (res.ok) {
            profiles = await res.json();
            container.innerHTML = '';

            if (profiles.length > 0) {
                document.getElementById('profileId').value = profiles[0].id;

                profiles.forEach((p, idx) => {
                    const item = document.createElement('div');
                    item.className = 'profile' + (idx === 0 ? ' selected' : '');
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

    // Show loading state for AI fields
    const companyNameInput = document.getElementById('companyName');
    const positionTitleInput = document.getElementById('positionTitle');
    const companyUrlInput = document.getElementById('companyUrl');

    companyNameInput.classList.add('loading-field');
    positionTitleInput.classList.add('loading-field');
    companyUrlInput.classList.add('loading-field');
    statusEl.textContent = "🔍 AI analyzing page...";
    statusEl.className = "loading";

    // Get page content if possible
    let pageContent = "";
    if (tab?.id && tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const selection = window.getSelection().toString();
                    if (selection) return { selection, bodyText: "" };
                    const mainContent = document.querySelector('main, article, [role="main"], .job-description, #job-description');
                    const bodyText = mainContent ? mainContent.innerText : document.body.innerText;
                    return { selection: "", bodyText: bodyText.slice(0, 3000) };
                }
            });

            if (results && results[0]?.result) {
                const { selection, bodyText } = results[0].result;
                if (selection) {
                    document.getElementById('jobDescription').value = selection;
                }
                pageContent = selection || bodyText;
            }
        } catch (e) {
            console.log("Could not get page content", e);
        }
    }

    // Helper to show confidence indicator
    function showConfidence(input, level) {
        const wrapper = input.parentElement;
        let indicator = wrapper.querySelector('.confidence');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'confidence';
            wrapper.appendChild(indicator);
        }

        if (level === 'high') {
            indicator.textContent = '✓';
            indicator.style.color = '#10b981';
            indicator.title = 'AI is confident';
        } else if (level === 'medium') {
            indicator.textContent = '?';
            indicator.style.color = '#f59e0b';
            indicator.title = 'Please verify';
        } else {
            indicator.textContent = '!';
            indicator.style.color = '#ef4444';
            indicator.title = 'Low confidence - verify this';
        }
    }

    // Call AI API to extract job info
    try {
        const response = await fetch('https://final-destination-rose.vercel.app/api/extract-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageTitle: tab?.title || "",
                pageUrl: tab?.url || "",
                pageContent: pageContent
            })
        });

        if (response.ok) {
            const data = await response.json();

            if (data.companyName) {
                companyNameInput.value = data.companyName;
                showConfidence(companyNameInput, data.confidence?.companyName || 'low');
            }
            if (data.positionTitle) {
                positionTitleInput.value = data.positionTitle;
                showConfidence(positionTitleInput, data.confidence?.positionTitle || 'low');
            }
            if (data.companyUrl) {
                companyUrlInput.value = data.companyUrl;
                showConfidence(companyUrlInput, data.confidence?.companyUrl || 'low');
            }

            // Show overall status based on confidence
            const lowConfidenceFields = [];
            if (data.confidence?.companyName === 'low') lowConfidenceFields.push('Company');
            if (data.confidence?.positionTitle === 'low') lowConfidenceFields.push('Position');
            if (data.confidence?.companyUrl === 'low') lowConfidenceFields.push('Website');

            if (lowConfidenceFields.length > 0) {
                statusEl.textContent = `⚠️ Verify: ${lowConfidenceFields.join(', ')}`;
                statusEl.className = "warning";
            } else {
                statusEl.textContent = "✓ Fields extracted";
                statusEl.className = "success";
            }
        } else {
            console.error("AI extraction failed");
            statusEl.textContent = "⚠️ AI unavailable";
            statusEl.className = "warning";
            fallbackExtraction(tab?.title || "", tab?.url || "");
        }
    } catch (e) {
        console.error("AI extraction error", e);
        statusEl.textContent = "⚠️ Using fallback";
        statusEl.className = "warning";
        fallbackExtraction(tab?.title || "", tab?.url || "");
    }

    // Remove loading state
    companyNameInput.classList.remove('loading-field');
    positionTitleInput.classList.remove('loading-field');
    companyUrlInput.classList.remove('loading-field');
    companyNameInput.placeholder = "Company name";
    positionTitleInput.placeholder = "Job title";
    companyUrlInput.placeholder = "https://company.com";

    // Fallback extraction function
    function fallbackExtraction(title, url) {
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.replace(/^(www\.|careers\.|jobs\.|apply\.|hire\.)/, '').split('.');
            if (parts.length >= 1) {
                const main = parts[0];
                if (!companyNameInput.value) {
                    companyNameInput.value = main.charAt(0).toUpperCase() + main.slice(1);
                }
                if (!companyUrlInput.value) {
                    companyUrlInput.value = `https://www.${parts.slice(0).join('.')}`;
                }
            }
        } catch { }

        if (title && !positionTitleInput.value) {
            const cleaned = title.split(/[-–|]/)[0].trim()
                .replace(/\s*at\s+\w+.*$/i, '')
                .replace(/\s*\|\s*\w+.*$/i, '');
            if (cleaned.length < 80) {
                positionTitleInput.value = cleaned;
            }
        }
    }

    // Handle Add Button
    addBtn.addEventListener('click', async () => {
        const selectedProfileId = document.getElementById('profileId').value;
        const selectedProfile = profiles.find(p => p.id === selectedProfileId);

        const job = {
            companyName: companyNameInput.value.trim(),
            positionTitle: positionTitleInput.value.trim(),
            companyUrl: document.getElementById('jobUrl').value.trim(),
            jobDescription: document.getElementById('jobDescription').value.trim(),
            personalDetails: document.getElementById('personalDetails')?.value?.trim() || '',
            profileId: selectedProfileId || undefined,
            profileName: selectedProfile ? selectedProfile.name : undefined,
            profileColor: selectedProfile ? selectedProfile.color : undefined,
            companyWebsite: companyUrlInput.value.trim()
        };

        if (!job.companyName || !job.positionTitle || !job.companyUrl || !job.jobDescription) {
            statusEl.textContent = "Fill all fields";
            statusEl.className = "error";
            if (!job.companyName) companyNameInput.style.borderColor = "#ef4444";
            if (!job.positionTitle) positionTitleInput.style.borderColor = "#ef4444";
            if (!job.companyUrl) document.getElementById('jobUrl').style.borderColor = "#ef4444";
            if (!job.jobDescription) document.getElementById('jobDescription').style.borderColor = "#ef4444";
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

    // Clear red borders on input
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => {
            el.style.borderColor = "#E5E5E5";
        });
    });
});
