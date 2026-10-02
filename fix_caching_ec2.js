const fs = require('fs');
let code = fs.readFileSync('content_script_ec2.js', 'utf8');

// 1. Add cache map at top
code = code.replace(
    '// Track which elements already have buttons\n\tconst elementsWithButtons = new WeakSet();',
    '// Track which elements already have buttons\n\tconst elementsWithButtons = new WeakSet();\n\n\t// Cache for instance details\n\tconst detailsCache = new Map();'
);

// 2. Modify handleShare to support caching
const oldHandleShareStart = `	async function handleShare(button) {
		const originalContent = button.innerHTML;`;

const newHandleShareStart = `	async function handleShare(button, forceRefresh = false) {
		const instanceId = getInstanceId();
		
		if (!forceRefresh && instanceId && detailsCache.has(instanceId)) {
			window.awsExtension.showShareModal(detailsCache.get(instanceId), extractAccountInfo(), () => handleShare(button, true));
			return;
		}

		const originalContent = button.innerHTML;`;

code = code.replace(oldHandleShareStart, newHandleShareStart);

// 3. Update modal call and cache setting in handleShare
const oldModalCall = `			let subject = "🚀 AWS EC2 Instance Details";
			if (details.name && details.name !== details.instanceId) {
				subject = \`🚀 \${details.name} - AWS EC2 Instance\`;
			}
			if (details.instanceState && details.instanceState !== "N/A") {
				subject += \` [\${details.instanceState.toUpperCase()}]\`;
			}
			window.awsExtension.showShareModal(details, accountInfo);`;

const newModalCall = `			if (instanceId) {
				detailsCache.set(instanceId, details);
			}
			window.awsExtension.showShareModal(details, accountInfo, () => handleShare(button, true));`;

code = code.replace(oldModalCall, newModalCall);

fs.writeFileSync('content_script_ec2.js', code);
console.log('Fixed EC2 caching');
