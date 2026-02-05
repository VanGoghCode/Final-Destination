document.addEventListener('DOMContentLoaded', async () => {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url) {
        document.getElementById('companyUrl').value = tab.url;
    }

    // Fetch profiles
    let profiles = [];
    try {
        const res = await fetch('https://final-destination-rose.vercel.app/api/profiles');
        if (res.ok) {
            profiles = await res.json();
            const container = document.getElementById('profileContainer');
            // Keep the default tag (first child) and remove others if re-rendering (though we only do this once)
            // Actually, simplest is to re-render all relative to the "Default" button

            // Logic to handle tag selection
            const updateSelection = (id) => {
                document.getElementById('profileId').value = id;
                document.querySelectorAll('.profile-item').forEach(item => {
                    if (item.dataset.id === id) item.classList.add('selected');
                    else item.classList.remove('selected');
                });
            };

            // Setup default button
            const defaultTag = container.querySelector('.profile-item');
            defaultTag.addEventListener('click', () => updateSelection(""));

            if (profiles.length > 0) {
                profiles.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'profile-item';
                    item.dataset.id = p.id;
                    item.onclick = () => updateSelection(p.id);

                    // Create avatar
                    const avatar = document.createElement('div');
                    avatar.className = 'profile-avatar';

                    // Color mapping
                    let bg = "#3b82f6"; // Default blue
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
                    avatar.style.background = bg;
                    avatar.textContent = p.avatarText || (p.firstName ? p.firstName[0] : "?");

                    // Create name label
                    const name = document.createElement('span');
                    name.className = 'profile-name';
                    name.textContent = p.name;

                    item.appendChild(avatar);
                    item.appendChild(name);

                    container.appendChild(item);
                });
            }
        }
    } catch (e) {
        console.error("Failed to load profiles", e);
        // Keep default only
    }

    // Execute scrape script
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapePage
    }, (results) => {
        if (results && results[0] && results[0].result) {
            const data = results[0].result;

            // Auto-fill URL if not already set
            if (!document.getElementById('companyUrl').value) {
                document.getElementById('companyUrl').value = data.url;
            }

            // Heuristics for Title/Company
            const docTitle = data.title;
            let company = "";
            let title = docTitle;

            // Common patterns: "Role at Company", "Role | Company", "Company - Role"
            // We'll try a few regexes
            const patterns = [
                /(.*?) at (.*)/i,      // Software Engineer at Google
                /(.*?) \| (.*)/,       // Software Engineer | Google
                /(.*?) - (.*)/,        // Google - Software Engineer (or vice versa)
                /(.*?) – (.*)/         // En-dash
            ];

            for (const pattern of patterns) {
                const match = docTitle.match(pattern);
                if (match) {
                    // Heuristic: Company names are usually shorter than titles + extra keywords? 
                    // Or usually we can't be sure.
                    // Let's guess: if "at", 1=Title, 2=Company.
                    if (pattern.source.includes("at")) {
                        title = match[1].trim();
                        company = match[2].trim();
                    } else {
                        // For separators, often Company is first for branding, or last.
                        // Let's assume the SHORTER one is likely the Company, or check known keywords.
                        const p1 = match[1].trim();
                        const p2 = match[2].trim();
                        if (p1.length < p2.length && p1.length < 30) {
                            company = p1;
                            title = p2;
                        } else {
                            company = p2;
                            title = p1;
                        }
                    }
                    break;
                }
            }

            // Clean up title (remove " | LinkedIn", etc)
            title = title.replace(/ \| LinkedIn| \| Indeed| \| Glassdoor/g, "");

            document.getElementById('positionTitle').value = title;
            if (company) document.getElementById('companyName').value = company;

            if (data.selection) {
                document.getElementById('jobDescription').value = data.selection;
            }
        }
    });

    // Handle Add Button
    document.getElementById('addBtn').addEventListener('click', async () => {
        const btn = document.getElementById('addBtn');
        const status = document.getElementById('status');

        // Gather data
        const profileIdInput = document.getElementById('profileId');
        const selectedProfileId = profileIdInput.value;
        const selectedProfile = profiles.find(p => p.id === selectedProfileId);

        const job = {
            companyName: document.getElementById('companyName').value.trim(),
            positionTitle: document.getElementById('positionTitle').value.trim(),
            companyUrl: document.getElementById('companyUrl').value.trim(),
            jobDescription: document.getElementById('jobDescription').value.trim(),
            personalDetails: document.getElementById('personalDetails').value.trim(),
            // Attach profile info
            profileId: selectedProfileId || undefined,
            profileName: selectedProfile ? selectedProfile.name : undefined,
            profileColor: selectedProfile ? selectedProfile.color : undefined
        };

        // Validation
        if (!job.companyName || !job.positionTitle || !job.companyUrl || !job.jobDescription) {
            status.textContent = "Please fill required fields (*)";
            status.className = "error";
            // Highlight empty fields
            if (!job.companyName) document.getElementById('companyName').style.borderColor = "red";
            if (!job.positionTitle) document.getElementById('positionTitle').style.borderColor = "red";
            if (!job.companyUrl) document.getElementById('companyUrl').style.borderColor = "red";
            if (!job.jobDescription) document.getElementById('jobDescription').style.borderColor = "red";
            return;
        }

        btn.disabled = true;
        btn.textContent = "Adding to Queue...";
        status.textContent = "";

        try {
            const response = await fetch('https://final-destination-rose.vercel.app/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(job)
            });

            if (response.ok) {
                status.textContent = "Success! Job added.";
                status.className = "success";
                setTimeout(() => window.close(), 1500);
            } else {
                const err = await response.json();
                throw new Error(err.error || "Server error");
            }
        } catch (e) {
            console.error(e);
            status.textContent = "Error: " + e.message;
            status.className = "error";
            btn.disabled = false;
            btn.textContent = "Add to Queue";
        }
    });

    // Clear red borders on input
    document.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => {
            el.style.borderColor = "#d1d5db";
        });
    });
});

// This function runs in the context of the webpage
function scrapePage() {
    return {
        title: document.title,
        url: window.location.href,
        selection: window.getSelection().toString()
    };
}
