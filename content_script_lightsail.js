// content_script_lightsail.js - Comprehensive Lightsail instance details extraction
(() => {
	if (!window.awsExtension) {
		console.error("AWS Extension common utilities not loaded");
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

	// Track which elements already have buttons
	const elementsWithButtons = new WeakSet();
	let buttonCreationInProgress = false;
	let lastButtonCreationTime = 0;

	// Detect if we're on Lightsail service
	function detectLightsailService() {
		const url = window.location.href;
		const hostname = window.location.hostname;
		return (
			url.includes("lightsail.aws.amazon.com") ||
			hostname.includes("lightsail")
		);
	}

	// Get instance name from URL
	function getInstanceName() {
		const url = window.location.href;
		const match = url.match(/\/instances\/([^\/\?#]+)/);
		return match ? decodeURIComponent(match[1]) : null;
	}

	// Get region from URL
	function getRegion() {
		const url = window.location.pathname;
		const match = url.match(/\/ls\/webapp\/([^\/]+)\//);
		return match ? match[1] : extractRegionInfo() || "us-east-1";
	}

	// Create floating share button
	function createFloatingButton() {
		if (
			document.querySelector(".aws-lightsail-floating-button") ||
			document.querySelector(
				`.${BUTTON_CLASS}[data-service="lightsail"]`,
			) ||
			elementsWithButtons.has(document.body)
		) {
			return;
		}

		const floatingButton = document.createElement("button");
		floatingButton.className = `aws-lightsail-floating-button ${BUTTON_CLASS}`;
		floatingButton.style.cssText = `
			position: fixed;
			top: 50%;
			right: 0;
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

		floatingButton.innerHTML = `
			<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
				<path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
			</svg>
		`;

		floatingButton.setAttribute("data-service", "lightsail");
		floatingButton.setAttribute("title", "Share Lightsail Instance");

		floatingButton.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			handleShare(floatingButton);
		});

		floatingButton.addEventListener("mouseenter", () => {
			floatingButton.style.background = "#E68900";
		});

		floatingButton.addEventListener("mouseleave", () => {
			floatingButton.style.background = "#FF9900";
		});

		document.body.appendChild(floatingButton);
		elementsWithButtons.add(document.body);
	}

	// Extract Connect tab data - COMPREHENSIVE
	async function extractConnectTabData() {
		const connectData = {
			// Instance Info
			instanceName: getInstanceName(),
			state: "N/A",
			availabilityZone: "N/A",

			// Blueprint/OS
			blueprint: "N/A",
			blueprintId: "N/A",
			os: "N/A",
			osVersion: "N/A",

			// Bundle/Plan
			bundle: "N/A",
			bundleId: "N/A",
			ram: "N/A",
			vcpus: "N/A",
			storage: "N/A",
			transferAllowance: "N/A",

			// Instance Type
			instanceType: "N/A",
			networkingType: "N/A",

			// SSH/RDP Access
			sshKeyName: "N/A",
			sshUser: "N/A",
			connectUrl: "N/A",

			// Network (from connect tab)
			publicIpv4: "N/A",
			privateIpv4: "N/A",
			publicIpv6: "N/A",
			isStaticIp: false,

			// Support
			supportCode: "N/A",

			// Launch Time
			createdAt: "N/A",

			// Hardware
			hardwareInfo: "N/A",
		};

		try {
			const pageText = document.body.textContent || "";

			// Extract instance state
			const statusElement = document.querySelector(
				'[data-testid="ls.instanceStatus.running"], [data-testid="ls.instanceStatus.stopped"], [aria-live="polite"] span[data-testid*="instanceStatus"]',
			);
			if (statusElement) {
				connectData.state =
					statusElement.textContent?.trim() || "Unknown";
			} else {
				const stateMatch = pageText.match(
					/\b(running|stopped|pending|stopping|starting|rebooting)\b/i,
				);
				if (stateMatch) connectData.state = stateMatch[0];
			}

			// Extract blueprint information
			const blueprintElement = document.querySelector(
				'h2 .awsui_heading-text_105ke_268sp_5 div, img[alt*="ubuntu"] + div, img[alt*="Ubuntu"] + div, [data-testid*="blueprint"]',
			);
			if (blueprintElement) {
				connectData.blueprint = blueprintElement.textContent?.trim();
				connectData.os = connectData.blueprint;

				// Extract version
				const versionMatch =
					connectData.blueprint?.match(/(\d+\.?\d*)/);
				if (versionMatch) {
					connectData.osVersion = `${connectData.os?.split(" ")[0]} ${versionMatch[0]}`;
				}
			}

			// Extract bundle details
			const bundleElement = document.querySelector(
				'[data-testid="ls.bundleDetailsDisplay.messageFormat"]',
			);
			if (bundleElement) {
				connectData.bundle = bundleElement.textContent?.trim();

				const ramMatch =
					bundleElement.textContent?.match(/(\d+)\s*GB\s*RAM/i);
				if (ramMatch) connectData.ram = ramMatch[1] + " GB";

				const cpuMatch =
					bundleElement.textContent?.match(/(\d+)\s*vCPUs?/i);
				if (cpuMatch) connectData.vcpus = cpuMatch[1];

				const storageMatch =
					bundleElement.textContent?.match(/(\d+)\s*GB\s*SSD/i);
				if (storageMatch)
					connectData.storage = storageMatch[1] + " GB SSD";

				const transferMatch = bundleElement.textContent?.match(
					/(\d+)\s*TB\s*Transfer/i,
				);
				if (transferMatch)
					connectData.transferAllowance = transferMatch[1] + " TB";
			}

			// Extract SSH key name
			const sshKeyElement = document.querySelector(
				'[data-testid="instances.descriptions.customKeySummary"] strong',
			);
			if (sshKeyElement) {
				connectData.sshKeyName = sshKeyElement.textContent?.trim();
			}

			// Extract SSH user
			const sshUserPatterns = [
				/SSH\s+using\s+user\s+name[:\s]+([a-z_][a-z0-9_-]*)/i,
				/Username[:\s]+([a-z_][a-z0-9_-]*)/i,
			];
			for (const pattern of sshUserPatterns) {
				const match = pageText.match(pattern);
				if (match) {
					connectData.sshUser = match[1];
					break;
				}
			}

			// Infer SSH user from OS
			if (connectData.sshUser === "N/A" && connectData.os !== "N/A") {
				const osLower = connectData.os.toLowerCase();
				if (osLower.includes("ubuntu")) connectData.sshUser = "ubuntu";
				else if (
					osLower.includes("amazon") ||
					osLower.includes("linux")
				)
					connectData.sshUser = "ec2-user";
				else if (osLower.includes("centos"))
					connectData.sshUser = "centos";
				else if (osLower.includes("debian"))
					connectData.sshUser = "admin";
				else if (osLower.includes("bitnami"))
					connectData.sshUser = "bitnami";
				else connectData.sshUser = "admin";
			}

			// Extract connect URL
			const connectLink = document.querySelector(
				'a[href*="/remote/"][href*="/terminal"]',
			);
			if (connectLink) {
				connectData.connectUrl = connectLink.href;
			}

			// Extract availability zone
			const azMatch = pageText.match(/([a-z]{2}-[a-z]+-\d[a-z])/);
			if (azMatch) connectData.availabilityZone = azMatch[1];

			// Extract IPs from page
			const ipData = extractIPs(pageText);
			if (ipData.publicIpv4) connectData.publicIpv4 = ipData.publicIpv4;
			if (ipData.privateIpv4)
				connectData.privateIpv4 = ipData.privateIpv4;

			// Extract support code
			const supportCodeMatch = pageText.match(
				/Support\s*code[:\s]+([a-zA-Z0-9\-\/]+)/i,
			);
			if (supportCodeMatch) connectData.supportCode = supportCodeMatch[1];

			// Extract created time
			const createdMatch = pageText.match(
				/Created[:\s]+([A-Za-z]+\s+\d+,\s+\d{4})/i,
			);
			if (createdMatch) connectData.createdAt = createdMatch[1];

			// Extract instance type (General purpose, etc.)
			const instanceTypeElement = document.querySelector(
				'[data-testid="instances.descriptions.generalPurpose"], [data-testid*="instances.descriptions"]',
			);
			if (instanceTypeElement) {
				connectData.instanceType =
					instanceTypeElement.textContent?.trim();
			}

			// Extract networking type (Dual-stack, IPv4, etc.)
			const networkTypeElement = document.querySelector(
				'[data-testid="instances.labels.networkTypeDualStack"], [data-testid*="networkType"]',
			);
			if (networkTypeElement) {
				connectData.networkingType =
					networkTypeElement.textContent?.trim();
			}

			// Extract Static IP from main page
			const staticIpLabel = document.querySelector(
				'[data-testid="instances.label.staticIpAddress"]',
			);
			if (staticIpLabel) {
				const container =
					staticIpLabel.closest(".awsui_child_18582_fnxoq_149") ||
					staticIpLabel.parentElement?.parentElement;
				if (container) {
					const ipText = container.textContent
						?.replace("Static IP address", "")
						?.trim();
					const ipMatch = ipText?.match(
						/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/,
					);
					if (ipMatch) {
						connectData.publicIpv4 = ipMatch[1];
						connectData.isStaticIp = true;
					}
				}
			}

			// Extract Private IPv4 from main page
			const privateIpLabel = document.querySelector(
				'[data-testid="instances.label.privateIpAddress"]',
			);
			if (privateIpLabel) {
				const container =
					privateIpLabel.closest(
						'[data-analytics="button-copy-private-ipv4-address"]',
					) || privateIpLabel.parentElement?.parentElement;
				if (container) {
					const copyElement =
						container.querySelector(
							".awsui_text-to-copy_ljpwc_30z5b_9",
						) || container.querySelector('[class*="text-to-copy"]');
					if (copyElement) {
						connectData.privateIpv4 =
							copyElement.textContent?.trim();
					}
				}
			}

			// Extract Public IPv6 from main page
			const publicIpv6Label = document.querySelector(
				'[data-testid="instances.label.staticIpv6Address"]',
			);
			if (publicIpv6Label) {
				const container =
					publicIpv6Label.closest(
						'[data-analytics="button-copy-public-ipv6"]',
					) || publicIpv6Label.parentElement?.parentElement;
				if (container) {
					const copyElement =
						container.querySelector(
							".awsui_text-to-copy_ljpwc_30z5b_9",
						) || container.querySelector('[class*="text-to-copy"]');
					if (copyElement) {
						connectData.publicIpv6 =
							copyElement.textContent?.trim();
					}
				}
			}
		} catch (error) {
			console.error("Error extracting connect tab data:", error);
		}

		return connectData;
	}

	// Extract Storage tab data - COMPREHENSIVE
	async function extractStorageTabData() {
		const storageData = {
			// System Disk
			systemDiskSize: "N/A",
			systemDiskPath: "N/A",
			systemDiskName: "N/A",
			systemDiskType: "N/A",

			// Additional Disks
			additionalDisks: [],

			// Snapshots
			snapshots: [],
			automaticSnapshots: "N/A",

			// Total Storage
			totalStorageGiB: 0,
		};

		try {
			// Extract system disk section
			const systemDiskSection = document.querySelector(
				".integ_systemDiskSection",
			);
			if (systemDiskSection) {
				const diskSizeElement = systemDiskSection.querySelector(
					'[data-testid="ls.displayHelpersInstance.memoryInGB"]',
				);
				if (diskSizeElement) {
					storageData.systemDiskSize =
						diskSizeElement.textContent?.trim();
					const sizeMatch = storageData.systemDiskSize.match(/(\d+)/);
					if (sizeMatch)
						storageData.totalStorageGiB += parseInt(sizeMatch[1]);
				}

				const diskPathValue = systemDiskSection.querySelector(
					".DiskPathDisplay-module__selectedDiskPath strong",
				);
				if (diskPathValue)
					storageData.systemDiskPath =
						diskPathValue.textContent?.trim();

				const diskNameElement = systemDiskSection.querySelector(
					".ResourceReferenceName-module__ResourceReferenceName .TruncatedText-module__TruncatedText",
				);
				if (diskNameElement)
					storageData.systemDiskName =
						diskNameElement.textContent?.trim();

				const diskTypeElement = systemDiskSection.querySelector(
					'[data-testid="ls.diskSummaryDisplay.summary"]',
				);
				if (
					diskTypeElement &&
					diskTypeElement.textContent?.includes("block storage")
				) {
					storageData.systemDiskType = "Block Storage";
				}
			}

			// Extract additional disks
			const attachedDisksSection = document.querySelector(
				".integ_attachedDisksSection",
			);
			if (attachedDisksSection) {
				const noDisksMessage = attachedDisksSection.querySelector(
					'[data-testid="ls.instanceStorage.noAttachableDisksDescription"]',
				);
				if (!noDisksMessage) {
					const diskItems = attachedDisksSection.querySelectorAll(
						".ResourceReferenceItem-module__ResourceReferenceItem",
					);
					diskItems.forEach((diskItem) => {
						const disk = {
							name:
								diskItem
									.querySelector(
										".ResourceReferenceName-module__ResourceReferenceName",
									)
									?.textContent?.trim() || "N/A",
							size:
								diskItem
									.querySelector(
										'[data-testid*="memoryInGB"]',
									)
									?.textContent?.trim() || "N/A",
							path:
								diskItem
									.querySelector(
										".DiskPathDisplay-module__selectedDiskPath strong",
									)
									?.textContent?.trim() || "N/A",
							status:
								diskItem
									.querySelector('[data-testid*="status"]')
									?.textContent?.trim() || "Attached",
						};

						const sizeMatch = disk.size.match(/(\d+)/);
						if (sizeMatch)
							storageData.totalStorageGiB += parseInt(
								sizeMatch[1],
							);

						storageData.additionalDisks.push(disk);
					});
				}
			}

			// Check for automatic snapshots
			const autoSnapshotElement = document.querySelector(
				'[data-testid*="automaticSnapshot"], [data-testid*="autoSnapshot"]',
			);
			if (autoSnapshotElement) {
				storageData.automaticSnapshots = autoSnapshotElement.textContent
					?.trim()
					.includes("Enabled")
					? "Enabled"
					: "Disabled";
			}

			// Extract snapshot info
			const snapshotRows = document.querySelectorAll(
				'[data-testid*="snapshot"] tr, .snapshot-row',
			);
			snapshotRows.forEach((row) => {
				const cells = row.querySelectorAll("td");
				if (cells.length >= 2) {
					storageData.snapshots.push({
						name: cells[0]?.textContent?.trim() || "N/A",
						date: cells[1]?.textContent?.trim() || "N/A",
						size: cells[2]?.textContent?.trim() || "N/A",
					});
				}
			});
		} catch (error) {
			console.error("Error extracting storage tab data:", error);
		}

		return storageData;
	}

	// Extract Networking tab data - COMPREHENSIVE
	async function extractNetworkingTabData() {
		const networkingData = {
			// IPv4
			ipv4: {
				publicIp: null,
				privateIp: null,
				isStaticIp: false,
				staticIpName: null,
			},

			// IPv6
			ipv6: {
				enabled: false,
				addresses: [],
			},

			// Firewall Rules
			firewall: {
				ipv4Rules: [],
				ipv6Rules: [],
			},

			// Load Balancing
			loadBalancers: [],
			loadBalancingStatus: "N/A",

			// Distributions
			distributions: [],
			distributionStatus: "N/A",

			// DNS
			dnsRecords: [],
		};

		try {
			// Extract IPv4 public IP
			const publicIpv4Element = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.publicIp"]',
			);
			if (publicIpv4Element) {
				const ipContainer =
					publicIpv4Element.closest(".css-1fbqy03") ||
					publicIpv4Element.parentElement;
				if (ipContainer) {
					const ipElement = ipContainer.querySelector("h2");
					if (ipElement)
						networkingData.ipv4.publicIp =
							ipElement.textContent?.trim();
				}
			}

			// Extract IPv4 private IP
			const privateIpv4Element = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.privateIp"]',
			);
			if (privateIpv4Element) {
				const ipContainer =
					privateIpv4Element.closest(".css-1fbqy03") ||
					privateIpv4Element.parentElement;
				if (ipContainer) {
					const ipElement = ipContainer.querySelector("h2");
					if (ipElement)
						networkingData.ipv4.privateIp =
							ipElement.textContent?.trim();
				}
			}

			// Check for static IP
			const staticIpDescription = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.staticIpDescription"]',
			);
			if (staticIpDescription) {
				networkingData.ipv4.isStaticIp = true;
				const staticIpName = staticIpDescription.textContent?.match(
					/Static IP[:\s]+([a-zA-Z0-9_-]+)/i,
				);
				if (staticIpName)
					networkingData.ipv4.staticIpName = staticIpName[1];
			}

			// Extract IPv6 information
			const ipv6Toggle = document.querySelector(
				'[data-testid="ipv6ToggleSection"]',
			);
			if (ipv6Toggle) {
				const enabledDesc = ipv6Toggle.querySelector(
					'[data-testid="shared.ipv6Toggle.ipv6EnabledDescription"]',
				);
				if (enabledDesc) {
					networkingData.ipv6.enabled = true;
					const ipv6AddressElement = document.querySelector(
						'[data-testid="ipv6AddressDisplay"]',
					);
					if (ipv6AddressElement) {
						networkingData.ipv6.addresses.push(
							ipv6AddressElement.textContent?.trim(),
						);
					}
				}
			}

			// Wait for firewall rules to load
			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Extract IPv4 firewall rules
			const ipv4FirewallTable = document.querySelector(
				'.integ_ipv4FirewallSection table, [data-analytics*="ipv4FirewallSection"] table',
			);
			if (ipv4FirewallTable) {
				const rows = ipv4FirewallTable.querySelectorAll("tbody tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						const rule = {
							application: cells[0]?.textContent?.trim() || "",
							protocol: cells[1]?.textContent?.trim() || "",
							portRange: extractPortRange(cells[2]),
							restrictedTo:
								cells[3]?.textContent?.trim() ||
								"Any IPv4 address",
						};
						if (
							rule.application ||
							rule.protocol ||
							rule.portRange
						) {
							networkingData.firewall.ipv4Rules.push(rule);
						}
					}
				});
			}

			// Extract IPv6 firewall rules
			const ipv6FirewallTable = document.querySelector(
				'.integ_ipv6FirewallSection table, [data-analytics*="ipv6FirewallSection"] table',
			);
			if (ipv6FirewallTable) {
				const rows = ipv6FirewallTable.querySelectorAll("tbody tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						const rule = {
							application: cells[0]?.textContent?.trim() || "",
							protocol: cells[1]?.textContent?.trim() || "",
							portRange: extractPortRange(cells[2]),
							restrictedTo:
								cells[3]?.textContent?.trim() ||
								"Any IPv6 address",
						};
						if (
							rule.application ||
							rule.protocol ||
							rule.portRange
						) {
							networkingData.firewall.ipv6Rules.push(rule);
						}
					}
				});
			}

			// Extract load balancer info
			const loadBalancerSection = document.querySelector(
				'[data-testid="ls.loadBalancersSection.noLoadBalancers"]',
			);
			if (loadBalancerSection) {
				networkingData.loadBalancingStatus =
					loadBalancerSection.textContent?.trim();
			} else {
				const lbItems = document.querySelectorAll(
					'[data-testid*="loadBalancer"]',
				);
				lbItems.forEach((item) => {
					networkingData.loadBalancers.push({
						name: item.textContent?.trim(),
					});
				});
			}

			// Extract distribution info
			const distributionSection = document.querySelector(
				'[data-testid="instances.networkingDistributions.noDistributions"]',
			);
			if (distributionSection) {
				networkingData.distributionStatus =
					distributionSection.textContent?.trim();
			}
		} catch (error) {
			console.error("Error extracting networking data:", error);
		}

		return networkingData;
	}

	// Helper function to extract port range from cell
	function extractPortRange(portCell) {
		if (!portCell) return "N/A";

		// Try all div elements in the port cell
		const portDivs = portCell.querySelectorAll("div");
		for (const div of portDivs) {
			const text = div.textContent?.trim();
			if (text && /^[\d\-,\s]+$/.test(text) && text.length > 0) {
				return text;
			}
		}

		// Fallback to cell text
		const cellText = portCell.textContent?.trim() || "";
		const portMatches = cellText.match(
			/\b(\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)\b/,
		);
		return portMatches ? portMatches[1] : "N/A";
	}

	// Extract Domains tab data - COMPREHENSIVE
	async function extractDomainsTabData() {
		const domainsData = {
			domains: [],
			certificates: [],
			dnsZones: [],
			status: "N/A",
		};

		try {
			const pageText = document.body.textContent || "";

			// Look for domain elements
			const domainElements = document.querySelectorAll(
				'[data-testid*="domain"], .domain-info, .dns-info, a[href*="domain"]',
			);
			domainElements.forEach((element) => {
				const domainText = element.textContent?.trim();
				if (
					domainText &&
					domainText.includes(".") &&
					domainText.length < 100
				) {
					domainsData.domains.push(domainText);
				}
			});

			// Extract from tables
			const domainRows = document.querySelectorAll(
				'.domains-table tr, [data-testid*="domain"] tr',
			);
			domainRows.forEach((row) => {
				const cells = row.querySelectorAll("td");
				if (cells.length >= 2) {
					domainsData.domains.push({
						name: cells[0]?.textContent?.trim() || "N/A",
						type: cells[1]?.textContent?.trim() || "N/A",
						status: cells[2]?.textContent?.trim() || "N/A",
					});
				}
			});

			if (domainsData.domains.length === 0) {
				domainsData.status = "No domains configured";
			}
		} catch (error) {
			console.error("Error extracting domains data:", error);
		}

		return domainsData;
	}

	// Extract Tags tab data - COMPREHENSIVE
	async function extractTagsTabData() {
		const tagsData = {
			tags: {},
			tagCount: 0,
			keyOnlyTags: [],
		};

		try {
			// Look for tags in table
			const tagRows = document.querySelectorAll(
				'.tags-table tbody tr, [data-testid*="tag"] tr, table tbody tr',
			);
			tagRows.forEach((row) => {
				const cells = row.querySelectorAll("td");
				if (cells.length >= 2) {
					const key = cells[0]?.textContent?.trim();
					const value = cells[1]?.textContent?.trim();
					if (key && key !== "Key" && key.length < 100) {
						tagsData.tags[key] = value || "";
					}
				} else if (cells.length === 1) {
					const tag = cells[0]?.textContent?.trim();
					if (tag && tag !== "Key" && tag.length < 100) {
						tagsData.keyOnlyTags.push(tag);
					}
				}
			});

			// Look for tag badges
			const tagBadges = document.querySelectorAll(
				'[class*="tag-badge"], [class*="TagBadge"]',
			);
			tagBadges.forEach((badge) => {
				const text = badge.textContent?.trim();
				if (text && text.length < 50) {
					if (text.includes(":")) {
						const [key, value] = text.split(":");
						tagsData.tags[key.trim()] = value.trim();
					} else {
						tagsData.keyOnlyTags.push(text);
					}
				}
			});

			tagsData.tagCount =
				Object.keys(tagsData.tags).length + tagsData.keyOnlyTags.length;
		} catch (error) {
			console.error("Error extracting tags data:", error);
		}

		return tagsData;
	}

	// Navigate to a Lightsail tab
	async function navigateToTab(tabName) {
		try {
			const instanceName = getInstanceName();
			const region = getRegion();

			// Try clicking tab element first
			const tabSelectors = [
				`a[href*="${tabName}"]`,
				`[data-testid*="${tabName}"]`,
				`.awsui_tabs-tab-link_14rmt_1krsb_300[href*="${tabName}"]`,
			];

			for (const selector of tabSelectors) {
				const tabElement = document.querySelector(selector);
				if (tabElement) {
					const isActive =
						tabElement.getAttribute("aria-selected") === "true" ||
						tabElement.classList.contains(
							"awsui_tabs-tab-active_14rmt_1krsb_378",
						);

					if (!isActive) {
						tabElement.click();
						await new Promise((resolve) =>
							setTimeout(resolve, 2500),
						);
					}
					return true;
				}
			}
		} catch (error) {
			console.error(`Error navigating to ${tabName} tab:`, error);
		}
		return false;
	}

	// Comprehensive extraction from all tabs
	async function extractAllTabsData() {
		const allData = {
			connect: {},
			storage: {},
			networking: {},
			domains: {},
			tags: {},
		};

		const tabs = [
			{
				name: "connect",
				href: "connect",
				extractor: extractConnectTabData,
			},
			{
				name: "storage",
				href: "storage",
				extractor: extractStorageTabData,
			},
			{
				name: "networking",
				href: "networking",
				extractor: extractNetworkingTabData,
			},
			{
				name: "domains",
				href: "domains",
				extractor: extractDomainsTabData,
			},
			{ name: "tags", href: "tags", extractor: extractTagsTabData },
		];

		for (const tab of tabs) {
			try {
				await navigateToTab(tab.href);
				allData[tab.name] = await tab.extractor();
			} catch (error) {
				console.error(`Error extracting ${tab.name} tab:`, error);
			}
		}

		return allData;
	}

	// Main extraction function
	async function extractLightsailDetails() {
		const instanceName = getInstanceName();
		if (!instanceName) return null;

		try {
			const allTabsData = await extractAllTabsData();
			const region = getRegion();

			// Combine all data
			const details = {
				instanceId: instanceName,
				name: instanceName,
				service: "lightsail",
				region,

				// From connect tab
				state: allTabsData.connect?.state || "N/A",
				availabilityZone:
					allTabsData.connect?.availabilityZone || "N/A",
				blueprint: allTabsData.connect?.blueprint || "N/A",
				os: allTabsData.connect?.os || "N/A",
				osVersion: allTabsData.connect?.osVersion || "N/A",
				bundle: allTabsData.connect?.bundle || "N/A",
				ram: allTabsData.connect?.ram || "N/A",
				vcpus: allTabsData.connect?.vcpus || "N/A",
				storage: allTabsData.connect?.storage || "N/A",
				transferAllowance:
					allTabsData.connect?.transferAllowance || "N/A",
				sshKeyName: allTabsData.connect?.sshKeyName || "N/A",
				sshUser: allTabsData.connect?.sshUser || "N/A",
				connectUrl: allTabsData.connect?.connectUrl || "N/A",
				supportCode: allTabsData.connect?.supportCode || "N/A",
				createdAt: allTabsData.connect?.createdAt || "N/A",

				// From networking tab
				publicIpv4:
					allTabsData.networking?.ipv4?.publicIp ||
					allTabsData.connect?.publicIpv4 ||
					"N/A",
				privateIpv4:
					allTabsData.networking?.ipv4?.privateIp ||
					allTabsData.connect?.privateIpv4 ||
					"N/A",
				isStaticIp: allTabsData.networking?.ipv4?.isStaticIp || false,
				staticIpName:
					allTabsData.networking?.ipv4?.staticIpName || "N/A",
				ipv6Enabled: allTabsData.networking?.ipv6?.enabled || false,
				publicIpv6:
					allTabsData.networking?.ipv6?.addresses?.[0] || "N/A",

				// Firewall
				firewallDetails: allTabsData.networking?.firewall || {
					ipv4Rules: [],
					ipv6Rules: [],
				},
				firewallRules: formatFirewallRules(
					allTabsData.networking?.firewall,
				),

				// Load Balancing & Distributions
				loadBalancers: allTabsData.networking?.loadBalancers || [],
				loadBalancingStatus:
					allTabsData.networking?.loadBalancingStatus || "N/A",
				distributions: allTabsData.networking?.distributions || [],
				distributionStatus:
					allTabsData.networking?.distributionStatus || "N/A",

				// Storage
				systemDiskSize: allTabsData.storage?.systemDiskSize || "N/A",
				systemDiskPath: allTabsData.storage?.systemDiskPath || "N/A",
				additionalDisks: allTabsData.storage?.additionalDisks || [],
				totalStorageGiB: allTabsData.storage?.totalStorageGiB || 0,
				automaticSnapshots:
					allTabsData.storage?.automaticSnapshots || "N/A",
				snapshots: allTabsData.storage?.snapshots || [],

				// Domains
				domains: allTabsData.domains?.domains || [],
				domainsStatus: allTabsData.domains?.status || "N/A",

				// Tags
				tags: allTabsData.tags?.tags || {},
				tagCount: allTabsData.tags?.tagCount || 0,

				// Full tab data for detailed access
				tabsData: allTabsData,
			};

			return details;
		} catch (error) {
			console.error("Error extracting Lightsail details:", error);
			return null;
		}
	}

	// Format firewall rules for display
	function formatFirewallRules(firewall) {
		if (!firewall) return ["N/A"];

		const rules = [];

		if (firewall.ipv4Rules && firewall.ipv4Rules.length > 0) {
			rules.push("=== IPv4 Firewall Rules ===");
			firewall.ipv4Rules.forEach((rule) => {
				// Fix concatenated port ranges
				let portRange = rule.portRange;
				if (
					portRange &&
					portRange.length > 5 &&
					!portRange.includes("-")
				) {
					const halfLength = Math.floor(portRange.length / 2);
					const firstHalf = portRange.substring(0, halfLength);
					const secondHalf = portRange.substring(halfLength);
					if (
						!isNaN(firstHalf) &&
						!isNaN(secondHalf) &&
						firstHalf !== secondHalf
					) {
						portRange = `${firstHalf}-${secondHalf}`;
					}
				}
				rules.push(
					`${rule.application} (${rule.protocol} ${portRange}) - ${rule.restrictedTo}`,
				);
			});
		}

		if (firewall.ipv6Rules && firewall.ipv6Rules.length > 0) {
			rules.push("=== IPv6 Firewall Rules ===");
			firewall.ipv6Rules.forEach((rule) => {
				rules.push(
					`${rule.application} (${rule.protocol} ${rule.portRange}) - ${rule.restrictedTo}`,
				);
			});
		}

		return rules.length > 0 ? rules : ["N/A"];
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

		if (!document.getElementById("spinner-style")) {
			const style = document.createElement("style");
			style.id = "spinner-style";
			style.textContent =
				"@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
			document.head.appendChild(style);
		}

		try {
			const details = await extractLightsailDetails();
			if (!details) throw new Error("Could not extract instance details");

			const accountInfo = extractAccountInfo();
			let subject = "🚀 AWS Lightsail Instance Details";
			if (details.name) {
				subject = `🚀 ${details.name} - AWS Lightsail Instance`;
			}
			if (details.state && details.state !== "N/A") {
				subject += ` [${details.state.toUpperCase()}]`;
			}

			// Use compact body for URL to avoid 400 errors, full body for clipboard fallback
			const compactBody = buildEmailBody(details, accountInfo, true);
			const fullBody = buildEmailBody(details, accountInfo, false);
			openComposer(subject, compactBody, fullBody);
		} catch (error) {
			console.error("Lightsail Share Error:", error);
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

	// Attach button to instance page
	function attachLightsailInstancePageButton() {
		const url = window.location.href;
		const instanceNameMatch = url.match(/\/instances\/([^\/\?#]+)/);
		if (!instanceNameMatch) return;

		const waitForPageLoad = () => {
			return new Promise((resolve) => {
				if (document.readyState === "complete") {
					setTimeout(resolve, 1000);
				} else {
					window.addEventListener("load", () =>
						setTimeout(resolve, 1000),
					);
				}
			});
		};

		waitForPageLoad().then(() => {
			createFloatingButton();
		});
	}

	// Scan and attach
	function scanAndAttach() {
		const url = window.location.href;
		const now = Date.now();

		if (buttonCreationInProgress || now - lastButtonCreationTime < 5000) {
			return;
		}

		if (url.includes("/instances/") && !url.includes("/instances?")) {
			buttonCreationInProgress = true;
			lastButtonCreationTime = now;

			try {
				attachLightsailInstancePageButton();
			} finally {
				setTimeout(() => {
					buttonCreationInProgress = false;
				}, 2000);
			}
		}
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

	// Initialize only on Lightsail pages
	if (detectLightsailService()) {
		const observer = new MutationObserver(() => {
			scanAndAttach();
		});
		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(scanAndAttach, 1500);
		setInterval(scanAndAttach, 8000);
	}
})();
