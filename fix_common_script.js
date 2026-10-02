const fs = require('fs');
let code = fs.readFileSync('content_script_common.js', 'utf8');

// 1. Add extra checkboxes, unchecked by default
const oldCheckboxes = `				<div class="aws-share-options">
					<label class="aws-share-option"><input type="checkbox" id="chk-account" checked> Account Info</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-overview" checked> Basic Overview</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-network" checked> Network & IPs</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-security" checked> Security & Firewall</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-storage" checked> Storage</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-hardware" checked> Hardware & OS</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-monitoring" checked> Monitoring & Status</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-tags" checked> Tags</label>
				</div>`;

const newCheckboxes = `				<div class="aws-share-options">
					<label class="aws-share-option"><input type="checkbox" id="chk-account" checked> Account Info</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-overview" checked> Basic Overview</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-network" checked> Network & IPs</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-security" checked> Security & Firewall</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-storage" checked> Storage</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-hardware" checked> Hardware & OS</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-monitoring" checked> Monitoring & Status</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-tags" checked> Tags</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-domains"> Domains & Detailed IP</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-snapshots"> Snapshots</label>
					<label class="aws-share-option"><input type="checkbox" id="chk-metrics"> History & Metrics</label>
				</div>`;
code = code.replace(oldCheckboxes, newCheckboxes);

// 2. Add logic to delete unchecked extra fields in generateText
const oldGenerateTextStart = `			if (!document.getElementById('chk-monitoring').checked) {
				delete filteredDetails.monitoring; delete filteredDetails.statusChecks;
			}`;
const newGenerateTextStart = `			if (!document.getElementById('chk-monitoring').checked) {
				delete filteredDetails.monitoring; delete filteredDetails.statusChecks;
			}
			if (!document.getElementById('chk-domains').checked) {
				delete filteredDetails.domains; delete filteredDetails.domainsStatus; delete filteredDetails.staticIpName; delete filteredDetails.isStaticIp;
			}
			if (!document.getElementById('chk-snapshots').checked) {
				delete filteredDetails.automaticSnapshots; delete filteredDetails.snapshots;
			}
			if (!document.getElementById('chk-metrics').checked) {
				delete filteredDetails.history; delete filteredDetails.metrics;
			}`;
code = code.replace(oldGenerateTextStart, newGenerateTextStart);

// 3. Fix Office 365 URL length issue in handleEmailShare
const oldOffice365 = `			} else if (type === 'office365') {
				url = \`https://outlook.office.com/mail/deeplink/compose?subject=\${encSubject}&body=\${encBody}\`;
				window.open(url, '_blank');`;

const newOffice365 = `			} else if (type === 'office365') {
				let safeBody = encBody;
				if (encBody.length > 1500) {
					try {
						navigator.clipboard.writeText(body);
						safeBody = encodeURIComponent("AWS details have been copied to your clipboard.\\n\\nPlease press Ctrl+V / Cmd+V to paste them here.");
						alert("Content is too long for Office 365.\\n\\nThe details have been automatically copied to your clipboard. Please paste (Ctrl+V) into the email body!");
					} catch(e) {}
				}
				url = \`https://outlook.office.com/mail/deeplink/compose?subject=\${encSubject}&body=\${safeBody}\`;
				window.open(url, '_blank');`;
code = code.replace(oldOffice365, newOffice365);

// 4. Update the formatters to actually print Domains and Snapshots if they exist
const tagSectionCode = `		// Tags Information
		if (
			details.tabsData?.tags?.tags &&
			Object.keys(details.tabsData.tags.tags).length > 0
		) {`;

const newSectionsCode = `		// Extra Options (Domains, Snapshots, Metrics)
		if (details.domains && details.domains.length > 0) {
			lines.push("");
			lines.push("🌐 DOMAINS & IP CONFIGURATION");
			lines.push("─────────────────────────────────────────────────────────────────");
			if (details.isStaticIp !== undefined) lines.push(\`📌 Static IP: \${details.isStaticIp ? "Yes" : "No"} (\${details.staticIpName || "N/A"})\`);
			lines.push(\`🔄 Domains Status: \${details.domainsStatus || "N/A"}\`);
			details.domains.forEach(d => {
				lines.push(\`   • \${d.domainName} (\${d.status || "N/A"})\`);
			});
		}

		if (details.snapshots && details.snapshots.length > 0) {
			lines.push("");
			lines.push("📸 SNAPSHOTS & BACKUPS");
			lines.push("─────────────────────────────────────────────────────────────────");
			lines.push(\`🔄 Auto Snapshots: \${details.automaticSnapshots || "N/A"}\`);
			details.snapshots.forEach(s => {
				lines.push(\`   • \${s.name} (\${s.createdAt || "N/A"})\`);
			});
		}
		
		if (details.history && details.history.length > 0) {
			lines.push("");
			lines.push("📈 HISTORY & METRICS");
			lines.push("─────────────────────────────────────────────────────────────────");
			details.history.forEach(h => {
				lines.push(\`   • \${h}\`);
			});
		}

		// Tags Information
		if (
			details.tabsData?.tags?.tags &&
			Object.keys(details.tabsData.tags.tags).length > 0
		) {`;
code = code.replace(tagSectionCode, newSectionsCode);

fs.writeFileSync('content_script_common.js', code);
console.log('Fixed common script features');
