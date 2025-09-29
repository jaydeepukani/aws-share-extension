// background.js
chrome.runtime.onInstalled.addListener(() => {
	// set default options
	chrome.storage.sync.get(["composer"], (res) => {
		if (!res.composer) {
			chrome.storage.sync.set({
				composer: "gmail", // default: gmail, also supports outlook, yahoo, protonmail, etc.
			});
		}
	});

	// Show welcome notification
	chrome.notifications.create({
		type: "basic",
		iconUrl: "icons/icon48.png",
		title: "🚀 AWS Instance Share",
		message:
			"Extension installed! Click the extension icon to configure settings.",
	});
});

// Note: Extension icon click now opens popup automatically due to manifest.json action configuration
