const fs = require('fs');

const modalCode = `
	// In-page Share Modal
	window.awsExtension.showShareModal = function(details, accountInfo) {
		const modalId = 'aws-share-modal-v1';
		const existingModal = document.getElementById(modalId);
		if (existingModal) existingModal.remove();

		const overlay = document.createElement('div');
		overlay.id = modalId;
		overlay.className = 'aws-share-overlay';
		
		const modal = document.createElement('div');
		modal.className = 'aws-share-modal';
		
		// Style definition
		const style = document.createElement('style');
		style.textContent = \`
			.aws-share-overlay {
				position: fixed; top: 0; left: 0; width: 100%; height: 100%;
				background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
				z-index: 999999; display: flex; align-items: center; justify-content: center;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
			}
			.aws-share-modal {
				background: #ffffff; width: 480px; max-width: 90%; max-height: 90vh;
				border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
				display: flex; flex-direction: column; overflow: hidden;
				color: #16191f;
			}
			.aws-share-header {
				padding: 20px 24px; border-bottom: 1px solid #eaeded;
				display: flex; justify-content: space-between; align-items: center;
				background: #f8f8f8;
			}
			.aws-share-header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #16191f; }
			.aws-share-close {
				background: none; border: none; font-size: 24px; line-height: 1; cursor: pointer;
				color: #545b64; padding: 0;
			}
			.aws-share-close:hover { color: #16191f; }
			.aws-share-body {
				padding: 24px; overflow-y: auto; flex: 1;
			}
			.aws-share-options {
				display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
			}
			.aws-share-option {
				display: flex; align-items: center; gap: 8px; font-size: 14px;
				cursor: pointer;
			}
			.aws-share-option input { cursor: pointer; width: 16px; height: 16px; accent-color: #ff9900; }
			.aws-share-footer {
				padding: 20px 24px; border-top: 1px solid #eaeded; background: #f8f8f8;
				display: flex; flex-direction: column; gap: 12px;
			}
			.aws-share-actions {
				display: flex; gap: 12px; justify-content: flex-end;
			}
			.aws-btn {
				padding: 8px 16px; border-radius: 4px; font-size: 14px; font-weight: 600;
				cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
				display: flex; align-items: center; gap: 6px; justify-content: center;
			}
			.aws-btn svg { width: 16px; height: 16px; fill: currentColor; }
			.aws-btn-mail {
				background: #ff9900; color: white;
			}
			.aws-btn-mail:hover { background: #e88b00; }
			.aws-btn-whatsapp {
				background: #25D366; color: white;
			}
			.aws-btn-whatsapp:hover { background: #22bf5b; }
			.aws-btn-copy {
				background: #ffffff; color: #545b64; border-color: #545b64;
			}
			.aws-btn-copy:hover { background: #f8f8f8; color: #16191f; }
			.aws-share-title-preview {
				margin-bottom: 16px; font-size: 13px; color: #545b64;
			}
			.aws-share-title-preview strong { color: #16191f; }
		\`;
		overlay.appendChild(style);

		const service = details.service === "lightsail" ? "Lightsail" : "EC2";
		
		modal.innerHTML = \`
			<div class="aws-share-header">
				<h2>Share \${service} Instance</h2>
				<button class="aws-share-close">&times;</button>
			</div>
			<div class="aws-share-body">
				<div class="aws-share-title-preview">
					<strong>Select details to include:</strong>
				</div>
				<div class="aws-share-options">
					<label class="aws-share-option"><input type="checkbox" id="chk-account" checked> Account Info</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-overview" checked> Basic Overview</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-network" checked> Network & IPs</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-security" checked> Security & Firewall</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-storage" checked> Storage</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-hardware" checked> Hardware & OS</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-monitoring" checked> Monitoring & Status</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-tags" checked> Tags</label>
				</div>
			</div>
			<div class="aws-share-footer">
				<div class="aws-share-actions" style="flex-wrap: wrap;">
					<button class="aws-btn aws-btn-copy" id="btn-copy">
						<svg viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>
						Copy Text
					</button>
					<button class="aws-btn aws-btn-whatsapp" id="btn-whatsapp">
						<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7 8.5 7 9.71C7 10.93 7.89 12.1 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 13.96C16.31 13.81 15.08 13.2 14.87 13.12C14.66 13.04 14.5 13 14.35 13.22C14.2 13.44 13.73 14.03 13.59 14.18C13.44 14.34 13.29 14.37 13.04 14.22C12.79 14.07 11.97 13.8 11 12.94C10.24 12.27 9.73 11.44 9.57 11.19C9.42 10.94 9.55 10.82 9.68 10.69C9.79 10.58 9.92 10.41 10.05 10.27C10.17 10.13 10.22 10.02 10.3 9.87C10.38 9.72 10.34 9.59 10.28 9.47C10.23 9.35 9.73 8.11 9.52 7.61C9.32 7.12 9.12 7.18 8.97 7.18C8.83 7.18 8.68 7.33 8.53 7.33Z"/></svg>
						WhatsApp
					</button>
					<button class="aws-btn aws-btn-mail" id="btn-mail">
						<svg viewBox="0 0 24 24"><path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4C2.89,20 2,19.1 2,18V6C2,4.89 2.89,4 4,4M12,11L20,6H4L12,11M4,18H20V8.39L12,13.39L4,8.39V18Z"/></svg>
						Email
					</button>
				</div>
			</div>
		\`;
		
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		// Event Listeners
		const closeModal = () => overlay.remove();
		overlay.querySelector('.aws-share-close').addEventListener('click', closeModal);
		overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });

		const generateText = (compact) => {
			const filteredDetails = JSON.parse(JSON.stringify(details));
			const filteredAccount = document.getElementById('chk-account').checked ? accountInfo : {};
			
			if (!document.getElementById('chk-overview').checked) {
				delete filteredDetails.name; delete filteredDetails.instanceId; delete filteredDetails.instanceType; delete filteredDetails.bundle; delete filteredDetails.state; delete filteredDetails.instanceState;
			}
			if (!document.getElementById('chk-network').checked) {
				delete filteredDetails.publicIpv4; delete filteredDetails.privateIpv4; delete filteredDetails.publicIpv6; delete filteredDetails.privateIpv6; delete filteredDetails.vpcId;
				if(filteredDetails.tabsData) delete filteredDetails.tabsData.networking;
			}
			if (!document.getElementById('chk-security').checked) {
				delete filteredDetails.securityGroups; delete filteredDetails.firewallDetails; delete filteredDetails.firewallRules;
			}
			if (!document.getElementById('chk-storage').checked) {
				delete filteredDetails.storage; delete filteredDetails.ebs; delete filteredDetails.systemDiskSize; delete filteredDetails.rootDevice;
				if(filteredDetails.tabsData) delete filteredDetails.tabsData.storage;
			}
			if (!document.getElementById('chk-hardware').checked) {
				delete filteredDetails.os; delete filteredDetails.osVersion; delete filteredDetails.amiId; delete filteredDetails.amiName; delete filteredDetails.cpuCoreCount; delete filteredDetails.blueprint;
			}
			if (!document.getElementById('chk-monitoring').checked) {
				delete filteredDetails.monitoring; delete filteredDetails.statusChecks;
			}
			if (!document.getElementById('chk-tags').checked) {
				if(filteredDetails.tabsData) delete filteredDetails.tabsData.tags;
			}

			return window.awsExtension.buildEmailBody(filteredDetails, filteredAccount, compact);
		};

		const getSubject = () => {
			let subject = \`🚀 AWS \${service} Instance Details\`;
			if (details.name && details.name !== details.instanceId) subject = \`🚀 \${details.name} - AWS \${service} Instance\`;
			const state = details.state || details.instanceState;
			if (state && state !== "N/A") subject += \` [\${state.toUpperCase()}]\`;
			return subject;
		};

		document.getElementById('btn-copy').addEventListener('click', () => {
			const text = generateText(false);
			navigator.clipboard.writeText(text).then(() => {
				const btn = document.getElementById('btn-copy');
				const orig = btn.innerHTML;
				btn.innerHTML = '✅ Copied!';
				setTimeout(() => btn.innerHTML = orig, 2000);
			});
		});

		document.getElementById('btn-whatsapp').addEventListener('click', () => {
			const text = getSubject() + "\\n" + generateText(true);
			window.open(\`https://api.whatsapp.com/send?text=\${encodeURIComponent(text)}\`, '_blank');
			closeModal();
		});

		document.getElementById('btn-mail').addEventListener('click', () => {
			const subject = getSubject();
			const body = generateText(true);
			window.open(\`mailto:?subject=\${encodeURIComponent(subject)}&body=\${encodeURIComponent(body)}\`, '_blank');
			closeModal();
		});
	};
`;

fs.appendFileSync('content_script_common.js', modalCode);
