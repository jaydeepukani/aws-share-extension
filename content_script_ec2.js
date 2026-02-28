// content_script_ec2.js - Comprehensive EC2 instance details extraction
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
		const urlMatch = url.match(/\/instances\/(i-[a-f0-9]{8,17})/);
		if (urlMatch) return urlMatch[1];
		const hashMatch = url.match(
			/[#&]InstanceDetails:instanceId=(i-[a-f0-9]{8,17})/,
		);
		if (hashMatch) return hashMatch[1];
		const html = document.body.innerHTML;
		const pageMatch = html.match(/\b(i-[a-f0-9]{8,17})\b/);
		return pageMatch ? pageMatch[1] : null;
	}

	// Enhanced field extraction helper using AWS data-analytics structure
	function extractFieldByLabel(activeDoc, labelText) {
		// Try data-analytics attribute first
		const labelElement = activeDoc.querySelector(
			`[data-analytics="label-for-${labelText}"]`,
		);
		if (labelElement) {
			const parentDiv =
				labelElement.closest(".awsui_grid-column_14yj0_16am7_186") ||
				labelElement.closest('[class*="grid-column"]') ||
				labelElement.parentElement?.parentElement;
			if (parentDiv) {
				const copySpan =
					parentDiv.querySelector(
						".awsui_text-to-copy_ljpwc_30z5b_9",
					) || parentDiv.querySelector('[class*="text-to-copy"]');
				if (copySpan) {
					const value = copySpan.textContent?.trim();
					if (value && value !== "–" && value !== "-") return value;
				}
				const valueDiv = parentDiv.querySelector("div:last-child");
				if (valueDiv && valueDiv !== labelElement.parentElement) {
					let value = valueDiv.textContent?.trim();
					if (value && value !== "–" && value !== "-") {
						const labelTxt = labelElement.textContent?.trim();
						if (labelTxt && value.startsWith(labelTxt)) {
							value = value.substring(labelTxt.length).trim();
						}
						return value;
					}
				}
			}
		}

		// Try copy-to-clipboard pattern
		const copyElement = activeDoc.querySelector(
			`[data-analytics="copy-to-clipboard-${labelText}"] [class*="text-to-copy"]`,
		);
		if (copyElement) {
			const value = copyElement.textContent?.trim();
			if (value && value !== "–" && value !== "-") return value;
		}

		return null;
	}

	// Extract all fields from Details tab - COMPREHENSIVE
	async function extractDetailsTabData(activeDoc) {
		const pageText = activeDoc.body.textContent || "";
		const details = {
			// Instance Identification
			instanceId: getInstanceId(),
			name: "N/A",

			// Instance State & Type
			instanceState: "N/A",
			instanceType: "N/A",

			// Placement
			availabilityZone: "N/A",
			tenancy: "N/A",
			placementGroup: "N/A",
			partitionNumber: "N/A",
			hostId: "N/A",
			affinityRule: "N/A",

			// AMI Information
			amiId: "N/A",
			amiName: "N/A",
			amiLocation: "N/A",

			// Platform & OS
			platform: "N/A",
			platformDetails: "N/A",
			os: "N/A",
			osVersion: "N/A",

			// Launch & Lifecycle
			launchTime: "N/A",
			lifecycle: "N/A",
			stopProtection: "N/A",
			terminationProtection: "N/A",

			// Monitoring
			monitoring: "N/A",

			// Hardware
			architecture: "N/A",
			virtualizationType: "N/A",

			// CPU Options
			cpuCoreCount: "N/A",
			cpuThreadsPerCore: "N/A",
			cpuOptions: "N/A",

			// Nitro Enclave
			nitroEnclave: "N/A",

			// Hibernation
			hibernation: "N/A",

			// Boot Mode
			bootMode: "N/A",

			// License
			usageBillingCode: "N/A",
			usageOperation: "N/A",

			// Capacity Reservation
			capacityReservationId: "N/A",
			capacityReservationPreference: "N/A",

			// Instance Metadata Options
			metadataAccessible: "N/A",
			metadataVersion: "N/A",
			metadataTokenResponse: "N/A",
			metadataTags: "N/A",

			// Elastic Inference
			elasticInferenceAccelerator: "N/A",

			// Elastic GPU
			elasticGpuId: "N/A",

			// Host Resource Group
			hostResourceGroup: "N/A",

			// Auto-Scaling
			autoScalingGroup: "N/A",

			// Key Pair
			keyPair: "N/A",

			// Owner
			ownerId: "N/A",
			reservationId: "N/A",

			// Credit Specification (for T instances)
			creditSpecification: "N/A",

			// Maintenance
			maintenanceStatus: "N/A",

			// State Transition
			stateTransitionReason: "N/A",
			stateTransitionTime: "N/A",

			// Network basics
			vpcId: "N/A",
			subnetId: "N/A",
			publicIpv4: "N/A",
			privateIpv4: "N/A",
			publicIpv6: "N/A",
			privateIpv6: "N/A",
			securityGroups: "N/A",

			// DNS & Networking (new fields)
			publicDns: "N/A",
			hostnameType: "N/A",
			privateIpDns: "N/A",
			answerPrivateDnsName: "N/A",
			elasticIp: "N/A",
			autoAssignedIp: "N/A",

			// Instance ARN & Identifiers
			instanceArn: "N/A",

			// Storage
			rootDeviceName: "N/A",
			rootDeviceType: "N/A",
			ebsOptimized: "N/A",

			// Status Checks
			systemStatusCheck: "N/A",
			instanceStatusCheck: "N/A",

			// Management
			managed: "N/A",
			operator: "N/A",
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
					!nameEl.textContent.includes("Instance")
				) {
					const nameText = nameEl.textContent.trim();
					const nameMatch = nameText.match(/\(([^)]+)\)$/);
					if (nameMatch) {
						details.name = nameMatch[1];
					} else if (!nameText.includes("summary")) {
						details.name = nameText;
					}
					break;
				}
			}

			// Map of field labels to property names
			const fieldMappings = [
				["Instance state", "instanceState"],
				["Instance type", "instanceType"],
				["Availability Zone", "availabilityZone"],
				["Tenancy", "tenancy"],
				["Placement group", "placementGroup"],
				["Partition number", "partitionNumber"],
				["Host ID", "hostId"],
				["Affinity", "affinityRule"],
				["AMI ID", "amiId"],
				["AMI name", "amiName"],
				["AMI location", "amiLocation"],
				["Platform", "platform"],
				["Platform details", "platformDetails"],
				["Launch time", "launchTime"],
				["Lifecycle", "lifecycle"],
				["Stop protection", "stopProtection"],
				["Termination protection", "terminationProtection"],
				["Monitoring", "monitoring"],
				["Architecture", "architecture"],
				["Virtualization type", "virtualizationType"],
				["Number of vCPUs", "cpuCoreCount"],
				["Threads per core", "cpuThreadsPerCore"],
				["CPU options", "cpuOptions"],
				["Nitro Enclave", "nitroEnclave"],
				["Hibernation", "hibernation"],
				["Boot mode", "bootMode"],
				["Usage billing code", "usageBillingCode"],
				["Usage operation", "usageOperation"],
				["Capacity Reservation ID", "capacityReservationId"],
				[
					"Capacity Reservation preference",
					"capacityReservationPreference",
				],
				["Metadata accessible", "metadataAccessible"],
				["IMDSv2", "metadataVersion"],
				["Metadata response hop limit", "metadataTokenResponse"],
				["Allow tags in metadata", "metadataTags"],
				[
					"Elastic Inference accelerator",
					"elasticInferenceAccelerator",
				],
				["Elastic GPU ID", "elasticGpuId"],
				["Host resource group", "hostResourceGroup"],
				["Auto Scaling group", "autoScalingGroup"],
				["Key pair assigned at launch", "keyPair"],
				["Owner ID", "ownerId"],
				["Reservation ID", "reservationId"],
				["Credit specification", "creditSpecification"],
				["Scheduled events", "maintenanceStatus"],
				["State transition reason", "stateTransitionReason"],
				["State transition message", "stateTransitionTime"],
				["VPC ID", "vpcId"],
				["Subnet ID", "subnetId"],
				["Public IPv4 address", "publicIpv4"],
				["Private IPv4 addresses", "privateIpv4"],
				["IPv6 addresses", "publicIpv6"],
				// DNS & Networking fields
				["Public DNS", "publicDns"],
				["Hostname type", "hostnameType"],
				["private-IP-DNS", "privateIpDns"],
				["Answer private resource DNS name", "answerPrivateDnsName"],
				["elasticIP_field", "elasticIp"],
				["autoAssignedIP_field", "autoAssignedIp"],
				// Instance identifiers
				["instance-arn", "instanceArn"],
				["owner-id", "ownerId"],
				// Storage
				["root-device-name", "rootDeviceName"],
				["Root device type", "rootDeviceType"],
				["EBS optimization", "ebsOptimized"],
				// Status checks
				["System status check", "systemStatusCheck"],
				["Instance status check", "instanceStatusCheck"],
				// Management
				["Managed", "managed"],
				["Operator", "operator"],
				["Auto Scaling Group name", "autoScalingGroup"],
			];

			// Extract each field
			for (const [label, prop] of fieldMappings) {
				const value = extractFieldByLabel(activeDoc, label);
				if (value) {
					let cleanValue = value
						.replace(new RegExp(`^${label}`, "i"), "")
						.trim();
					cleanValue = cleanValue.replace(/\s*\|.*$/, "").trim();
					if (
						cleanValue &&
						cleanValue !== "–" &&
						cleanValue !== "-"
					) {
						details[prop] = cleanValue;
					}
				}
			}

			// Extract security groups
			const sgMatches = pageText.match(/\bsg-[a-f0-9]+\b/g);
			if (sgMatches && sgMatches.length > 0) {
				details.securityGroups = [...new Set(sgMatches)].join(", ");
			}

			// Extract OS from AMI name patterns
			if (details.amiName && details.amiName !== "N/A") {
				const osMatch = details.amiName.match(
					/(ubuntu|centos|rhel|amazon|windows|debian|suse|fedora)[\w\-]*[\-\/]?(\d+[\.]?\d*|jammy|focal|bionic)?/i,
				);
				if (osMatch) {
					details.os =
						osMatch[1].charAt(0).toUpperCase() +
						osMatch[1].slice(1).toLowerCase();
					if (osMatch[2]) {
						let version = osMatch[2];
						if (version === "jammy") version = "22.04";
						else if (version === "focal") version = "20.04";
						else if (version === "bionic") version = "18.04";
						details.osVersion = version;
					}
				}
			}

			// Extract IP addresses as fallback
			const ipData = extractIPs(pageText);
			if (!details.publicIpv4 || details.publicIpv4 === "N/A") {
				details.publicIpv4 = ipData.publicIpv4 || "N/A";
			}
			if (!details.privateIpv4 || details.privateIpv4 === "N/A") {
				details.privateIpv4 = ipData.privateIpv4 || "N/A";
			}
			if (ipData.publicIpv6) details.publicIpv6 = ipData.publicIpv6;
			if (ipData.privateIpv6) details.privateIpv6 = ipData.privateIpv6;
		} catch (error) {
			console.error("Error extracting details tab:", error);
		}

		return details;
	}

	// Extract Security tab data - COMPREHENSIVE
	async function extractSecurityTabData(activeDoc) {
		const securityData = {
			securityGroups: [],
			securityGroupNames: [],
			inboundRules: [],
			outboundRules: [],
			iamRole: "N/A",
			iamInstanceProfile: "N/A",
		};

		try {
			const pageText = activeDoc.body.textContent || "";

			// Extract security groups from links
			const sgLinks = activeDoc.querySelectorAll(
				'a[data-analytics="security-groups-link"], a[href*="SecurityGroupId"]',
			);
			sgLinks.forEach((link) => {
				const text = link.textContent?.trim();
				const match = text?.match(/^(sg-[a-f0-9]+)\s*\((.+)\)$/);
				if (match) {
					securityData.securityGroups.push(match[1]);
					securityData.securityGroupNames.push(
						`${match[1]} (${match[2]})`,
					);
				} else if (text?.match(/^sg-[a-f0-9]+/)) {
					securityData.securityGroups.push(text);
					securityData.securityGroupNames.push(text);
				}
			});

			// Extract IAM Role
			const iamRole = extractFieldByLabel(activeDoc, "IAM Role");
			if (iamRole)
				securityData.iamRole = iamRole.replace(/^IAM Role/i, "").trim();

			// Extract IAM instance profile
			const iamProfile = extractFieldByLabel(
				activeDoc,
				"IAM instance profile",
			);
			if (iamProfile)
				securityData.iamInstanceProfile = iamProfile
					.replace(/^IAM instance profile/i, "")
					.trim();

			// Wait for security rules tables to load
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Extract inbound rules
			const inboundTable = activeDoc.querySelector(
				'[data-analytics="inbound-rules"] table tbody',
			);
			if (inboundTable) {
				const rows = inboundTable.querySelectorAll("tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 5) {
						const getCellText = (idx) => {
							const cell = cells[idx];
							if (!cell) return "";
							const content = cell.querySelector(
								'[class*="body-cell-content"]',
							);
							return (
								content?.textContent?.trim() ||
								cell.textContent?.trim() ||
								""
							);
						};

						const rule = {
							type: "inbound",
							securityGroupRule: getCellText(0),
							ipVersion: getCellText(1),
							port: getCellText(2),
							protocol: getCellText(3),
							source: getCellText(4),
							securityGroupId: getCellText(5),
							description: getCellText(6),
						};
						if (rule.port && rule.port !== "–") {
							securityData.inboundRules.push(rule);
						}
					}
				});
			}

			// Extract outbound rules
			const outboundTable = activeDoc.querySelector(
				'[data-analytics="outbound-rules"] table tbody',
			);
			if (outboundTable) {
				const rows = outboundTable.querySelectorAll("tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 5) {
						const getCellText = (idx) => {
							const cell = cells[idx];
							if (!cell) return "";
							const content = cell.querySelector(
								'[class*="body-cell-content"]',
							);
							return (
								content?.textContent?.trim() ||
								cell.textContent?.trim() ||
								""
							);
						};

						const rule = {
							type: "outbound",
							securityGroupRule: getCellText(0),
							ipVersion: getCellText(1),
							port: getCellText(2),
							protocol: getCellText(3),
							destination: getCellText(4),
							securityGroupId: getCellText(5),
							description: getCellText(6),
						};
						if (rule.port && rule.port !== "–") {
							securityData.outboundRules.push(rule);
						}
					}
				});
			}
		} catch (error) {
			console.error("Error extracting security tab:", error);
		}

		return securityData;
	}

	// Extract Networking tab data - COMPREHENSIVE
	async function extractNetworkingTabData(activeDoc) {
		const networkingData = {
			vpcId: "N/A",
			subnetId: "N/A",
			publicDnsName: "N/A",
			privateDnsName: "N/A",
			privateDnsNameOptions: "N/A",
			publicIpv4: "N/A",
			privateIpv4: "N/A",
			secondaryPrivateIps: [],
			autoAssignPublicIp: "N/A",
			ipv6Addresses: [],
			elasticIpAddress: "N/A",
			elasticIpAllocationId: "N/A",
			networkInterfaces: [],
			primaryNetworkInterface: "N/A",
			securityGroups: [],
			sourceDestCheck: "N/A",
			outpostArn: "N/A",
		};

		try {
			// Extract VPC ID
			const vpcElement = activeDoc.querySelector(
				'[data-analytics="copy-to-clipboard-vpc-id"] [class*="text-to-copy"]',
			);
			if (vpcElement)
				networkingData.vpcId = vpcElement.textContent?.trim() || "N/A";

			// Extract Subnet ID
			const subnetElement = activeDoc.querySelector(
				'[data-analytics="copy-to-clipboard-subnet-id"] [class*="text-to-copy"]',
			);
			if (subnetElement)
				networkingData.subnetId =
					subnetElement.textContent?.trim() || "N/A";

			// Field extractions
			const fieldMappings = [
				["Public IPv4 DNS", "publicDnsName"],
				["Private IPv4 DNS", "privateDnsName"],
				["Public IPv4 address", "publicIpv4"],
				["Private IPv4 addresses", "privateIpv4"],
				["IPv6 addresses", "ipv6Addresses"],
				["Elastic IP addresses", "elasticIpAddress"],
				["Auto-assign public IP", "autoAssignPublicIp"],
				["Source/dest. check", "sourceDestCheck"],
				["Primary network interface", "primaryNetworkInterface"],
				["Outpost ARN", "outpostArn"],
			];

			for (const [label, prop] of fieldMappings) {
				const value = extractFieldByLabel(activeDoc, label);
				if (value) {
					let cleanValue = value
						.replace(new RegExp(`^${label}`, "i"), "")
						.trim();
					cleanValue = cleanValue.replace(/\s*\|.*$/, "").trim();
					if (
						cleanValue &&
						cleanValue !== "–" &&
						cleanValue !== "-"
					) {
						networkingData[prop] = cleanValue;
					}
				}
			}

			// Extract network interfaces from table
			const eniTable = activeDoc.querySelector(
				'[data-testid="network-interfaces-table"] table tbody',
			);
			if (eniTable) {
				const rows = eniTable.querySelectorAll("tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						const eni = {
							id: cells[0]?.textContent?.trim() || "",
							description: cells[1]?.textContent?.trim() || "",
							status: cells[2]?.textContent?.trim() || "",
							privateIp: cells[3]?.textContent?.trim() || "",
							publicIp: cells[4]?.textContent?.trim() || "",
							subnetId: cells[5]?.textContent?.trim() || "",
							vpcId: cells[6]?.textContent?.trim() || "",
						};
						if (eni.id) networkingData.networkInterfaces.push(eni);
					}
				});
			}

			// Extract security groups
			const pageText = activeDoc.body.textContent || "";
			const sgMatches = pageText.match(/\bsg-[a-f0-9]+\b/g);
			if (sgMatches)
				networkingData.securityGroups = [...new Set(sgMatches)];

			// Extract ENI IDs
			const eniMatches = pageText.match(/\beni-[a-f0-9]+\b/g);
			if (eniMatches && networkingData.networkInterfaces.length === 0) {
				networkingData.networkInterfaces = [...new Set(eniMatches)].map(
					(id) => ({ id }),
				);
			}
		} catch (error) {
			console.error("Error extracting networking tab:", error);
		}

		return networkingData;
	}

	// Extract Storage tab data - COMPREHENSIVE
	async function extractStorageTabData(activeDoc) {
		const storageData = {
			rootDeviceName: "N/A",
			rootDeviceType: "N/A",
			ebsOptimized: "N/A",
			blockDevices: [],
			totalStorageGiB: 0,
		};

		try {
			// Extract root device info
			const rootDeviceName = extractFieldByLabel(
				activeDoc,
				"Root device name",
			);
			if (rootDeviceName) storageData.rootDeviceName = rootDeviceName;

			const rootDeviceType = extractFieldByLabel(
				activeDoc,
				"Root device type",
			);
			if (rootDeviceType) storageData.rootDeviceType = rootDeviceType;

			const ebsOptimized = extractFieldByLabel(
				activeDoc,
				"EBS optimization",
			);
			if (ebsOptimized) storageData.ebsOptimized = ebsOptimized;

			// Extract block devices from table
			const blockDevicesTable = activeDoc.querySelector(
				'[data-testid="block-devices-table"] table tbody',
			);
			if (blockDevicesTable) {
				const rows = blockDevicesTable.querySelectorAll("tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						const device = {
							deviceName: "",
							volumeId: "",
							volumeType: "",
							size: "",
							iops: "",
							throughput: "",
							encrypted: "",
							kmsKeyId: "",
							deleteOnTermination: "",
							attachmentStatus: "",
							attachmentTime: "",
						};

						cells.forEach((cell) => {
							const content =
								cell
									.querySelector(
										'[class*="body-cell-content"]',
									)
									?.textContent?.trim() ||
								cell.textContent?.trim() ||
								"";

							const volMatch = content.match(/vol-[a-f0-9]+/);
							if (volMatch) device.volumeId = volMatch[0];

							const sizeMatch = content.match(/(\d+)\s*GiB/i);
							if (sizeMatch) {
								device.size = sizeMatch[1] + " GiB";
								storageData.totalStorageGiB += parseInt(
									sizeMatch[1],
								);
							}

							const typeMatch = content.match(
								/\b(gp2|gp3|io1|io2|st1|sc1|standard)\b/i,
							);
							if (typeMatch) device.volumeType = typeMatch[1];

							if (content.includes("/dev/"))
								device.deviceName = content;
							if (content === "Yes" || content === "No")
								device.deleteOnTermination = content;
							if (
								content === "Attached" ||
								content === "Detached"
							)
								device.attachmentStatus = content;
						});

						if (device.volumeId || device.deviceName) {
							storageData.blockDevices.push(device);
						}
					}
				});
			}

			// Extract volume IDs from page as fallback
			if (storageData.blockDevices.length === 0) {
				const pageText = activeDoc.body.textContent || "";
				const volMatches = pageText.match(/\bvol-[a-f0-9]+\b/g);
				if (volMatches) {
					storageData.blockDevices = [...new Set(volMatches)].map(
						(id) => ({ volumeId: id }),
					);
				}
			}
		} catch (error) {
			console.error("Error extracting storage tab:", error);
		}

		return storageData;
	}

	// Extract Tags tab data - COMPREHENSIVE
	async function extractTagsTabData(activeDoc) {
		const tagsData = {
			tags: {},
			tagCount: 0,
			managedTags: [],
		};

		try {
			const table = activeDoc.querySelector("table");
			if (!table) {
				return tagsData;
			}

			const tagRows = table.querySelectorAll("tbody tr");
			tagRows.forEach((row) => {
				const cells = row.querySelectorAll("td");
				if (cells.length >= 2) {
					const keyDiv = cells[0]?.querySelector(
						'[class*="body-cell-content"]',
					);
					const valueDiv = cells[1]?.querySelector(
						'[class*="body-cell-content"]',
					);
					const key =
						keyDiv?.textContent?.trim() ||
						cells[0]?.textContent?.trim();
					const value =
						valueDiv?.textContent?.trim() ||
						cells[1]?.textContent?.trim();

					if (key && key !== "Key" && key.length > 0) {
						tagsData.tags[key] = value || "";
						if (key.startsWith("aws:")) {
							tagsData.managedTags.push({ key, value });
						}
					}
				}
			});

			tagsData.tagCount = Object.keys(tagsData.tags).length;
		} catch (error) {
			console.error("Error extracting tags tab:", error);
		}

		return tagsData;
	}

	// Click a tab by test ID
	async function clickTab(activeDoc, tabName) {
		try {
			const tab = activeDoc.querySelector(`[data-testid="${tabName}"]`);
			if (tab) {
				const isActive = tab.getAttribute("aria-selected") === "true";
				if (!isActive) {
					tab.click();
					await new Promise((resolve) => setTimeout(resolve, 2500));
				}
				return true;
			}
		} catch (e) {
			console.error(`Error clicking tab ${tabName}:`, e);
		}
		return false;
	}

	// Comprehensive tab extraction
	async function extractAllTabsData(instanceId) {
		const activeDoc = getActiveDocument();
		const allData = {
			details: {},
			security: {},
			networking: {},
			storage: {},
			tags: {},
		};

		const tabs = [
			{
				name: "details",
				testId: "details",
				extractor: extractDetailsTabData,
			},
			{
				name: "security",
				testId: "security",
				extractor: extractSecurityTabData,
			},
			{
				name: "networking",
				testId: "networking",
				extractor: extractNetworkingTabData,
			},
			{
				name: "storage",
				testId: "storage",
				extractor: extractStorageTabData,
			},
			{ name: "tags", testId: "tags", extractor: extractTagsTabData },
		];

		for (const tab of tabs) {
			try {
				await clickTab(activeDoc, tab.testId);
				allData[tab.name] = await tab.extractor(activeDoc);
			} catch (error) {
				console.error(`Error extracting ${tab.name} tab:`, error);
			}
		}

		return allData;
	}

	// Main extraction function
	async function extractInstanceDetails() {
		const instanceId = getInstanceId();
		if (!instanceId) return null;

		try {
			const allTabsData = await extractAllTabsData(instanceId);
			const region = extractRegionInfo();

			// Combine all data
			const details = {
				instanceId,
				service: "ec2",
				region,
				...allTabsData.details,
				security: allTabsData.security,
				networking: allTabsData.networking,
				storage: allTabsData.storage,
				tags: allTabsData.tags,
				tabsData: allTabsData,
			};

			// Enhance with cross-tab data
			if (
				(!details.name || details.name === "N/A") &&
				allTabsData.tags?.tags?.Name
			) {
				details.name = allTabsData.tags.tags.Name;
			}

			// Merge security groups
			if (allTabsData.security?.securityGroupNames?.length > 0) {
				details.securityGroups =
					allTabsData.security.securityGroupNames.join(", ");
			}

			// Merge security rules for email
			details.securityGroupRules = [
				...(allTabsData.security?.inboundRules || []),
				...(allTabsData.security?.outboundRules || []),
			];

			// Merge IAM info
			details.iamRole = allTabsData.security?.iamRole;
			details.iamInstanceProfile =
				allTabsData.security?.iamInstanceProfile;

			// Merge network data
			if (allTabsData.networking) {
				if (!details.vpcId || details.vpcId === "N/A") {
					details.vpcId = allTabsData.networking.vpcId;
				}
				if (!details.subnetId || details.subnetId === "N/A") {
					details.subnetId = allTabsData.networking.subnetId;
				}
				if (!details.publicIpv4 || details.publicIpv4 === "N/A") {
					details.publicIpv4 = allTabsData.networking.publicIpv4;
				}
				if (!details.privateIpv4 || details.privateIpv4 === "N/A") {
					details.privateIpv4 = allTabsData.networking.privateIpv4;
				}
				details.publicDnsName = allTabsData.networking.publicDnsName;
				details.privateDnsName = allTabsData.networking.privateDnsName;
				details.elasticIpAddress =
					allTabsData.networking.elasticIpAddress;
			}

			// Merge storage data
			if (allTabsData.storage) {
				details.rootDevice = allTabsData.storage.rootDeviceName;
				details.rootDeviceType = allTabsData.storage.rootDeviceType;
				details.ebsOptimization = allTabsData.storage.ebsOptimized;
				details.ebs = allTabsData.storage.blockDevices
					.map((d) => d.volumeId)
					.join(", ");
				details.totalStorageGiB = allTabsData.storage.totalStorageGiB;
			}

			return details;
		} catch (error) {
			console.error("Error extracting instance details:", error);
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

		button.addEventListener("mouseenter", () => {
			button.style.background = "#E68900";
		});

		button.addEventListener("mouseleave", () => {
			button.style.background = "#FF9900";
		});

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
		const originalContent = button.innerHTML;
		button.innerHTML = `
			<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; animation: spin 1s linear infinite;">
				<path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
			</svg>
		`;
		button.disabled = true;

		if (!document.getElementById("spin-animation")) {
			const style = document.createElement("style");
			style.id = "spin-animation";
			style.textContent =
				"@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
			document.head.appendChild(style);
		}

		try {
			const details = await extractInstanceDetails();
			if (!details) throw new Error("Could not extract instance details");

			const accountInfo = extractAccountInfo();
			let subject = "🚀 AWS EC2 Instance Details";
			if (details.name && details.name !== details.instanceId) {
				subject = `🚀 ${details.name} - AWS EC2 Instance`;
			}
			if (details.instanceState && details.instanceState !== "N/A") {
				subject += ` [${details.instanceState.toUpperCase()}]`;
			}

			// Use compact body for URL to avoid 400 errors, full body for clipboard fallback
			const compactBody = buildEmailBody(details, accountInfo, true);
			const fullBody = buildEmailBody(details, accountInfo, false);
			openComposer(subject, compactBody, fullBody);
		} catch (error) {
			console.error("EC2 Share Error:", error);
			button.innerHTML = `
				<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
					<path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/>
				</svg>
			`;
			setTimeout(() => {
				button.innerHTML = originalContent;
			}, 2000);
		} finally {
			button.innerHTML = originalContent;
			button.disabled = false;
		}
	}

	// Initialize
	async function initialize() {
		if (!isEC2Service()) return;

		await new Promise((resolve) => {
			if (document.readyState === "complete") {
				setTimeout(resolve, 1500);
			} else {
				window.addEventListener("load", () =>
					setTimeout(resolve, 1500),
				);
			}
		});

		const instanceId = getInstanceId();
		if (!instanceId) return;

		createFloatingButton(instanceId);
	}

	// Message listener
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

	// Initialize
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize);
	} else {
		initialize();
	}

	// Monitor for navigation changes
	const observer = new MutationObserver(() => {
		if (isEC2Service() && !buttonExists) {
			initialize();
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });

	let currentUrl = window.location.href;
	setInterval(() => {
		if (window.location.href !== currentUrl) {
			currentUrl = window.location.href;
			buttonExists = false;
			initialize();
		}
	}, 2000);
})();
