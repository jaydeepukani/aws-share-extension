console.log("CONTENT SCRIPT COMMON LOADED");
// content_script_common.js - Shared utilities for AWS extension
(() => {
	const BUTTON_CLASS = "aws-share-button-v1";

	// Create shared CSS
	const styleId = "aws-share-style";
	if (!document.getElementById(styleId)) {
		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
      .${BUTTON_CLASS} {
        background: linear-gradient(135deg, #FF9500, #FF6B35);
        color: white;
        border: none;
        padding: 6px 12px;
        margin-left: 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(255, 149, 0, 0.3);
      }
      .${BUTTON_CLASS}:hover { 
        background: linear-gradient(135deg, #E8850A, #E55B2B);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(255, 149, 0, 0.4);
      }
      .${BUTTON_CLASS}:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(255, 149, 0, 0.3);
      }
      .aws-share-icon {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .aws-harvest-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .aws-harvest-content {
        background: white;
        padding: 30px;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }
      .aws-harvest-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #FF9500;
        border-radius: 50%;
        animation: aws-spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes aws-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .aws-harvest-progress {
        margin-top: 15px;
        font-size: 12px;
        color: #666;
      }
    `;
		document.head.appendChild(style);
	}

	// Global state for extension
	window.awsExtension = window.awsExtension || {};
	window.awsExtension.BUTTON_CLASS = BUTTON_CLASS;

	// Utility functions
	window.awsExtension.safeText = function (el) {
		return el ? el.textContent.trim() : "";
	};

	// Enhanced IP extraction with IPv6 support
	window.awsExtension.extractIPs = function (text) {
		const ips = {
			publicIpv4: "",
			privateIpv4: "",
			publicIpv6: "",
			privateIpv6: "",
		};

		// IPv4 patterns
		const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
		const ipv4Matches = text.match(ipv4Regex) || [];

		ipv4Matches.forEach((ip) => {
			if (
				ip.startsWith("10.") ||
				ip.startsWith("172.") ||
				ip.startsWith("192.168.")
			) {
				if (!ips.privateIpv4) ips.privateIpv4 = ip;
			} else if (!ip.startsWith("127.") && !ip.startsWith("169.254.")) {
				if (!ips.publicIpv4) ips.publicIpv4 = ip;
			}
		});

		// IPv6 patterns - enhanced detection
		const ipv6Patterns = [
			// Full IPv6 addresses
			/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi,
			// Compressed IPv6 addresses
			/\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}\b/gi,
			// IPv6 with double colon
			/\b(?:[0-9a-f]{1,4}:){0,6}::(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}\b/gi,
			// IPv6 loopback and other special addresses
			/\b::1\b/gi,
			/\b::\b/gi,
		];

		ipv6Patterns.forEach((pattern) => {
			const matches = text.match(pattern) || [];
			matches.forEach((ipv6) => {
				const cleanIpv6 = ipv6.toLowerCase();

				// Skip loopback and local addresses
				if (cleanIpv6 === "::1" || cleanIpv6 === "::") return;

				// Check if it's a private/local IPv6 address
				if (
					cleanIpv6.startsWith("fe80:") || // Link-local
					cleanIpv6.startsWith("fc00:") || // Unique local
					cleanIpv6.startsWith("fd00:")
				) {
					// Unique local
					if (!ips.privateIpv6) ips.privateIpv6 = ipv6;
				} else {
					// Public IPv6
					if (!ips.publicIpv6) ips.publicIpv6 = ipv6;
				}
			});
		});

		return ips;
	};

	// Create a button node
	window.awsExtension.makeButton = function () {
		const btn = document.createElement("button");
		btn.className = BUTTON_CLASS;
		btn.innerHTML = `
      <svg class="aws-share-icon" viewBox="0 0 24 24">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
      </svg>
      Share
    `;
		btn.title = "Share AWS instance details via email";
		return btn;
	};

	// Extract account information from AWS session data meta tag
	window.awsExtension.extractAccountInfo = function () {
		const accountInfo = {};

		try {
			// Both EC2 and Lightsail use this meta tag
			const sessionDataMeta = document.querySelector(
				'meta[name="awsc-session-data"]',
			);
			if (sessionDataMeta) {
				const sessionData = JSON.parse(
					sessionDataMeta.getAttribute("content"),
				);

				if (sessionData.accountId) {
					accountInfo.id = sessionData.accountId;
				}
				if (sessionData.displayName) {
					accountInfo.name = decodeURIComponent(
						sessionData.displayName,
					);
				}
				if (sessionData.infrastructureRegion) {
					accountInfo.region = sessionData.infrastructureRegion;
				}
			}
		} catch (e) {
			// Fallback to DOM selectors if session data parsing fails
			const accountSelectors = [
				"#awsc-username-menu",
				'[data-testid="aws-account-id"]',
			];

			for (const selector of accountSelectors) {
				const accountEl = document.querySelector(selector);
				if (accountEl && accountEl.textContent.trim()) {
					const accountText = accountEl.textContent.trim();
					const accountIdMatch = accountText.match(/(\d{12})/);
					if (accountIdMatch) {
						accountInfo.id = accountIdMatch[0];
					}
				}
			}
		}

		return accountInfo;
	};

	// Extract region information consistently for both services
	window.awsExtension.extractRegionInfo = function () {
		// Try session data first
		const accountInfo = window.awsExtension.extractAccountInfo();
		if (accountInfo.region) {
			return accountInfo.region;
		}

		// Fallback to URL
		const urlRegion =
			window.location.href.match(/region=([^&]+)/) ||
			window.location.pathname.match(/\/([a-z]{2}-[a-z]+-\d)\//);
		return urlRegion ? urlRegion[1] : "";
	};

	// Separator line - short version for compact email (URL safe)
	const SEPARATOR_SHORT = "────────────────────────────────";
	// Separator line - full version for clipboard
	const SEPARATOR_FULL =
		"─────────────────────────────────────────────────────────────────";

	// Build formatted email body with comprehensive field support
	// compact: true = shorter format for URL (avoid 400 errors), false = full format for clipboard
	window.awsExtension.buildEmailBody = function (
		details,
		accountInfo = {},
		compact = false,
	) {
		const lines = [];
		const timestamp = new Date().toLocaleString();
		const service = details.service || "unknown";
		const serviceDisplayName =
			service === "lightsail" ? "Lightsail" : "EC2";
		const SEP = compact ? SEPARATOR_SHORT : SEPARATOR_FULL;

		// Helper to check if value is valid
		const isValid = (val) =>
			val && val !== "N/A" && val !== "–" && val !== "-";

		// Account Information
		lines.push("");
		lines.push("🏢 ACCOUNT INFORMATION");
		lines.push(SEP);
		if (accountInfo.id) lines.push(`🆔 Account ID: ${accountInfo.id}`);
		if (accountInfo.name)
			lines.push(`📊 Account Name: ${accountInfo.name}`);
		if (service === "lightsail") {
			const region = details.region || accountInfo.region;
			if (region) lines.push(`🌍 Region: ${region}`);
		}
		lines.push(`🌐 Service: AWS ${serviceDisplayName}`);
		lines.push("");

		// Instance Basic Details
		lines.push("");
		lines.push(`💻 ${serviceDisplayName.toUpperCase()} INSTANCE OVERVIEW`);
		lines.push(SEP);

		if (service === "lightsail") {
			if (isValid(details.name))
				lines.push(`📝 Instance Name: ${details.name}`);
			if (isValid(details.bundle))
				lines.push(`💰 Bundle: ${details.bundle}`);
			if (isValid(details.instanceType))
				lines.push(`🖥️ Instance Type: ${details.instanceType}`);
			if (isValid(details.ram)) lines.push(`🧠 RAM: ${details.ram}`);
			if (isValid(details.vcpus))
				lines.push(`⚙️ vCPUs: ${details.vcpus}`);
			if (isValid(details.networkingType))
				lines.push(`🌐 Networking Type: ${details.networkingType}`);
			if (isValid(details.transferAllowance))
				lines.push(`📡 Transfer: ${details.transferAllowance}`);
			if (isValid(details.createdAt))
				lines.push(`📅 Created: ${details.createdAt}`);
			if (isValid(details.supportCode))
				lines.push(`🆘 Support Code: ${details.supportCode}`);
		} else {
			if (isValid(details.instanceId))
				lines.push(`🔖 Instance ID: ${details.instanceId}`);
			if (isValid(details.instanceArn))
				lines.push(`📎 Instance ARN: ${details.instanceArn}`);
			if (isValid(details.name) && details.name !== details.instanceId)
				lines.push(`📝 Name: ${details.name}`);
			if (isValid(details.instanceType))
				lines.push(`⚙️ Instance Type: ${details.instanceType}`);
			if (isValid(details.lifecycle))
				lines.push(`🔄 Lifecycle: ${details.lifecycle}`);
			if (isValid(details.launchTime))
				lines.push(`📅 Launch Time: ${details.launchTime}`);
			if (isValid(details.ownerId))
				lines.push(`👤 Owner ID: ${details.ownerId}`);
			if (isValid(details.managed))
				lines.push(`🔧 Managed: ${details.managed}`);
			if (isValid(details.operator))
				lines.push(`⚙️ Operator: ${details.operator}`);
		}

		const state = details.state || details.instanceState;
		if (isValid(state)) lines.push(`🔄 State: ${state.toUpperCase()}`);
		if (isValid(details.availabilityZone))
			lines.push(`📍 Availability Zone: ${details.availabilityZone}`);

		if (service === "ec2") {
			const region = details.region || accountInfo.region;
			if (region) lines.push(`🌍 Region: ${region}`);
			if (isValid(details.tenancy))
				lines.push(`🏠 Tenancy: ${details.tenancy}`);
			if (isValid(details.placementGroup))
				lines.push(`📦 Placement Group: ${details.placementGroup}`);
		}
		lines.push("");

		// AMI / Blueprint Information (EC2)
		if (
			service === "ec2" &&
			(isValid(details.amiId) || isValid(details.amiName))
		) {
			lines.push("");
			lines.push("🖼️ AMI INFORMATION");
			lines.push(SEP);
			if (isValid(details.amiId))
				lines.push(`🆔 AMI ID: ${details.amiId}`);
			if (isValid(details.amiName))
				lines.push(`📝 AMI Name: ${details.amiName}`);
			if (isValid(details.amiLocation))
				lines.push(`📍 AMI Location: ${details.amiLocation}`);
			if (isValid(details.platform))
				lines.push(`💻 Platform: ${details.platform}`);
			if (isValid(details.platformDetails))
				lines.push(`📋 Platform Details: ${details.platformDetails}`);
			if (isValid(details.architecture))
				lines.push(`🏗️ Architecture: ${details.architecture}`);
			if (isValid(details.virtualizationType))
				lines.push(`🔧 Virtualization: ${details.virtualizationType}`);
			if (isValid(details.bootMode))
				lines.push(`🚀 Boot Mode: ${details.bootMode}`);
			lines.push("");
		}

		// Operating System
		if (
			isValid(details.os) ||
			isValid(details.osVersion) ||
			isValid(details.blueprint)
		) {
			lines.push("");
			lines.push("🖥️ OPERATING SYSTEM");
			lines.push(SEP);
			if (service === "lightsail") {
				if (isValid(details.blueprint))
					lines.push(`💿 Blueprint: ${details.blueprint}`);
				if (isValid(details.os) && details.os !== details.blueprint)
					lines.push(`🏷️ OS: ${details.os}`);
				if (isValid(details.osVersion))
					lines.push(`📦 Version: ${details.osVersion}`);
			} else {
				if (isValid(details.os) && isValid(details.osVersion)) {
					lines.push(`💿 OS: ${details.os} ${details.osVersion}`);
				} else if (isValid(details.os)) {
					lines.push(`💿 OS: ${details.os}`);
				} else if (isValid(details.osVersion)) {
					lines.push(`💿 OS Version: ${details.osVersion}`);
				}
			}
			lines.push("");
		}

		// CPU & Hardware (EC2)
		if (
			service === "ec2" &&
			(isValid(details.cpuCoreCount) ||
				isValid(details.cpuThreadsPerCore) ||
				isValid(details.cpuOptions))
		) {
			lines.push("");
			lines.push("🔧 CPU & HARDWARE");
			lines.push(SEP);
			if (isValid(details.cpuCoreCount))
				lines.push(`💪 CPU Cores: ${details.cpuCoreCount}`);
			if (isValid(details.cpuThreadsPerCore))
				lines.push(`🧵 Threads/Core: ${details.cpuThreadsPerCore}`);
			if (isValid(details.cpuOptions))
				lines.push(`⚙️ CPU Options: ${details.cpuOptions}`);
			if (isValid(details.creditSpecification))
				lines.push(`💳 Credit Spec: ${details.creditSpecification}`);
			if (isValid(details.nitroEnclave))
				lines.push(`🔒 Nitro Enclave: ${details.nitroEnclave}`);
			if (isValid(details.hibernation))
				lines.push(`💤 Hibernation: ${details.hibernation}`);
			if (isValid(details.elasticGpuId))
				lines.push(`🎮 Elastic GPU: ${details.elasticGpuId}`);
			if (isValid(details.elasticInferenceAccelerator))
				lines.push(
					`🧠 Elastic Inference: ${details.elasticInferenceAccelerator}`,
				);
			lines.push("");
		}

		// Storage Configuration
		if (
			isValid(details.storage) ||
			details.tabsData?.storage ||
			isValid(details.rootDevice) ||
			isValid(details.ebs) ||
			isValid(details.systemDiskSize)
		) {
			lines.push("");
			lines.push("💾 STORAGE CONFIGURATION");
			lines.push(SEP);

			if (service === "lightsail") {
				if (isValid(details.systemDiskSize))
					lines.push(`📦 System Disk: ${details.systemDiskSize}`);
				if (isValid(details.systemDiskPath))
					lines.push(`📂 Mount Path: ${details.systemDiskPath}`);
				if (isValid(details.storage))
					lines.push(`💽 Storage: ${details.storage}`);
				if (
					isValid(details.totalStorageGiB) &&
					details.totalStorageGiB > 0
				) {
					lines.push(
						`📊 Total Storage: ${details.totalStorageGiB} GiB`,
					);
				}
				if (isValid(details.automaticSnapshots))
					lines.push(
						`📸 Auto Snapshots: ${details.automaticSnapshots}`,
					);
				if (
					details.additionalDisks &&
					details.additionalDisks.length > 0
				) {
					lines.push(
						`📚 Additional Disks: ${details.additionalDisks.length} attached`,
					);
				}
			} else {
				if (isValid(details.rootDevice))
					lines.push(`📱 Root Device: ${details.rootDevice}`);
				if (isValid(details.rootDeviceName))
					lines.push(
						`📂 Root Device Name: ${details.rootDeviceName}`,
					);
				if (isValid(details.rootDeviceType))
					lines.push(
						`💽 Root Device Type: ${details.rootDeviceType}`,
					);
				if (isValid(details.ebs))
					lines.push(`💾 EBS Volumes: ${details.ebs}`);
				if (isValid(details.ebsOptimized))
					lines.push(`⚡ EBS Optimized: ${details.ebsOptimized}`);
				if (isValid(details.ebsOptimization))
					lines.push(
						`⚡ EBS Optimization: ${details.ebsOptimization}`,
					);
				if (
					isValid(details.totalStorageGiB) &&
					details.totalStorageGiB > 0
				) {
					lines.push(
						`📊 Total Storage: ${details.totalStorageGiB} GiB`,
					);
				}
				// Show block devices if available
				const blockDevices =
					details.tabsData?.storage?.blockDevices || [];
				if (blockDevices.length > 0) {
					lines.push(`📚 Block Devices:`);
					blockDevices.forEach((dev) => {
						const devInfo = [
							dev.deviceName,
							dev.volumeId,
							dev.size,
							dev.volumeType,
						]
							.filter((x) => x)
							.join(" - ");
						if (devInfo) lines.push(`   • ${devInfo}`);
					});
				}
			}
			lines.push("");
		}

		// Network Configuration with comprehensive IPv4/IPv6 support
		const hasNetworkInfo =
			details.publicIpv4 ||
			details.privateIpv4 ||
			details.publicIpv6 ||
			details.privateIpv6 ||
			details.vpcId ||
			details.tabsData?.networking ||
			details.publicDnsName;

		if (hasNetworkInfo) {
			lines.push("");
			lines.push("🌐 NETWORK CONFIGURATION");
			lines.push(SEP);

			const networkingData = details.tabsData?.networking;

			// IPv4 addresses
			const publicIpv4 =
				networkingData?.ipv4?.publicIp ||
				details.publicIpv4 ||
				details.publicIp;
			const privateIpv4 =
				networkingData?.ipv4?.privateIp ||
				details.privateIpv4 ||
				details.privateIp;

			if (publicIpv4) {
				const staticLabel = networkingData?.ipv4?.isStaticIp
					? " (Static)"
					: "";
				lines.push(`🌍 Public IPv4: ${publicIpv4}${staticLabel}`);
			}
			if (privateIpv4 && privateIpv4 !== publicIpv4) {
				lines.push(`🏠 Private IPv4: ${privateIpv4}`);
			}

			// IPv6 addresses
			const publicIpv6 =
				networkingData?.ipv6?.publicIp || details.publicIpv6;
			const ipv6Enabled = networkingData?.ipv6?.enabled;
			if (publicIpv6) {
				lines.push(`🌍 Public IPv6: ${publicIpv6}`);
			} else if (ipv6Enabled) {
				lines.push(`🌍 IPv6: Enabled`);
			}
			if (details.privateIpv6) {
				lines.push(`🏠 Private IPv6: ${details.privateIpv6}`);
			}

			// DNS Names (EC2)
			if (service === "ec2") {
				if (isValid(details.publicDns))
					lines.push(`🌐 Public DNS: ${details.publicDns}`);
				if (isValid(details.publicDnsName))
					lines.push(`🌐 Public DNS Name: ${details.publicDnsName}`);
				if (isValid(details.privateIpDns))
					lines.push(`🏠 Private IP DNS: ${details.privateIpDns}`);
				if (isValid(details.privateDnsName))
					lines.push(
						`🏠 Private DNS Name: ${details.privateDnsName}`,
					);
				if (isValid(details.hostnameType))
					lines.push(`📛 Hostname Type: ${details.hostnameType}`);
				if (isValid(details.answerPrivateDnsName))
					lines.push(
						`📛 Answer Private DNS: ${details.answerPrivateDnsName}`,
					);
				if (isValid(details.elasticIp))
					lines.push(`📌 Elastic IP: ${details.elasticIp}`);
				if (isValid(details.autoAssignedIp))
					lines.push(
						`🔄 Auto-Assigned IP: ${details.autoAssignedIp}`,
					);
			}

			// VPC/Subnet (EC2)
			if (service === "ec2") {
				if (isValid(details.vpcId))
					lines.push(`🔗 VPC ID: ${details.vpcId}`);
				if (isValid(details.subnetId))
					lines.push(`📦 Subnet ID: ${details.subnetId}`);

				// Network Interfaces
				const enis =
					details.tabsData?.networking?.networkInterfaces || [];
				if (enis.length > 0) {
					lines.push(`🔌 Network Interfaces: ${enis.length}`);
					enis.forEach((eni, idx) => {
						if (eni.eniId)
							lines.push(`   ENI ${idx + 1}: ${eni.eniId}`);
						if (eni.privateIp)
							lines.push(`      Private IP: ${eni.privateIp}`);
						if (eni.publicIp)
							lines.push(`      Public IP: ${eni.publicIp}`);
					});
				}

				// Source/Dest Check
				if (isValid(details.sourceDestCheck))
					lines.push(
						`✓ Source/Dest Check: ${details.sourceDestCheck}`,
					);
			}

			// Load balancing and distribution info for Lightsail
			if (service === "lightsail") {
				if (networkingData?.loadBalancing)
					lines.push(
						`⚖️ Load Balancing: ${networkingData.loadBalancing}`,
					);
				if (networkingData?.distribution)
					lines.push(
						`📡 Distribution: ${networkingData.distribution}`,
					);
			}

			lines.push("");
		}

		// IAM & Permissions (EC2)
		if (
			service === "ec2" &&
			(isValid(details.iamRole) || isValid(details.keyPair))
		) {
			lines.push("");
			lines.push("🔐 IAM & PERMISSIONS");
			lines.push(SEP);
			if (isValid(details.iamRole))
				lines.push(`👤 IAM Role: ${details.iamRole}`);
			if (isValid(details.iamInstanceProfile))
				lines.push(
					`📋 Instance Profile: ${details.iamInstanceProfile}`,
				);
			if (isValid(details.keyPair))
				lines.push(`🔑 Key Pair: ${details.keyPair}`);
			lines.push("");
		}

		// Monitoring & Maintenance (EC2)
		if (
			service === "ec2" &&
			(isValid(details.monitoring) ||
				isValid(details.statusChecks) ||
				isValid(details.systemStatusCheck) ||
				isValid(details.instanceStatusCheck))
		) {
			lines.push("");
			lines.push("📊 MONITORING & STATUS");
			lines.push(SEP);
			if (isValid(details.monitoring))
				lines.push(`📈 Monitoring: ${details.monitoring}`);
			if (isValid(details.statusChecks))
				lines.push(`✓ Status Checks: ${details.statusChecks}`);
			if (isValid(details.systemStatusCheck))
				lines.push(`🔧 System Status: ${details.systemStatusCheck}`);
			if (isValid(details.instanceStatusCheck))
				lines.push(
					`💻 Instance Status: ${details.instanceStatusCheck}`,
				);
			if (isValid(details.alarmStatus))
				lines.push(`🚨 Alarms: ${details.alarmStatus}`);
			if (isValid(details.autoRecovery))
				lines.push(`🔄 Auto Recovery: ${details.autoRecovery}`);
			lines.push("");
		}

		// Metadata Options (EC2)
		if (
			service === "ec2" &&
			(isValid(details.imdsv2) || isValid(details.metadataAccessible))
		) {
			lines.push("");
			lines.push("📝 METADATA OPTIONS");
			lines.push(SEP);
			if (isValid(details.imdsv2))
				lines.push(`🔒 IMDSv2: ${details.imdsv2}`);
			if (isValid(details.metadataAccessible))
				lines.push(`📋 Metadata: ${details.metadataAccessible}`);
			if (isValid(details.httpTokens))
				lines.push(`🎫 HTTP Tokens: ${details.httpTokens}`);
			if (isValid(details.httpPutResponseHopLimit))
				lines.push(`🔢 Hop Limit: ${details.httpPutResponseHopLimit}`);
			lines.push("");
		}

		// Security Information with enhanced firewall details
		if (
			details.firewallDetails ||
			details.firewallRules ||
			details.securityGroups
		) {
			lines.push("");
			lines.push("🔒 SECURITY CONFIGURATION");
			lines.push(SEP);

			if (service === "ec2" && details.securityGroups) {
				lines.push(`🛡️ Security Groups: ${details.securityGroups}`);

				// Add security group rules if available
				if (
					details.securityGroupRules &&
					details.securityGroupRules.length > 0
				) {
					lines.push("🔥 Security Group Rules:");
					details.securityGroupRules.forEach((rule) => {
						if (typeof rule === "object") {
							// Format rule object properly
							const direction = rule.type
								? rule.type.toUpperCase()
								: "UNKNOWN";
							const port = rule.port || "All";
							const protocol = rule.protocol || "All";
							const sourceOrDest =
								rule.source || rule.destination || "0.0.0.0/0";
							const description =
								rule.description && rule.description !== "–"
									? ` - ${rule.description}`
									: "";
							lines.push(
								`   • [${direction}] ${protocol} ${port} → ${sourceOrDest}${description}`,
							);
						} else {
							lines.push(`   • ${rule}`);
						}
					});
				}
			}

			if (service === "lightsail") {
				// Use detailed firewall rules if available
				if (details.firewallDetails) {
					const { ipv4Rules, ipv6Rules } = details.firewallDetails;

					if (ipv4Rules && ipv4Rules.length > 0) {
						lines.push("🔥 IPv4 Firewall Rules:");
						ipv4Rules.forEach((rule) => {
							// Format port range properly (e.g., "5010050500" -> "50100-50500")
							let formattedPortRange = rule.portRange;
							if (
								rule.portRange &&
								rule.portRange.length > 5 &&
								!rule.portRange.includes("-")
							) {
								// Check if it's a concatenated range like "5010050500"
								const halfLength = Math.floor(
									rule.portRange.length / 2,
								);
								const firstHalf = rule.portRange.substring(
									0,
									halfLength,
								);
								const secondHalf =
									rule.portRange.substring(halfLength);
								// Only format if both halves are valid numbers and different
								if (
									!isNaN(firstHalf) &&
									!isNaN(secondHalf) &&
									firstHalf !== secondHalf
								) {
									formattedPortRange = `${firstHalf}-${secondHalf}`;
								}
							}
							lines.push(
								`   • ${rule.application} (${rule.protocol} ${formattedPortRange}) - ${rule.allowConnections}`,
							);
						});
					}
					if (ipv6Rules && ipv6Rules.length > 0) {
						lines.push("\n🔥 IPv6 Firewall Rules:");
						ipv6Rules.forEach((rule) => {
							lines.push(
								`   • ${rule.application} (${rule.protocol} ${rule.portRange}) - ${rule.allowConnections}`,
							);
						});
					}
				} else if (details.firewallRules) {
					// Fallback to simple firewall rules
					lines.push(`🔥 Firewall Rules:`);
					details.firewallRules.forEach((rule) => {
						if (rule.startsWith("===")) {
							lines.push(`\n${rule}`);
						} else {
							lines.push(`   • ${rule}`);
						}
					});
				}
			}
			lines.push("");
		}

		// Tags Information
		if (
			details.tabsData?.tags?.tags &&
			Object.keys(details.tabsData.tags.tags).length > 0
		) {
			lines.push("");
			lines.push("🏷️ TAGS");
			lines.push(SEP);
			Object.entries(details.tabsData.tags.tags).forEach(
				([key, value]) => {
					lines.push(`📌 ${key}: ${value}`);
				},
			);
			lines.push("");
		}

		// SSH Key Information
		if (details.sshKeyName && details.sshKeyName !== "N/A") {
			lines.push("");
			lines.push("🔑 SSH KEY");
			lines.push(SEP);
			lines.push(`🗝️ Key Name: ${details.sshKeyName}`);
			lines.push("");
		}

		// Quick Access Links
		lines.push("");
		lines.push("🔗 QUICK ACCESS");
		lines.push(SEP);
		const regionCode = details.region || accountInfo.region || "us-east-1";

		if (service === "lightsail") {
			if (details.name) {
				lines.push(
					`🖥️ Console: https://lightsail.aws.amazon.com/ls/webapp/${regionCode}/instances/${encodeURIComponent(
						details.name,
					)}`,
				);
			}
		} else {
			if (details.instanceId) {
				const consoleUrl = `https://${regionCode}.console.aws.amazon.com/ec2/home?region=${regionCode}#Instances:instanceId=${details.instanceId}`;
				lines.push(`🖥️ Console: ${consoleUrl}`);
			}
		}

		// SSH access with IPv6 support
		const sshIp =
			details.tabsData?.networking?.ipv4?.publicIp ||
			details.publicIpv4 ||
			details.publicIp ||
			details.tabsData?.networking?.ipv6?.publicIp ||
			details.publicIpv6;

		if (sshIp) {
			const sshUser =
				details.os && details.os.toLowerCase().includes("ubuntu")
					? "ubuntu"
					: details.os && details.os.toLowerCase().includes("amazon")
						? "ec2-user"
						: "ec2-user";

			// Format IPv6 addresses correctly for SSH
			const sshAddress = sshIp.includes(":") ? `[${sshIp}]` : sshIp;
			const keyName =
				details.keyPair && details.keyPair !== "N/A"
					? `${details.keyPair}.pem`
					: "your-key.pem";
			lines.push(
				`🌐 SSH Access: ssh -i ${keyName} ${sshUser}@${sshAddress}`,
			);
		}
		lines.push("");

		return lines.join("\n");
	};

	// Maximum URL length to avoid 400 Bad Request errors
	const MAX_URL_LENGTH = 7500;

	// Copy text to clipboard with fallback
	window.awsExtension.copyToClipboard = async function (text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = text;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			try {
				document.execCommand("copy");
				document.body.removeChild(textArea);
				return true;
			} catch (err2) {
				document.body.removeChild(textArea);
				return false;
			}
		}
	};

	// Show notification toast
	window.awsExtension.showNotification = function (message, duration = 3000) {
		const notification = document.createElement("div");
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: linear-gradient(135deg, #28a745, #20c997);
			color: white;
			padding: 14px 20px;
			border-radius: 8px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
			z-index: 10000;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 14px;
			font-weight: 600;
			animation: slideIn 0.3s ease;
		`;
		notification.textContent = message;

		// Add animation keyframes
		if (!document.getElementById("notification-animation")) {
			const style = document.createElement("style");
			style.id = "notification-animation";
			style.textContent = `
				@keyframes slideIn {
					from { transform: translateX(100%); opacity: 0; }
					to { transform: translateX(0); opacity: 1; }
				}
			`;
			document.head.appendChild(style);
		}

		document.body.appendChild(notification);
		setTimeout(() => {
			if (notification.parentNode) {
				notification.parentNode.removeChild(notification);
			}
		}, duration);
	};

	// Compose subject and open configured composer
	// Now uses compact format for URL-based sharing to avoid 400 errors
	window.awsExtension.openComposer = function (
		subject,
		body,
		fullBody = null,
	) {
		chrome.storage.sync.get(["composer"], (res) => {
			const composer = res.composer || "gmail";
			const sub = encodeURIComponent(subject);
			const b = encodeURIComponent(body);

			let url = "";

			switch (composer) {
				// Web Clients
				case "gmail":
					url = `https://mail.google.com/mail/?view=cm&su=${sub}&body=${b}`;
					break;
				case "outlook":
					url = `https://outlook.live.com/mail/0/deeplink/compose?subject=${sub}&body=${b}`;
					break;
				case "yahoo":
					url = `https://compose.mail.yahoo.com/?subject=${sub}&body=${b}`;
					break;
				case "protonmail":
					url = `https://mail.proton.me/compose?subject=${sub}&body=${b}`;
					break;
				case "aol":
					url = `https://mail.aol.com/webmail-std/en-us/suite#compose?subject=${sub}&body=${b}`;
					break;
				case "icloud":
					url = `https://www.icloud.com/mail/#compose?subject=${sub}&body=${b}`;
					break;
				// Desktop Applications
				case "thunderbird":
				case "outlook-office":
				case "apple-mail":
				case "evolution":
				case "kmail":
				case "mailto":
				default:
					url = `mailto:?subject=${sub}&body=${b}`;
					break;
			}

			// Check URL length and use clipboard fallback if too long
			if (url.length > MAX_URL_LENGTH) {
				const clipboardBody = fullBody || body;
				window.awsExtension
					.copyToClipboard(clipboardBody)
					.then((success) => {
						if (success) {
							window.awsExtension.showNotification(
								"📋 Instance details copied to clipboard! Paste into your email.",
								4000,
							);
							// Open composer without body, user will paste
							const shortUrl =
								url.split("&body=")[0] ||
								`mailto:?subject=${sub}`;
							try {
								window.open(shortUrl, "_blank");
							} catch (error) {
								console.warn("Failed to open composer:", error);
							}
						} else {
							window.awsExtension.showNotification(
								"⚠️ URL too long. Please try copying manually.",
								4000,
							);
						}
					});
			} else {
				try {
					window.open(url, "_blank");
				} catch (error) {
					console.warn(
						"Email composer failed, trying mailto fallback:",
						error,
					);
					window.open(`mailto:?subject=${sub}&body=${b}`, "_blank");
				}
			}
		});
	};

	// Highlight existing share buttons when extension icon is clicked
	window.awsExtension.highlightButtons = function () {
		const buttons = document.querySelectorAll(`.${BUTTON_CLASS}`);
		buttons.forEach((btn) => {
			btn.style.animation = "pulse 2s infinite";
			btn.style.border = "2px solid #FFD700";
		});

		// Add pulse animation if not exists
		if (!document.getElementById("pulse-animation")) {
			const style = document.createElement("style");
			style.id = "pulse-animation";
			style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `;
			document.head.appendChild(style);
		}

		// Remove highlight after 6 seconds
		setTimeout(() => {
			buttons.forEach((btn) => {
				btn.style.animation = "";
				btn.style.border = "";
			});
		}, 6000);

		// Show count notification
		if (buttons.length > 0) {
			const notification = document.createElement("div");
			notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #FF9500, #FF6B35);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 600;
      `;
			notification.textContent = `🎯 Found ${
				buttons.length
			} AWS instance${
				buttons.length !== 1 ? "s" : ""
			} with share buttons`;
			document.body.appendChild(notification);

			setTimeout(() => {
				if (notification.parentNode) {
					notification.parentNode.removeChild(notification);
				}
			}, 4000);
		}
	};
})();

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
		style.textContent = `
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
		`;
		overlay.appendChild(style);

		const service = details.service === "lightsail" ? "Lightsail" : "EC2";
		
		modal.innerHTML = `
			<div class="aws-share-header">
				<h2>Share ${service} Instance</h2>
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
		`;
		
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
			let subject = `🚀 AWS ${service} Instance Details`;
			if (details.name && details.name !== details.instanceId) subject = `🚀 ${details.name} - AWS ${service} Instance`;
			const state = details.state || details.instanceState;
			if (state && state !== "N/A") subject += ` [${state.toUpperCase()}]`;
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
			const text = getSubject() + "\n" + generateText(true);
			window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
			closeModal();
		});

		document.getElementById('btn-mail').addEventListener('click', () => {
			const subject = getSubject();
			const body = generateText(true);
			window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
			closeModal();
		});
	};
