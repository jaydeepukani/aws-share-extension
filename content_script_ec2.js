// content_script_ec2.js - Clean EC2 instance details page functionality
(() => {
	if (!window.awsExtension) {
		return;
	}

	const {
		BUTTON_CLASS,
		extractIPs,
		extractAccountInfo,
		extractRegionInfo,
		buildEmailBody,
		openComposer,
		highlightButtons,
	} = window.awsExtension;

	// Track button creation to prevent duplicates
	let buttonExists = false;

	// Global data storage for tab information accumulation
	let globalTabData = {
		details: {},
		security: {},
		networking: {},
		storage: {},
		tags: {},
		currentTab: null,
	};

	// Detect if we're on EC2 service
	function isEC2Service() {
		const url = window.location.href;
		return (
			url.includes("console.aws.amazon.com/ec2") &&
			(url.includes("/instances/") || url.includes("#InstanceDetails:"))
		);
	}

	// Check if we're inside an iframe
	function isIframe() {
		return window !== window.top;
	}

	// Get active document (iframe or main)
	function getActiveDocument() {
		if (isIframe()) return document;

		const iframe = document.querySelector("#compute-react-frame");
		return iframe && iframe.contentDocument
			? iframe.contentDocument
			: document;
	}

	// Extract instance ID from URL or page
	function getInstanceId() {
		const url = window.location.href;
		// Try /instances/i-xxxxxx pattern
		const urlMatch = url.match(/\/instances\/(i-[a-f0-9]{8,17})/);
		if (urlMatch) return urlMatch[1];

		// Try #InstanceDetails:instanceId=i-xxxxxx pattern
		const hashMatch = url.match(
			/[#&]InstanceDetails:instanceId=(i-[a-f0-9]{8,17})/
		);
		if (hashMatch) return hashMatch[1];

		// Try to match instance ID in the HTML (not just textContent)
		const html = document.body.innerHTML;
		const pageMatch = html.match(/\b(i-[a-f0-9]{8,17})\b/);
		return pageMatch ? pageMatch[1] : null;
	}

	// Comprehensive tab switching and data extraction for EC2
	async function extractAllTabsData(instanceId) {
		// Reset global data for new extraction
		globalTabData = {
			details: {},
			security: {},
			networking: {},
			storage: {},
			tags: {},
			currentTab: null,
		};

		try {
			// Define tab configurations based on the HTML structure
			const tabConfigs = [
				{
					name: "details",
					testId: "details",
					label: "Details",
				},
				{
					name: "security",
					testId: "security",
					label: "Security",
				},
				{
					name: "networking",
					testId: "networking",
					label: "Networking",
				},
				{
					name: "storage",
					testId: "storage",
					label: "Storage",
				},
				{
					name: "tags",
					testId: "tags",
					label: "Tags",
				},
			];

			// Extract data from each tab
			for (const tabConfig of tabConfigs) {
				try {
					// Set current tab for global tracking
					globalTabData.currentTab = tabConfig.name;

					// Find the tab using data-testid
					const activeDoc = getActiveDocument();
					const tabElement = activeDoc.querySelector(
						`[data-testid="${tabConfig.testId}"]`
					);

					if (tabElement) {
						// Check if tab is already active
						const isActive =
							tabElement.getAttribute("aria-selected") === "true";

						if (!isActive) {
							// Click the tab
							tabElement.click();

							// Wait for content to load
							await new Promise((resolve) =>
								setTimeout(resolve, 2500)
							);
						}

						// Extract data based on tab type and store in global data
						const tabData = await extractTabSpecificData(
							tabConfig.name
						);
						globalTabData[tabConfig.name] = {
							...globalTabData[tabConfig.name],
							...tabData,
						};
					}
				} catch (error) {
					// Error extracting tab data
				}
			}
		} catch (error) {
			// Error in comprehensive tab extraction
		}

		return globalTabData;
	}

	// Extract tab-specific data based on tab type
	async function extractTabSpecificData(tabName) {
		switch (tabName) {
			case "details":
				return await extractDetailsTabData();
			case "security":
				return await extractSecurityTabData();
			case "networking":
				return await extractNetworkingTabData();
			case "storage":
				return await extractStorageTabData();
			case "tags":
				return await extractTagsTabData();
			default:
				return {};
		}
	}

	// Extract details tab data (only essential fields used in email)
	async function extractDetailsTabData() {
		const activeDoc = getActiveDocument();
		const pageText = activeDoc.body.textContent || "";

		const details = {
			instanceId: getInstanceId(),
			service: "ec2",
			name: "N/A",
			state: "N/A",
			instanceType: "N/A",
			availabilityZone: "N/A",
			os: "N/A",
			osVersion: "N/A",
			keyPair: "N/A",
			// Storage fields
			rootDevice: "N/A",
			rootDeviceType: "N/A",
			ebs: "N/A",
			ebsOptimization: "N/A",
		};

		try {
			// Extract instance name from header
			const nameSelectors = [
				'[data-testid="header-title"] h1',
				".awsui_title_2qdw9_8dz0f_295 h1",
				"h1",
			];

			for (const selector of nameSelectors) {
				const nameEl = activeDoc.querySelector(selector);
				if (
					nameEl &&
					nameEl.textContent.trim() &&
					!nameEl.textContent.includes("Instance") &&
					nameEl.textContent.trim() !== details.instanceId
				) {
					const nameText = nameEl.textContent.trim();
					// Extract name from "Instance summary for i-xxx (Name)" format
					const nameMatch = nameText.match(/\(([^)]+)\)$/);
					if (nameMatch) {
						details.name = nameMatch[1];
					} else if (!nameText.includes("summary")) {
						details.name = nameText;
					}
					break;
				}
			}

			// Extract data using AWS's data-analytics attribute structure
			const extractFieldByLabel = (labelText) => {
				const labelElement = activeDoc.querySelector(
					`[data-analytics="label-for-${labelText}"]`
				);
				if (labelElement) {
					const parentDiv = labelElement.closest(
						".awsui_grid-column_14yj0_16am7_186"
					);
					if (parentDiv) {
						// Look for text-to-copy span first
						const copySpan = parentDiv.querySelector(
							".awsui_text-to-copy_ljpwc_30z5b_9"
						);
						if (copySpan) {
							const value = copySpan.textContent?.trim();
							if (value && value !== "–" && value !== "-") {
								return value;
							}
						}

						// Fallback to getting the value from the sibling div
						const valueDiv =
							parentDiv.querySelector("div:last-child");
						if (
							valueDiv &&
							valueDiv !== labelElement.parentElement
						) {
							// Try to get clean text by removing the label text
							let value = valueDiv.textContent?.trim();
							if (value && value !== "–" && value !== "-") {
								// Remove label text if it appears at the beginning
								const labelText =
									labelElement.textContent?.trim();
								if (labelText && value.startsWith(labelText)) {
									value = value
										.substring(labelText.length)
										.trim();
								}
								return value;
							}
						}
					}
				}
				return null;
			};

			const keyPair = extractFieldByLabel("Key pair assigned at launch");
			if (keyPair) {
				// Extract key pair name from link text
				const keyMatch = keyPair.match(/([a-zA-Z0-9._-]+)$/);
				details.keyPair = keyMatch ? keyMatch[1] : keyPair;
			}

			// Extract additional fields from the details tab
			const instanceState = extractFieldByLabel("Instance state");
			if (instanceState) {
				const cleanState = instanceState
					.replace(/^Instance state/i, "")
					.trim();
				details.state = cleanState || instanceState;
			}

			// Extract VPC ID if available in details tab
			const vpcId = extractFieldByLabel("VPC ID");
			if (vpcId) {
				const cleanVpcId = vpcId.replace(/^VPC ID/i, "").trim();
				details.vpcId = cleanVpcId || vpcId;
			}

			// Extract Subnet ID if available in details tab
			const subnetId = extractFieldByLabel("Subnet ID");
			if (subnetId) {
				const cleanSubnetId = subnetId
					.replace(/^Subnet ID/i, "")
					.trim();
				details.subnetId = cleanSubnetId || subnetId;
			}

			// Extract Public IPv4 address if available in details tab
			const publicIpv4 = extractFieldByLabel("Public IPv4 address");
			if (publicIpv4) {
				let cleanPublicIpv4 = publicIpv4
					.replace(/^Public IPv4 address/i, "")
					.trim();
				// Remove additional text like '| open address'
				cleanPublicIpv4 = cleanPublicIpv4
					.replace(/\s*\|.*$/, "")
					.trim();
				details.publicIpv4 = cleanPublicIpv4 || publicIpv4;
			}

			// Extract Private IPv4 addresses if available in details tab
			const privateIpv4 = extractFieldByLabel("Private IPv4 addresses");
			if (privateIpv4) {
				const cleanPrivateIpv4 = privateIpv4
					.replace(/^Private IPv4 addresses/i, "")
					.trim();
				details.privateIpv4 = cleanPrivateIpv4 || privateIpv4;
			}

			// Extract instance state using multiple methods
			const statePatterns = [
				/State:\s*([a-zA-Z-]+)/i,
				/Instance state:\s*([a-zA-Z-]+)/i,
				/\b(running|stopped|pending|shutting-down|terminated|stopping)\b/i,
			];

			for (const pattern of statePatterns) {
				const match = pageText.match(pattern);
				if (match) {
					details.state = match[1];
					break;
				}
			}

			// Extract instance type using AWS data-analytics structure
			const instanceType = extractFieldByLabel("Instance type");
			if (instanceType) {
				const cleanInstanceType = instanceType
					.replace(/^Instance type/i, "")
					.trim();
				details.instanceType = cleanInstanceType || instanceType;
			} else {
				// Fallback to text pattern matching
				const typePattern = /Instance type:\s*([a-z]\d+\.[a-z0-9]+)/i;
				const typeMatch = pageText.match(typePattern);
				if (typeMatch) {
					details.instanceType = typeMatch[1];
				}
			}

			// Extract availability zone using AWS data-analytics structure
			const availabilityZone = extractFieldByLabel("Availability Zone");
			if (availabilityZone) {
				const cleanAvailabilityZone = availabilityZone
					.replace(/^Availability Zone/i, "")
					.trim();
				details.availabilityZone =
					cleanAvailabilityZone || availabilityZone;
			} else {
				// Fallback to text pattern matching
				const azPattern =
					/Availability Zone:\s*([a-z]{2}-[a-z]+-\d[a-z])/i;
				const azMatch = pageText.match(azPattern);
				if (azMatch) {
					details.availabilityZone = azMatch[1];
				}
			}

			// Extract security groups
			const sgMatches = pageText.match(/\bsg-[a-f0-9]+\b/g);
			if (sgMatches && sgMatches.length > 0) {
				details.securityGroups = [...new Set(sgMatches)].join(", ");
			}

			// Extract OS version from AMI name first
			const amiName = extractFieldByLabel("details_ami_name");
			if (amiName) {
				// Extract OS version from AMI name patterns like "ubuntu-jammy-22.04"
				const osVersionMatch = amiName.match(
					/(ubuntu|centos|rhel|amazon|windows)[\w\-]*[\-\/](\d+[\.]?\d*|\d{4})/i
				);
				if (osVersionMatch) {
					const osName = osVersionMatch[1].toLowerCase();
					const osVersion = osVersionMatch[2];
					details.os =
						osName.charAt(0).toUpperCase() + osName.slice(1);
					details.osVersion = osVersion;
				}
			}

			// Try direct AMI name extraction with different selector if above fails
			if (details.os === "N/A") {
				const amiNameElement = activeDoc.querySelector(
					'[data-analytics="copy-to-clipboard-details_ami_name"] .awsui_text-to-copy_ljpwc_30z5b_9'
				);
				if (amiNameElement) {
					const amiName = amiNameElement.textContent?.trim();
					if (amiName) {
						const osVersionMatch = amiName.match(
							/(ubuntu|centos|rhel|amazon|windows)[\w\-]*[\-\/](\d+[\.]?\d*|jammy|focal|bionic)/i
						);
						if (osVersionMatch) {
							const osName = osVersionMatch[1].toLowerCase();
							let osVersion = osVersionMatch[2];
							// Convert Ubuntu codenames to versions
							if (osVersion === "jammy") osVersion = "22.04";
							else if (osVersion === "focal") osVersion = "20.04";
							else if (osVersion === "bionic")
								osVersion = "18.04";

							details.os =
								osName.charAt(0).toUpperCase() +
								osName.slice(1);
							details.osVersion = osVersion;
						}
					}
				}
			} // Fallback to extract OS information from page text
			if (details.os === "N/A") {
				const osPatterns = [
					/Platform:\s*([^\n\r]+)/i,
					/OS:\s*([^\n\r]+)/i,
					/\b(Ubuntu|Amazon Linux|Windows|CentOS|RHEL|SUSE)\s+([0-9][^\s]*)/i,
					/\b(Ubuntu|Amazon Linux|Windows|CentOS|RHEL|SUSE)\b/i,
				];

				for (const pattern of osPatterns) {
					const match = pageText.match(pattern);
					if (match) {
						if (match[2]) {
							// OS with version
							details.os = match[1].trim();
							details.osVersion = `${match[1].trim()} ${match[2].trim()}`;
						} else {
							details.os = match[1].trim();
						}
						break;
					}
				}
			}

			// Extract storage information
			const rootDeviceMatch = pageText.match(
				/Root device:\s*([^\n\r]+)/i
			);
			if (rootDeviceMatch) details.rootDevice = rootDeviceMatch[1].trim();

			const rootTypeMatch = pageText.match(
				/Root device type:\s*([^\n\r]+)/i
			);
			if (rootTypeMatch) details.rootDeviceType = rootTypeMatch[1].trim();

			const ebsMatches = pageText.match(/\bvol-[a-f0-9]+\b/g);
			if (ebsMatches) details.ebs = [...new Set(ebsMatches)].join(", ");

			if (
				pageText.includes("EBS-optimized") ||
				pageText.includes("EBS optimization")
			) {
				details.ebsOptimization = pageText.includes("enabled")
					? "enabled"
					: "disabled";
			} // Extract IP addresses
			const ipData = extractIPs(pageText);
			Object.assign(details, ipData);
		} catch (error) {
			// Silent error handling
		}

		return details;
	}

	// Extract security tab data (only security groups needed for email)
	async function extractSecurityTabData() {
		const securityData = {
			securityGroups: "N/A",
			securityGroupRules: [],
			inboundRules: [],
			outboundRules: [],
		};
		try {
			const activeDoc = getActiveDocument();
			const pageText = activeDoc.body.textContent || "";

			// Extract security groups from links
			const sgList = [];
			const sgLinks = activeDoc.querySelectorAll(
				'a[data-analytics="security-groups-link"]'
			);
			sgLinks.forEach((link) => {
				const text = link.textContent?.trim();
				const match = text?.match(/^(sg-[a-f0-9]+)\s*\((.+)\)$/);
				if (match) {
					sgList.push(`${match[1]} (${match[2]})`);
				} else if (text?.match(/^sg-[a-f0-9]+/)) {
					sgList.push(text);
				}
			});

			if (sgList.length > 0) {
				securityData.securityGroups = [...new Set(sgList)].join(", ");
			}

			// Wait for security rules tables to load properly
			let retryCount = 0;
			const maxRetries = 5;

			while (retryCount < maxRetries) {
				// Check for both inbound and outbound tables
				const inboundTable = activeDoc.querySelector(
					'[data-analytics="inbound-rules"] table tbody'
				);
				const outboundTable = activeDoc.querySelector(
					'[data-analytics="outbound-rules"] table tbody'
				);

				if (inboundTable && outboundTable) {
					// Extract inbound rules
					const inboundRules = extractSecurityRules(
						inboundTable,
						"inbound"
					);
					if (inboundRules.length > 0) {
						securityData.inboundRules = inboundRules;
						securityData.securityGroupRules.push(...inboundRules);
					}

					// Extract outbound rules
					const outboundRules = extractSecurityRules(
						outboundTable,
						"outbound"
					);
					if (outboundRules.length > 0) {
						securityData.outboundRules = outboundRules;
						securityData.securityGroupRules.push(...outboundRules);
					}

					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 1500));
				retryCount++;
			}
		} catch (error) {
			console.error("Error extracting security tab data:", error);
		}

		return securityData;
	}

	// Helper function to extract security rules from table tbody
	function extractSecurityRules(tbody, type) {
		const rules = [];
		const rows = tbody.querySelectorAll("tr");

		rows.forEach((row) => {
			const cells = row.querySelectorAll("td");
			if (cells.length >= 5) {
				const rule = {
					type: type,
					port:
						cells[2]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "",
					protocol:
						cells[3]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "",
					description: "",
				};

				// Handle source/destination based on rule type
				if (type === "inbound") {
					rule.source =
						cells[4]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "";
					rule.description =
						cells[6]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "";
				} else {
					rule.destination =
						cells[4]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "";
					rule.description =
						cells[6]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim() || "";
				}

				// Only add rule if it has meaningful data (skip empty rows with just dashes)
				if (
					(rule.port && rule.port !== "–") ||
					(rule.protocol && rule.protocol !== "–")
				) {
					rules.push(rule);
				}
			}
		});

		return rules;
	}

	// Extract networking tab data (only fields used in email)
	async function extractNetworkingTabData() {
		const networkingData = {
			vpcId: "N/A",
			publicIpv4: "N/A",
			privateIpv4: "N/A",
			publicIpv6: "N/A",
			privateIpv6: "N/A",
			securityGroups: "N/A",
		};

		try {
			const activeDoc = getActiveDocument();
			const pageText = activeDoc.body.textContent || "";

			// Extract field values using AWS data-analytics structure
			const extractNetworkingField = (labelText) => {
				const labelElement = activeDoc.querySelector(
					`[data-analytics="label-for-${labelText}"]`
				);
				if (labelElement) {
					const parentDiv = labelElement.closest(
						".awsui_grid-column_14yj0_16am7_186"
					);
					if (parentDiv) {
						// Look for text-to-copy span first
						const copySpan = parentDiv.querySelector(
							".awsui_text-to-copy_ljpwc_30z5b_9"
						);
						if (copySpan) {
							const value = copySpan.textContent?.trim();
							if (value && value !== "–" && value !== "-") {
								return value;
							}
						}

						const valueDiv =
							parentDiv.querySelector("div:last-child");
						if (
							valueDiv &&
							valueDiv !== labelElement.parentElement
						) {
							let value = valueDiv.textContent?.trim();
							if (value && value !== "–" && value !== "-") {
								// Remove label text if it appears at the beginning
								const labelText =
									labelElement.textContent?.trim();
								if (labelText && value.startsWith(labelText)) {
									value = value
										.substring(labelText.length)
										.trim();
								}
								return value;
							}
						}
					}
				}
				return null;
			};

			// Extract VPC ID from text-to-copy span
			const vpcElement = activeDoc.querySelector(
				'[data-analytics="copy-to-clipboard-vpc-id"] .awsui_text-to-copy_ljpwc_30z5b_9'
			);
			if (vpcElement) {
				networkingData.vpcId = vpcElement.textContent?.trim() || "N/A";
			}

			// Extract Subnet ID from text-to-copy span
			const subnetElement = activeDoc.querySelector(
				'[data-analytics="copy-to-clipboard-subnet-id"] .awsui_text-to-copy_ljpwc_30z5b_9'
			);
			if (subnetElement) {
				networkingData.subnetId =
					subnetElement.textContent?.trim() || "N/A";
			}

			// Extract Public IPv4 DNS
			const publicDns = extractNetworkingField("Public IPv4 DNS");
			if (publicDns) {
				const cleanPublicDns = publicDns
					.replace(/^Public IPv4 DNS/i, "")
					.trim();
				networkingData.publicDnsName = cleanPublicDns || publicDns;
			}

			// Extract Private IPv4 DNS
			const privateDns = extractNetworkingField("Private IPv4 DNS");
			if (privateDns) {
				const cleanPrivateDns = privateDns
					.replace(/^Private IPv4 DNS/i, "")
					.trim();
				networkingData.privateDnsName = cleanPrivateDns || privateDns;
			}

			// Extract Public IPv4 address
			const publicIp = extractNetworkingField("Public IPv4 address");
			if (publicIp) {
				let cleanPublicIp = publicIp
					.replace(/^Public IPv4 address/i, "")
					.trim();
				// Remove additional text like '| open address'
				cleanPublicIp = cleanPublicIp.replace(/\s*\|.*$/, "").trim();
				networkingData.publicIpv4 = cleanPublicIp || publicIp;
			}

			// Extract Private IPv4 addresses
			const privateIp = extractNetworkingField("Private IPv4 addresses");
			if (privateIp) {
				const cleanPrivateIp = privateIp
					.replace(/^Private IPv4 addresses/i, "")
					.trim();
				networkingData.privateIpv4 = cleanPrivateIp || privateIp;
			}

			// Extract IPv6 addresses
			const ipv6 = extractNetworkingField("IPv6 addresses");
			if (ipv6) {
				const cleanIpv6 = ipv6.replace(/^IPv6 addresses/i, "").trim();
				if (cleanIpv6 && cleanIpv6 !== "–" && cleanIpv6 !== "-") {
					networkingData.publicIpv6 = cleanIpv6;
				}
			}

			// Extract IP addresses using the common function as fallback
			const ipData = extractIPs(pageText);
			if (networkingData.publicIpv4 === "N/A" && ipData.publicIpv4) {
				networkingData.publicIpv4 = ipData.publicIpv4;
			}
			if (networkingData.privateIpv4 === "N/A" && ipData.privateIpv4) {
				networkingData.privateIpv4 = ipData.privateIpv4;
			}
			if (networkingData.publicIpv6 === "N/A" && ipData.publicIpv6) {
				networkingData.publicIpv6 = ipData.publicIpv6;
			}

			// Extract security groups
			const sgMatches = pageText.match(/\bsg-[a-f0-9]+\b/g);
			if (sgMatches && sgMatches.length > 0) {
				networkingData.securityGroups = [...new Set(sgMatches)].join(
					", "
				);
			}

			// Elastic IP not used in email body, skip extraction
		} catch (error) {
			// Silent error handling
		}

		return networkingData;
	}

	// Extract storage tab data (for storage configuration section)
	async function extractStorageTabData() {
		const storageData = {
			rootDevice: "N/A",
			rootDeviceType: "N/A",
			ebsOptimization: "N/A",
			blockDevices: [],
		};

		try {
			const activeDoc = getActiveDocument();

			// Extract root device name
			const rootDeviceNameElement = activeDoc.querySelector(
				'[data-analytics="label-for-root-device-name"]'
			);
			if (rootDeviceNameElement) {
				const rootDeviceValue =
					rootDeviceNameElement.parentElement.querySelector(
						".awsui_text-to-copy_ljpwc_30z5b_9"
					);
				if (rootDeviceValue) {
					storageData.rootDevice =
						rootDeviceValue.textContent?.trim() || "N/A";
				}
			}

			// Extract root device type
			const rootDeviceTypeElement = activeDoc.querySelector(
				'[data-analytics="label-for-Root device type"]'
			);
			if (rootDeviceTypeElement) {
				const rootDeviceTypeValue =
					rootDeviceTypeElement.parentElement.querySelector(
						"div:last-child"
					);
				if (
					rootDeviceTypeValue &&
					rootDeviceTypeValue !== rootDeviceTypeElement.parentElement
				) {
					storageData.rootDeviceType =
						rootDeviceTypeValue.textContent?.trim() || "N/A";
				}
			}

			// Extract EBS optimization
			const ebsOptimizationElement = activeDoc.querySelector(
				'[data-analytics="label-for-EBS optimization"]'
			);
			if (ebsOptimizationElement) {
				const ebsOptimizationValue =
					ebsOptimizationElement.parentElement.querySelector(
						"div:last-child"
					);
				if (
					ebsOptimizationValue &&
					ebsOptimizationValue !==
						ebsOptimizationElement.parentElement
				) {
					storageData.ebsOptimization =
						ebsOptimizationValue.textContent?.trim() || "N/A";
				}
			}

			// Extract block devices from table
			const blockDevicesTable = activeDoc.querySelector(
				'[data-testid="block-devices-table"] table tbody'
			);
			if (blockDevicesTable) {
				const rows = blockDevicesTable.querySelectorAll("tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						const volumeId = cells[1]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim();
						const deviceName = cells[2]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim();
						const size = cells[3]
							?.querySelector(
								".awsui_body-cell-content_c6tup_1wfrk_160"
							)
							?.textContent?.trim();

						if (volumeId && deviceName && size) {
							storageData.blockDevices.push({
								volumeId,
								deviceName,
								size: size + " GiB",
							});
						}
					}
				});
			}
		} catch (error) {
			// Silent error handling
		}

		return storageData;
	}

	// Extract tags tab data
	async function extractTagsTabData() {
		const tagsData = {
			tags: "N/A",
			tagCount: 0,
		};

		try {
			const activeDoc = getActiveDocument();

			// Look for the tags table using AWS UI structure
			const table = activeDoc.querySelector("table");

			if (!table) {
				tagsData.tags = "No tags configured";
				return tagsData;
			}

			// Look for tag table rows in tbody
			const tagRows = table.querySelectorAll("tbody tr");

			if (tagRows.length === 0) {
				tagsData.tags = "No tags configured";
			} else {
				const tags = {};
				tagRows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 2) {
						// Extract text from the cell content divs
						const keyDiv = cells[0]?.querySelector(
							".awsui_body-cell-content_c6tup_1wfrk_160"
						);
						const valueDiv = cells[1]?.querySelector(
							".awsui_body-cell-content_c6tup_1wfrk_160"
						);

						const key =
							keyDiv?.textContent?.trim() ||
							cells[0]?.textContent?.trim();
						const value =
							valueDiv?.textContent?.trim() ||
							cells[1]?.textContent?.trim();

						if (
							key &&
							value &&
							key !== "Key" &&
							value !== "Value" &&
							key.length > 0 &&
							value.length > 0
						) {
							tags[key] = value;
						}
					}
				});

				if (Object.keys(tags).length > 0) {
					tagsData.tags = tags;
					tagsData.tagCount = Object.keys(tags).length;
				} else {
					tagsData.tags = "No tags found";
				}
			}
		} catch (error) {
			// Silent error handling
		}

		return tagsData;
	} // Main extraction function that combines all tab data
	async function extractInstanceDetails() {
		const instanceId = getInstanceId();
		if (!instanceId) return null;

		try {
			// Extract data from all tabs
			const allTabsData = await extractAllTabsData(instanceId);

			// Extract region information
			const region = extractRegionInfo();

			// Combine all data from different tabs, prioritizing tab data over summary data
			const details = {
				instanceId,
				service: "ec2",
				region,
				// Use tab-specific data as the primary source
				...allTabsData.details,
				...allTabsData.security,
				...allTabsData.networking,
				...allTabsData.storage,
				...allTabsData.tags,
				tabsData: allTabsData,
			};

			// Post-process to enhance details with available data
			// Extract name from tags if not already set
			if (
				(!details.name || details.name === "N/A") &&
				allTabsData.tags?.tags?.Name
			) {
				details.name = allTabsData.tags.tags.Name;
			}

			// Set security groups from networking tab if details tab doesn't have it
			if (
				(!details.securityGroups || details.securityGroups === "N/A") &&
				allTabsData.networking?.securityGroups
			) {
				details.securityGroups = allTabsData.networking.securityGroups;
			}

			return details;
		} catch (error) {
			// Silent error handling
			return null;
		}
	}

	// Create floating share button
	function createFloatingButton(instanceId) {
		if (
			buttonExists ||
			document.querySelector(".aws-ec2-floating-button")
		) {
			return;
		}

		const button = document.createElement("button");
		button.className = `aws-ec2-floating-button ${BUTTON_CLASS}`;
		button.setAttribute("data-instance-id", instanceId);
		button.setAttribute("data-service", "ec2");
		button.style.cssText = `
			position: fixed;
			top: 50%;
			right: 0;
			transform: translateY(-50%);
			z-index: 9999;
			background: #FF9900;
			color: white;
			border: none;
			border-radius: 50px 0 0 50px;
			padding: 12px 16px 12px 20px;
			cursor: pointer;
			box-shadow: -4px 0 12px rgba(255, 153, 0, 0.3);
			transition: all 0.3s ease;
			border-right: none;
		`;

		button.innerHTML = `
			<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
				<path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
			</svg>
		`;

		button.setAttribute("title", "Share EC2 Instance Details");

		// Hover effects
		button.addEventListener("mouseenter", () => {
			button.style.background = "#E68900";
		});

		button.addEventListener("mouseleave", () => {
			button.style.background = "#FF9900";
		});

		// Click handler
		button.addEventListener("click", async (e) => {
			e.stopPropagation();
			e.preventDefault();
			await handleShare(button);
		});

		document.body.appendChild(button);
		buttonExists = true;
	}

	// Handle share functionality
	async function handleShare(button) {
		// Show loading state
		const originalContent = button.innerHTML;
		button.innerHTML = `
			<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; animation: spin 1s linear infinite;">
				<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
			</svg>
		`;
		button.disabled = true;

		// Add spin animation
		if (!document.getElementById("spin-animation")) {
			const style = document.createElement("style");
			style.id = "spin-animation";
			style.textContent =
				"@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
			document.head.appendChild(style);
		}

		try {
			// Extract instance details
			const details = await extractInstanceDetails();
			if (!details) {
				throw new Error("Could not extract instance details");
			}

			// Build email
			const regionInfo = extractRegionInfo();
			const accountInfo = extractAccountInfo();

			let subject = "🚀 AWS EC2 Instance Details";
			if (details.name && details.name !== details.instanceId) {
				subject = `🚀 ${details.name} - AWS EC2 Instance`;
			}
			if (details.state && details.state !== "N/A") {
				subject += ` [${details.state.toUpperCase()}]`;
			}

			const body = buildEmailBody(details, accountInfo);
			openComposer(subject, body);
		} catch (error) {
			console.error("EC2 Share Error:", error);
			console.error("Error details:", {
				message: error.message,
				stack: error.stack,
				instanceId: getInstanceId(),
				currentUrl: window.location.href,
			});
			// Show error to user
			button.innerHTML = `
				<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
					<path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/>
				</svg>
			`;
			setTimeout(() => {
				button.innerHTML = originalContent;
			}, 2000);
		} finally {
			// Reset button
			button.innerHTML = originalContent;
			button.disabled = false;
		}
	}

	// Wait for page content to load
	function waitForContent() {
		return new Promise((resolve) => {
			if (document.readyState === "complete") {
				setTimeout(resolve, 1500);
			} else {
				window.addEventListener("load", () => {
					setTimeout(resolve, 1500);
				});
			}
		});
	}

	// Initialize EC2 extension
	async function initialize() {
		if (!isEC2Service()) return;

		await waitForContent();

		const instanceId = getInstanceId();
		if (!instanceId) return;

		// Create floating button
		createFloatingButton(instanceId);
	}

	// Handle extension messages
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === "highlight-buttons") {
			highlightButtons();
			sendResponse({
				count: document.querySelectorAll(`.${BUTTON_CLASS}`).length,
			});
		} else if (request.action === "get-button-count") {
			sendResponse({
				count: document.querySelectorAll(`.${BUTTON_CLASS}`).length,
			});
		}
	});

	// Initialize when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize);
	} else {
		initialize();
	}

	// Also monitor for navigation changes
	const observer = new MutationObserver(() => {
		if (isEC2Service() && !buttonExists) {
			initialize();
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	// Re-initialize on URL changes
	let currentUrl = window.location.href;
	setInterval(() => {
		if (window.location.href !== currentUrl) {
			currentUrl = window.location.href;
			buttonExists = false;
			initialize();
		}
	}, 2000);
})();
