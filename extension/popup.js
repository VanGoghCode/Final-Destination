document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("profileContainer");
  const addBtn = document.getElementById("addBtn");
  const statusEl = document.getElementById("status");
  const companyNameInput = document.getElementById("companyName");
  const positionTitleInput = document.getElementById("positionTitle");
  const companyUrlInput = document.getElementById("companyUrl");
  const jobUrlInput = document.getElementById("jobUrl");
  const jobDescriptionInput = document.getElementById("jobDescription");
  const profileIdInput = document.getElementById("profileId");
  const serverUrlInput = document.getElementById("serverUrl");
  const connectionDot = document.getElementById("connectionDot");
  const openBatchBtn = document.getElementById("openBatchBtn");
  const copyBtn = document.getElementById("copyBtn");
  const pasteBtn = document.getElementById("pasteBtn");

  let statusTimeout = null;

  if (!container || !addBtn) {
    console.error("Required elements not found");
    return;
  }

  const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const CLIPBOARD_STORAGE_KEY = "fd_clipboard";
  const SERVER_URL_KEY = "fd_server_url";

  // ======== Server URL Management ========

  function getBaseUrl() {
    const custom = serverUrlInput?.value?.trim().replace(/\/+$/, "");
    if (custom) return custom;
    // Default: try localhost (most common for extension dev)
    return "http://localhost:3000";
  }

  async function checkConnection() {
    const base = getBaseUrl();
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        connectionDot.className = "dot online";
        return true;
      }
    } catch {}
    connectionDot.className = "dot offline";
    return false;
  }

  // Load saved server URL
  if (hasStorage && serverUrlInput) {
    try {
      const result = await chrome.storage.local.get(SERVER_URL_KEY);
      if (result[SERVER_URL_KEY]) {
        serverUrlInput.value = result[SERVER_URL_KEY];
      }
    } catch {}
  }

  // Save server URL on change
  if (serverUrlInput) {
    serverUrlInput.addEventListener("input", () => {
      if (hasStorage) {
        chrome.storage.local.set({ [SERVER_URL_KEY]: serverUrlInput.value.trim() });
      }
      checkConnection();
    });
  }

  // Check connection on load
  checkConnection();

  // ======== Copy/Paste ========

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const data = {
        companyName: companyNameInput.value.trim(),
        companyUrl: companyUrlInput.value.trim(),
      };
      if (!data.companyName && !data.companyUrl) {
        statusEl.textContent = "Nothing to copy";
        statusEl.className = "error";
        clearTimeout(statusTimeout);
        statusTimeout = setTimeout(() => {
          statusEl.textContent = "";
          statusEl.className = "";
        }, 1500);
        return;
      }
      if (hasStorage) {
        try {
          await chrome.storage.local.set({ [CLIPBOARD_STORAGE_KEY]: data });
          copyBtn.classList.add("success");
          statusEl.textContent = "✓ Copied!";
          statusEl.className = "success";
          clearTimeout(statusTimeout);
          statusTimeout = setTimeout(() => {
            copyBtn.classList.remove("success");
            statusEl.textContent = "";
            statusEl.className = "";
          }, 1500);
        } catch {
          statusEl.textContent = "Copy failed";
          statusEl.className = "error";
        }
      }
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener("click", async () => {
      if (hasStorage) {
        try {
          const result = await chrome.storage.local.get(CLIPBOARD_STORAGE_KEY);
          const data = result[CLIPBOARD_STORAGE_KEY];
          if (data) {
            if (data.companyName) companyNameInput.value = data.companyName;
            if (data.companyUrl) companyUrlInput.value = data.companyUrl;
            saveFormData();
            pasteBtn.classList.add("success");
            statusEl.textContent = "✓ Pasted!";
            statusEl.className = "success";
            clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
              pasteBtn.classList.remove("success");
              statusEl.textContent = "";
              statusEl.className = "";
            }, 1500);
          } else {
            statusEl.textContent = "Nothing to paste";
            statusEl.className = "warning";
            clearTimeout(statusTimeout);
            statusTimeout = setTimeout(() => {
              statusEl.textContent = "";
              statusEl.className = "";
            }, 1500);
          }
        } catch {
          statusEl.textContent = "Paste failed";
          statusEl.className = "error";
        }
      }
    });
  }

  // ======== Tab Info ========

  let tab = null;
  try {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = currentTab;
    }
  } catch {}

  const tabUrl = tab?.url || "default";
  const storageKey = `form_data_${btoa(unescape(encodeURIComponent(tabUrl))).slice(0, 50)}`;

  // ======== Restore Saved Form Data ========

  if (hasStorage) {
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
        if (savedData.includeCoverLetter !== undefined) {
          document.getElementById("includeCoverLetter").checked = savedData.includeCoverLetter;
        }
        statusEl.textContent = "Restored saved data";
        statusEl.className = "";
      }
    } catch {}
  }

  // Set job URL from tab
  if (!jobUrlInput.value && tab?.url) {
    jobUrlInput.value = tab.url;
  }

  // Auto-extract position title from tab title
  if (!positionTitleInput.value && tab?.title) {
    let title = tab.title;
    title = title.replace(
      /\s*[-|·•]\s*(LinkedIn|Indeed|Glassdoor|ZipRecruiter|Monster|Dice|Hired|AngelList|Wellfound|Lever|Greenhouse|Workday|Careers|Jobs).*$/i,
      "",
    );
    title = title.replace(/\s*[-|·•]\s*(Apply|Application|Job Posting|Job Description).*$/i, "");
    positionTitleInput.value = title.trim();
  }

  // ======== Company Website Extraction ========

  const extractCompanyWebsite = (jobUrl) => {
    try {
      const url = new URL(jobUrl);
      const hostname = url.hostname.toLowerCase();

      const atsPatterns = [
        { domain: "greenhouse.io", pathPattern: /^\/([^/]+)/ },
        { domain: "lever.co", pathPattern: /^\/([^/]+)/ },
        { domain: "ashbyhq.com", pathPattern: /^\/([^/]+)/ },
        { domain: "jobs.lever.co", subdomainCompany: true },
        { domain: "boards.greenhouse.io", pathPattern: /^\/([^/]+)/ },
        { domain: "myworkdayjobs.com", subdomainCompany: true },
      ];

      for (const pattern of atsPatterns) {
        if (hostname.includes(pattern.domain)) {
          if (pattern.subdomainCompany) {
            const subdomain = hostname.split(".")[0];
            if (
              subdomain &&
              subdomain !== "www" &&
              subdomain !== "jobs" &&
              subdomain !== "careers"
            ) {
              return `https://www.${subdomain}.com`;
            }
          } else if (pattern.pathPattern) {
            const match = url.pathname.match(pattern.pathPattern);
            if (match && match[1]) {
              return `https://www.${match[1]}.com`;
            }
          }
        }
      }

      const jobBoards = [
        "linkedin.com",
        "indeed.com",
        "glassdoor.com",
        "ziprecruiter.com",
        "monster.com",
        "dice.com",
      ];
      if (jobBoards.some((board) => hostname.includes(board))) {
        return "";
      }

      const cleanHostname = hostname.replace(
        /^(www\.|careers\.|jobs\.|apply\.|hire\.|recruiting\.)/,
        "",
      );
      return `https://www.${cleanHostname}`;
    } catch {
      return "";
    }
  };

  // ======== Save Form Data ========

  const saveFormData = () => {
    if (!hasStorage) return;
    const data = {
      companyName: companyNameInput.value,
      positionTitle: positionTitleInput.value,
      companyUrl: companyUrlInput.value,
      jobUrl: jobUrlInput.value,
      jobDescription: jobDescriptionInput.value,
      profileId: profileIdInput.value,
      includeCoverLetter: document.getElementById("includeCoverLetter").checked,
    };
    chrome.storage.local.set({ [storageKey]: data }).catch(() => {});
  };

  document.querySelectorAll("input, textarea, input[type='checkbox']").forEach((el) => {
    const eventType = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(eventType, () => {
      if (el.type !== "checkbox") el.style.borderColor = "#E5E5E5";
      saveFormData();
    });
  });

  // ======== Load Profiles ========

  let profiles = [];

  const loadProfiles = async () => {
    const base = getBaseUrl();
    container.innerHTML = '<span style="font-size:11px;color:#999;">Loading profiles...</span>';

    try {
      const res = await fetch(`${base}/api/profiles`);
      if (res.ok) {
        profiles = await res.json();
        container.innerHTML = "";

        if (profiles.length > 0) {
          const savedProfileId = profileIdInput.value;

          profiles.forEach((p) => {
            const item = document.createElement("div");
            const isSelected = savedProfileId === p.id;
            item.className = "profile" + (isSelected ? " selected" : "");
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

            const dot = document.createElement("div");
            dot.className = "dot";
            dot.style.background = bg;
            dot.textContent = p.avatarText || (p.firstName ? p.firstName[0] : "?");

            const name = document.createElement("span");
            name.textContent = p.name;

            item.appendChild(dot);
            item.appendChild(name);
            container.appendChild(item);
          });
        } else {
          container.innerHTML =
            '<span style="font-size:11px;color:#666;">No profiles — create one in the app first</span>';
        }
      } else {
        container.innerHTML = '<span style="font-size:11px;color:#999;">Server unreachable</span>';
      }
    } catch {
      container.innerHTML =
        '<span style="font-size:11px;color:#999;">Offline — check server URL</span>';
    }
  };

  const updateSelection = (id) => {
    profileIdInput.value = id;
    document.querySelectorAll(".profile").forEach((item) => {
      if (item.dataset.id === id) item.classList.add("selected");
      else item.classList.remove("selected");
    });
    container.style.borderColor = "";
    saveFormData();
  };

  await loadProfiles();

  // ======== Auto-extract from URL ========

  const isInternalUrl = (url) => {
    if (!url) return true;
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("extension://") ||
      url.startsWith("about:")
    );
  };

  const hasScripting = typeof chrome !== "undefined" && chrome.scripting;

  // Try to extract company from page content first
  if (!companyNameInput.value && tab?.id && tab?.url && !isInternalUrl(tab.url) && hasScripting) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const meta =
            document.querySelector('meta[property="og:site_name"]') ||
            document.querySelector('meta[name="application-name"]');
          const ld = document.querySelector('script[type="application/ld+json"]');
          if (ld) {
            try {
              const p = JSON.parse(ld.textContent);
              if (p.name) return p.name;
              if (p.publisher?.name) return p.publisher.name;
            } catch {}
          }
          return meta?.content || "";
        },
      });
      if (results && results[0]?.result) {
        companyNameInput.value = results[0].result;
        saveFormData();
      }
    } catch {}
  }

  if (!companyNameInput.value || !companyUrlInput.value) {
    try {
      const jobUrl = tab?.url || "";
      const hostname = new URL(jobUrl).hostname;
      const parts = hostname.replace(/^(www\.|careers\.|jobs\.|apply\.|hire\.)/, "").split(".");
      if (parts.length >= 1) {
        const main = parts[0];
        if (!companyNameInput.value) {
          companyNameInput.value = main.charAt(0).toUpperCase() + main.slice(1);
          saveFormData();
        }
        if (!companyUrlInput.value) {
          const extractedWebsite = extractCompanyWebsite(jobUrl);
          if (extractedWebsite) {
            companyUrlInput.value = extractedWebsite;
          } else {
            companyUrlInput.value = `https://www.${parts.join(".")}`;
          }
          saveFormData();
        }
      }
    } catch {}
  }

  // ======== Extract text selection from page ========

  if (
    !jobDescriptionInput.value &&
    tab?.id &&
    tab?.url &&
    !isInternalUrl(tab.url) &&
    hasScripting
  ) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString() || "",
      });
      if (results && results[0]?.result) {
        jobDescriptionInput.value = results[0].result;
        saveFormData();
      }
    } catch {}
  }

  // ======== Open Batch Mode ========

  if (openBatchBtn) {
    openBatchBtn.addEventListener("click", () => {
      const base = getBaseUrl();
      window.open(`${base}/batch`, "_blank");
    });
  }

  // ======== Add to Queue ========

  addBtn.addEventListener("click", async () => {
    const selectedProfileId = profileIdInput.value;
    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

    const job = {
      companyName: companyNameInput.value.trim(),
      positionTitle: positionTitleInput.value.trim(),
      companyUrl: jobUrlInput.value.trim(),
      jobDescription: jobDescriptionInput.value.trim(),
      personalDetails: document.getElementById("personalDetails")?.value?.trim() || "",
      profileId: selectedProfileId || undefined,
      profileName: selectedProfile ? selectedProfile.name : undefined,
      profileColor: selectedProfile ? selectedProfile.color : undefined,
      companyWebsite: companyUrlInput.value.trim(),
      includeCoverLetter: document.getElementById("includeCoverLetter").checked,
    };

    let hasErrors = false;
    statusEl.textContent = "";
    statusEl.className = "";

    companyNameInput.style.borderColor = "#E5E5E5";
    positionTitleInput.style.borderColor = "#E5E5E5";
    jobUrlInput.style.borderColor = "#E5E5E5";
    jobDescriptionInput.style.borderColor = "#E5E5E5";
    container.style.border = "";

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

    const base = getBaseUrl();

    try {
      const response = await fetch(`${base}/api/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });

      if (response.ok) {
        if (hasStorage) {
          await chrome.storage.local.remove(storageKey);
        }
        statusEl.textContent = "✓ Added to queue!";
        statusEl.className = "success";
        clearTimeout(statusTimeout);
        setTimeout(() => window.close(), 1200);
      } else {
        const err = await response.json();
        throw new Error(err.error || "Server error");
      }
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Error: " + (e.message || "Connection failed");
      statusEl.className = "error";
      addBtn.disabled = false;
      addBtn.textContent = "Add to Queue";
    }
  });
});
