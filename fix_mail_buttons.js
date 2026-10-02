const fs = require('fs');
let code = fs.readFileSync('content_script_common.js', 'utf8');

const oldActions = `					<button class="aws-btn aws-btn-mail" id="btn-mail">
						<svg viewBox="0 0 24 24"><path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4M12,11L20,6H4L12,11M4,18H20V8.39L12,13.39L4,8.39V18Z"/></svg>
						Email
					</button>`;

const newActions = `					<button class="aws-btn aws-btn-mail" id="btn-mail-default" title="Open Default Mail App">
						<svg viewBox="0 0 24 24"><path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4M12,11L20,6H4L12,11M4,18H20V8.39L12,13.39L4,8.39V18Z"/></svg>
						Default Email
					</button>
					<button class="aws-btn" style="background:#ea4335; color:white;" id="btn-mail-gmail" title="Share via Gmail">
						<svg viewBox="0 0 24 24"><path d="M20,18H18V9.25L12,13L6,9.25V18H4V6H5.2L12,10.25L18.8,6H20V18Z"/></svg>
						Gmail
					</button>
					<button class="aws-btn" style="background:#0078d4; color:white;" id="btn-mail-outlook" title="Share via Outlook Personal">
						<svg viewBox="0 0 24 24"><path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6M20 6L12 11L4 6H20M20 18H4V8L12 13L20 8V18Z"/></svg>
						Outlook
					</button>
					<button class="aws-btn" style="background:#d83b01; color:white;" id="btn-mail-office365" title="Share via Office 365">
						<svg viewBox="0 0 24 24"><path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6M20 6L12 11L4 6H20M20 18H4V8L12 13L20 8V18Z"/></svg>
						Office 365
					</button>`;

code = code.replace(oldActions, newActions);

const oldEventHandlers = `		overlay.querySelector('#btn-mail').addEventListener('click', () => {
			const body = generateText(false);
			const mailtoUrl = \`mailto:?subject=\${encodeURIComponent(subject)}&body=\${encodeURIComponent(body)}\`;
			window.location.href = mailtoUrl;
		});`;

const newEventHandlers = `		const handleEmailShare = (type) => {
			const body = generateText(false);
			const encSubject = encodeURIComponent(subject);
			const encBody = encodeURIComponent(body);
			let url = '';
			if (type === 'gmail') {
				url = \`https://mail.google.com/mail/?view=cm&fs=1&su=\${encSubject}&body=\${encBody}\`;
				window.open(url, '_blank');
			} else if (type === 'outlook') {
				url = \`https://outlook.live.com/mail/0/deeplink/compose?subject=\${encSubject}&body=\${encBody}\`;
				window.open(url, '_blank');
			} else if (type === 'office365') {
				url = \`https://outlook.office.com/mail/deeplink/compose?subject=\${encSubject}&body=\${encBody}\`;
				window.open(url, '_blank');
			} else {
				url = \`mailto:?subject=\${encSubject}&body=\${encBody}\`;
				window.location.href = url;
			}
		};

		overlay.querySelector('#btn-mail-default').addEventListener('click', () => handleEmailShare('default'));
		overlay.querySelector('#btn-mail-gmail').addEventListener('click', () => handleEmailShare('gmail'));
		overlay.querySelector('#btn-mail-outlook').addEventListener('click', () => handleEmailShare('outlook'));
		overlay.querySelector('#btn-mail-office365').addEventListener('click', () => handleEmailShare('office365'));`;

code = code.replace(oldEventHandlers, newEventHandlers);

fs.writeFileSync('content_script_common.js', code);
console.log('Fixed mail buttons');
