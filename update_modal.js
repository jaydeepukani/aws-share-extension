const fs = require('fs');
let code = fs.readFileSync('content_script_common.js', 'utf8');

// 1. Add Refresh button to modal
const actionsHtml = `				<div class="aws-share-actions" style="flex-wrap: wrap;">
					<button class="aws-btn" style="background:#f0f0f0; color:#333; margin-right: auto;" id="btn-refresh" title="Force Refresh Data">
						<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
						Refresh Data
					</button>
					<button class="aws-btn aws-btn-copy" id="btn-copy">`;
code = code.replace(`				<div class="aws-share-actions" style="flex-wrap: wrap;">\n					<button class="aws-btn aws-btn-copy" id="btn-copy">`, actionsHtml);

// 2. Change showShareModal signature to accept onRefresh
code = code.replace(
    `window.awsExtension.showShareModal = function(details, accountInfo) {`, 
    `window.awsExtension.showShareModal = function(details, accountInfo, onRefresh) {`
);

// 3. Fix handleEmailShare to compute subject and not close popup, and add refresh handler
const oldHandlers = `		const handleEmailShare = (type) => {
			const body = generateText(false);
			const encSubject = encodeURIComponent(subject);
			const encBody = encodeURIComponent(body);
			let url = '';`;

const newHandlers = `		if (onRefresh) {
			overlay.querySelector('#btn-refresh').addEventListener('click', (e) => {
				e.preventDefault();
				closeModal();
				onRefresh();
			});
		} else {
			overlay.querySelector('#btn-refresh').style.display = 'none';
		}

		const handleEmailShare = (e, type) => {
			e.preventDefault();
			const body = generateText(false);
			
			// Compute subject
			let subject = \`🚀 AWS \${service} Instance Details\`;
			if (details.name && details.name !== details.instanceId) {
				subject = \`🚀 \${details.name} - AWS \${service} Instance\`;
			}
			const state = details.instanceState || details.state;
			if (state && state !== "N/A") {
				subject += \` [\${state.toUpperCase()}]\`;
			}

			const encSubject = encodeURIComponent(subject);
			const encBody = encodeURIComponent(body);
			let url = '';`;
code = code.replace(oldHandlers, newHandlers);

// 4. Update click handlers to pass event
code = code.replace(
    `overlay.querySelector('#btn-mail-default').addEventListener('click', () => handleEmailShare('default'));`,
    `overlay.querySelector('#btn-mail-default').addEventListener('click', (e) => handleEmailShare(e, 'default'));`
).replace(
    `overlay.querySelector('#btn-mail-gmail').addEventListener('click', () => handleEmailShare('gmail'));`,
    `overlay.querySelector('#btn-mail-gmail').addEventListener('click', (e) => handleEmailShare(e, 'gmail'));`
).replace(
    `overlay.querySelector('#btn-mail-outlook').addEventListener('click', () => handleEmailShare('outlook'));`,
    `overlay.querySelector('#btn-mail-outlook').addEventListener('click', (e) => handleEmailShare(e, 'outlook'));`
).replace(
    `overlay.querySelector('#btn-mail-office365').addEventListener('click', () => handleEmailShare('office365'));`,
    `overlay.querySelector('#btn-mail-office365').addEventListener('click', (e) => handleEmailShare(e, 'office365'));`
);

fs.writeFileSync('content_script_common.js', code);
console.log('Fixed modal');
