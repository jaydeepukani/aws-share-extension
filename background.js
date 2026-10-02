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


});

// Note: Extension icon click now opens popup automatically due to manifest.json action configuration
