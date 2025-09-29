// content_script_lightsail.js - Lightsail-specific functionality
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

	// Track which elements already have buttons to prevent duplicates
	const elementsWithButtons = new WeakSet();

	// Global data storage for tab information accumulation
	let globalTabData = {
		storage: {},
		networking: {},
		domains: {},
		tags: {},
		currentTab: null,
	};

	// Track button creation to prevent duplicates
	let buttonCreationInProgress = false;
	let lastButtonCreationTime = 0;

	// Detect if we're on a Lightsail service
	function detectLightsailService() {
		const url = window.location.href;
		const hostname = window.location.hostname;

		return (
			url.includes("lightsail.aws.amazon.com") ||
			hostname.includes("lightsail")
		);
	}

	// Handle Lightsail instance detail pages specifically
	function attachLightsailInstancePageButton() {
		// Check if we're on a Lightsail instance detail page
		const url = window.location.href;
		const instanceNameMatch = url.match(/\/instances\/([^\/\?#]+)/);

		if (!instanceNameMatch) return;

		// Check if button already exists - multiple checks to prevent duplicates
		if (
			document.querySelector(".aws-lightsail-floating-button") ||
			document.querySelector(
				`.${BUTTON_CLASS}[data-service="lightsail"]`
			) ||
			document.querySelector('[data-testid="shareInstance"]') ||
			elementsWithButtons.has(document.body)
		) {
			return;
		}

		// Wait for page to fully load before adding button
		const waitForPageLoad = () => {
			return new Promise((resolve) => {
				if (document.readyState === "complete") {
					// Additional wait to ensure AWS components are loaded
					setTimeout(resolve, 1000);
				} else {
					window.addEventListener("load", () => {
						setTimeout(resolve, 1000);
					});
				}
			});
		};

		waitForPageLoad().then(() => {
			// Always create floating button (removed inline button logic)
			createFloatingButton();
		});
	}

	// Fallback: Create a floating share button for Lightsail instance pages
	function createFloatingButton() {
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
			gatherAndShare(document.body);
		});

		floatingButton.addEventListener("mouseenter", () => {
			floatingButton.style.background = "#E68900";
		});

		floatingButton.addEventListener("mouseleave", () => {
			floatingButton.style.background = "#FF9900";
		});

		document.body.appendChild(floatingButton);

		// Mark as processed to avoid duplicates
		elementsWithButtons.add(document.body);
	}

	// Comprehensive tab switching and data extraction for Lightsail
	async function extractAllTabsData(instanceName) {
		// Reset global data for new extraction
		globalTabData = {
			storage: {},
			networking: {},
			domains: {},
			tags: {},
			currentTab: null,
		};

		const originalUrl = window.location.href;
		// Starting comprehensive tab data extraction

		try {
			// Define tab configurations based on the HTML structure (removed metrics, snapshots, history)
			const tabConfigs = [
				{
					name: "storage",
					testId: "/webapp/:region/instances/:instanceName/storage",
					href: "storage",
					label: "Storage",
				},
				{
					name: "networking",
					testId: "/webapp/:region/instances/:instanceName/networking",
					href: "networking",
					label: "Networking",
				},
				{
					name: "domains",
					testId: "/webapp/:region/instances/:instanceName/domains",
					href: "domains",
					label: "Domains",
				},
				{
					name: "tags",
					testId: "/webapp/:region/instances/:instanceName/tags",
					href: "tags",
					label: "Tags",
				},
			];

			// Extract data from each tab
			for (const tabConfig of tabConfigs) {
				try {
					// Set current tab for global tracking
					globalTabData.currentTab = tabConfig.name;

					// Find the tab using multiple selectors
					const tabSelectors = [
						`[data-testid="${tabConfig.testId}"]`,
						`a[href*="${tabConfig.href}"]`,
						`.awsui_tabs-tab-link_14rmt_1krsb_300[href*="${tabConfig.href}"]`,
					];

					let tabElement = null;
					for (const selector of tabSelectors) {
						tabElement = document.querySelector(selector);
						if (tabElement) break;
					}

					if (tabElement) {
						// Check if tab is already active
						const isActive =
							tabElement.getAttribute("aria-selected") ===
								"true" ||
							tabElement.classList.contains(
								"awsui_tabs-tab-active_14rmt_1krsb_378"
							);

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
					} else {
						// Tab not found
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
			case "storage":
				return await extractStorageTabData();
			case "networking":
				return await extractNetworkingTabData();
			case "domains":
				return await extractDomainsTabData();
			case "tags":
				return await extractTagsTabData();
			default:
				return {};
		}
	}

	// Extract domains tab data
	async function extractDomainsTabData() {
		const domainsData = {};

		try {
			// Look for domain information
			const domainElements = document.querySelectorAll(
				'[data-testid*="domain"], .domain-info, .dns-info'
			);

			if (domainElements.length === 0) {
				domainsData.status = "No domains configured";
			} else {
				const domains = [];
				domainElements.forEach((element) => {
					const domainText = element.textContent?.trim();
					if (domainText && domainText.includes(".")) {
						domains.push(domainText);
					}
				});
				domainsData.domains = domains.length > 0 ? domains : "N/A";
			}
		} catch (error) {
			domainsData.status = "N/A";
		}

		return domainsData;
	}

	// Extract tags tab data
	async function extractTagsTabData() {
		const tagsData = {};

		try {
			// Look for tag information
			const tagElements = document.querySelectorAll(
				'[data-testid*="tag"], .tag-info, .tags-table tbody tr'
			);

			if (tagElements.length === 0) {
				tagsData.status = "No tags configured";
			} else {
				const tags = {};
				tagElements.forEach((element) => {
					const cells = element.querySelectorAll("td");
					if (cells.length >= 2) {
						const key = cells[0]?.textContent?.trim();
						const value = cells[1]?.textContent?.trim();
						if (key && value) {
							tags[key] = value;
						}
					}
				});
				tagsData.tags = Object.keys(tags).length > 0 ? tags : "N/A";
			}
		} catch (error) {
			tagsData.status = "N/A";
		}

		return tagsData;
	}

	// Enhanced networking details extraction using provided HTML structure
	async function extractNetworkingTabData() {
		const networkingDetails = {
			ipv4: {
				publicIp: null,
				privateIp: null,
				isStaticIp: false,
			},
			ipv6: {
				publicIp: null,
				enabled: false,
			},
			firewall: {
				ipv4Rules: [],
				ipv6Rules: [],
			},
			loadBalancing: null,
			distribution: null,
		};

		try {
			// Extract IPv4 information
			const publicIpv4Element = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.publicIp"]'
			);
			if (publicIpv4Element) {
				const ipContainer = publicIpv4Element.closest(".css-1fbqy03");
				if (ipContainer) {
					const ipElement = ipContainer.querySelector("h2");
					if (ipElement) {
						networkingDetails.ipv4.publicIp =
							ipElement.textContent?.trim();
					}
				}
			}

			const privateIpv4Element = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.privateIp"]'
			);
			if (privateIpv4Element) {
				const ipContainer = privateIpv4Element.closest(".css-1fbqy03");
				if (ipContainer) {
					const ipElement = ipContainer.querySelector("h2");
					if (ipElement) {
						networkingDetails.ipv4.privateIp =
							ipElement.textContent?.trim();
					}
				}
			}

			// Check for static IP
			const staticIpDescription = document.querySelector(
				'[data-testid="ls.instanceNetworkingIp.staticIpDescription"]'
			);
			if (staticIpDescription) {
				networkingDetails.ipv4.isStaticIp = true;
			}

			// Extract IPv6 information
			const ipv6Toggle = document.querySelector(
				'[data-testid="ipv6ToggleSection"]'
			);
			if (ipv6Toggle) {
				const enabledDesc = ipv6Toggle.querySelector(
					'[data-testid="shared.ipv6Toggle.ipv6EnabledDescription"]'
				);
				if (enabledDesc) {
					networkingDetails.ipv6.enabled = true;

					// Extract IPv6 address using the correct selector
					const ipv6AddressElement = document.querySelector(
						'[data-testid="ipv6AddressDisplay"]'
					);
					if (ipv6AddressElement) {
						networkingDetails.ipv6.publicIp =
							ipv6AddressElement.textContent?.trim();
					}
				}
			}

			// Wait for firewall rules to load and extract firewall rules for IPv4
			await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for firewall data to load

			// Enhanced IPv4 firewall extraction with dynamic class handling
			const ipv4FirewallTable = document.querySelector(
				".integ_ipv4FirewallSection table, [data-analytics*='ipv4FirewallSection'] table"
			);
			if (ipv4FirewallTable) {
				const rows = ipv4FirewallTable.querySelectorAll("tbody tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						// Enhanced port range extraction with dynamic selectors
						let portRange = "";

						// Try multiple dynamic selectors for port range (3rd column)
						const portCell = cells[2];
						if (portCell) {
							// Try all div elements in the port cell (classes are dynamic)
							const portDivs = portCell.querySelectorAll("div");
							for (const div of portDivs) {
								const text = div.textContent?.trim();
								// Check if it looks like a port/range (numbers, dashes, commas)
								if (
									text &&
									/^[\d\-,\s]+$/.test(text) &&
									text !== "" &&
									text.length > 0
								) {
									portRange = text;
									break;
								}
							}

							// Fallback: check for specific patterns in cell text
							if (!portRange) {
								const cellText =
									portCell.textContent?.trim() || "";
								// Extract port patterns: single ports, ranges, or comma-separated
								const portMatches = cellText.match(
									/\b(\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)\b/
								);
								if (portMatches) {
									portRange = portMatches[1];
								}
							}
						}

						// Extract application (1st column)
						const application = cells[0]?.textContent?.trim() || "";

						// Extract protocol (2nd column)
						const protocol = cells[1]?.textContent?.trim() || "";

						// Enhanced connection restriction extraction (4th column)
						let allowConnections = "";
						const connectionCell = cells[3];
						if (connectionCell) {
							// Try specific selectors first
							const connectionP = connectionCell.querySelector(
								'p[data-testid*="anyIpAddress"], p[data-testid*="ipAddress"]'
							);
							if (connectionP) {
								allowConnections =
									connectionP.textContent?.trim() || "";
							} else {
								allowConnections =
									connectionCell.textContent?.trim() || "";
							}
						}

						// Only add if we have meaningful data
						if (application || protocol || portRange) {
							networkingDetails.firewall.ipv4Rules.push({
								application: application,
								protocol: protocol,
								portRange: portRange || "N/A",
								allowConnections: allowConnections || "Any IP",
							});
						}
					}
				});
			}

			// Enhanced IPv6 firewall extraction with dynamic class handling
			const ipv6FirewallTable = document.querySelector(
				".integ_ipv6FirewallSection table, [data-analytics*='ipv6FirewallSection'] table"
			);
			if (ipv6FirewallTable) {
				const rows = ipv6FirewallTable.querySelectorAll("tbody tr");
				rows.forEach((row) => {
					const cells = row.querySelectorAll("td");
					if (cells.length >= 4) {
						// Enhanced port range extraction with dynamic selectors
						let portRange = "";

						// Try multiple dynamic selectors for port range (3rd column)
						const portCell = cells[2];
						if (portCell) {
							// Try all div elements in the port cell (classes are dynamic)
							const portDivs = portCell.querySelectorAll("div");
							for (const div of portDivs) {
								const text = div.textContent?.trim();
								// Check if it looks like a port/range (numbers, dashes, commas)
								if (
									text &&
									/^[\d\-,\s]+$/.test(text) &&
									text !== "" &&
									text.length > 0
								) {
									portRange = text;
									break;
								}
							}

							// Fallback: check for specific patterns in cell text
							if (!portRange) {
								const cellText =
									portCell.textContent?.trim() || "";
								// Extract port patterns: single ports, ranges, or comma-separated
								const portMatches = cellText.match(
									/\b(\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*)\b/
								);
								if (portMatches) {
									portRange = portMatches[1];
								}
							}
						}

						// Extract application (1st column)
						const application = cells[0]?.textContent?.trim() || "";

						// Extract protocol (2nd column)
						const protocol = cells[1]?.textContent?.trim() || "";

						// Enhanced connection restriction extraction (4th column)
						let allowConnections = "";
						const connectionCell = cells[3];
						if (connectionCell) {
							// Try specific selectors first
							const connectionP = connectionCell.querySelector(
								'p[data-testid*="anyIpAddress"], p[data-testid*="ipAddress"]'
							);
							if (connectionP) {
								allowConnections =
									connectionP.textContent?.trim() || "";
							} else {
								allowConnections =
									connectionCell.textContent?.trim() || "";
							}
						}

						// Only add if we have meaningful data
						if (application || protocol || portRange) {
							networkingDetails.firewall.ipv6Rules.push({
								application: application,
								protocol: protocol,
								portRange: portRange || "N/A",
								allowConnections: allowConnections || "Any IP",
							});
						}
					}
				});
			}

			// Extract load balancing info
			const loadBalancerSection = document.querySelector(
				'[data-testid="ls.loadBalancersSection.noLoadBalancers"]'
			);
			if (loadBalancerSection) {
				networkingDetails.loadBalancing =
					loadBalancerSection.textContent?.trim();
			}

			// Extract distribution info
			const distributionSection = document.querySelector(
				'[data-testid="instances.networkingDistributions.noDistributions"]'
			);
			if (distributionSection) {
				networkingDetails.distribution =
					distributionSection.textContent?.trim();
			}
		} catch (error) {
			console.error("Error extracting networking data:", error);
		}

		// Networking details extracted successfully

		return networkingDetails;
	}

	// Enhanced storage details extraction with tab simulation
	async function extractStorageTabData() {
		const storageDetails = {};

		try {
			// Now extract storage information from the active tab
			const systemDiskSection = document.querySelector(
				".integ_systemDiskSection"
			);
			if (systemDiskSection) {
				// Extract system disk information
				const diskSizeElement = systemDiskSection.querySelector(
					'[data-testid="ls.displayHelpersInstance.memoryInGB"]'
				);
				if (diskSizeElement) {
					storageDetails.primaryStorage =
						diskSizeElement.textContent.trim();
				}

				// Extract disk path
				const diskPathValue = systemDiskSection.querySelector(
					".DiskPathDisplay-module__selectedDiskPath strong"
				);
				if (diskPathValue) {
					storageDetails.diskPath = diskPathValue.textContent.trim();
				}

				// Extract disk name
				const diskNameElement = systemDiskSection.querySelector(
					".ResourceReferenceName-module__ResourceReferenceName .TruncatedText-module__TruncatedText"
				);
				if (diskNameElement) {
					storageDetails.diskName =
						diskNameElement.textContent.trim();
				}

				// Extract disk type
				const diskTypeElement = systemDiskSection.querySelector(
					'[data-testid="ls.diskSummaryDisplay.summary"]'
				);
				if (
					diskTypeElement &&
					diskTypeElement.textContent.includes("block storage")
				) {
					storageDetails.diskType = "Block Storage";
				}
			}

			// Check for additional attached disks
			const attachedDisksSection = document.querySelector(
				".integ_attachedDisksSection"
			);
			if (attachedDisksSection) {
				const noDisksMessage = attachedDisksSection.querySelector(
					'[data-testid="ls.instanceStorage.noAttachableDisksDescription"]'
				);
				if (noDisksMessage) {
					storageDetails.additionalDisks =
						"No additional disks attached";
				} else {
					// If there are attached disks, extract them
					const attachedDisks = [];
					const diskItems = attachedDisksSection.querySelectorAll(
						".ResourceReferenceItem-module__ResourceReferenceItem"
					);

					diskItems.forEach((diskItem) => {
						const diskName = diskItem
							.querySelector(
								".ResourceReferenceName-module__ResourceReferenceName"
							)
							?.textContent.trim();
						const diskSize = diskItem
							.querySelector('[data-testid*="memoryInGB"]')
							?.textContent.trim();
						const diskPath = diskItem
							.querySelector(
								".DiskPathDisplay-module__selectedDiskPath strong"
							)
							?.textContent.trim();

						if (diskName || diskSize) {
							attachedDisks.push({
								name: diskName || "N/A",
								size: diskSize || "N/A",
								path: diskPath || "N/A",
							});
						}
					});

					if (attachedDisks.length > 0) {
						storageDetails.additionalDisks = attachedDisks;
					}
				}
			}

			// Extract storage usage if available
			const usageElement = document.querySelector(
				'[data-testid*="usage"], .storage-usage'
			);
			if (usageElement) {
				const usageText = usageElement.textContent?.trim();
				const usageMatch = usageText?.match(/(\d+)%\s*used/i);
				if (usageMatch) {
					storageDetails.usage = usageMatch[0];
				}
			}
		} catch (error) {
			// Error extracting storage details
		}

		// Set default values for missing data
		if (!storageDetails.primaryStorage)
			storageDetails.primaryStorage = "N/A";
		if (!storageDetails.diskPath) storageDetails.diskPath = "N/A";
		if (!storageDetails.diskName) storageDetails.diskName = "N/A";
		if (!storageDetails.diskType) storageDetails.diskType = "N/A";
		if (!storageDetails.additionalDisks)
			storageDetails.additionalDisks = "N/A";

		return storageDetails;
	}

	// Complete Lightsail details extraction with IPv6 support
	async function extractLightsailDetailsFromPage(instanceId, name) {
		const pageText = document.body.textContent || "";
		const details = { instanceId, name, service: "lightsail" };

		// Extract region from URL
		const regionMatch = window.location.pathname.match(
			/\/ls\/webapp\/([^\/]+)\//
		);
		if (regionMatch) {
			details.region = regionMatch[1];
		}

		try {
			// Instance status
			const statusElement = document.querySelector(
				'[data-testid="ls.instanceStatus.running"], [data-testid="ls.instanceStatus.stopped"], [aria-live="polite"] span[data-testid*="instanceStatus"]'
			);
			if (statusElement) {
				details.state = statusElement.textContent?.trim() || "Unknown";
			} else {
				const stateMatch = pageText.match(
					/\b(running|stopped|pending|stopping)\b/i
				);
				if (stateMatch) {
					details.state = stateMatch[0];
				}
			}

			// Blueprint information (Ubuntu, etc.)
			const blueprintElement = document.querySelector(
				'h2 .awsui_heading-text_105ke_268sp_5 div, img[alt*="ubuntu"] + div, img[alt*="Ubuntu"] + div'
			);
			if (blueprintElement) {
				details.blueprint = blueprintElement.textContent?.trim();
				details.os = details.blueprint;

				// Extract OS version from blueprint text
				const versionMatch =
					details.blueprint?.match(/\b(\d+\.?\d*)\b/);
				if (versionMatch) {
					details.osVersion = `${details.os.split(" ")[0]} ${
						versionMatch[0]
					}`;
				}
			}

			// Bundle details (RAM, vCPUs, SSD)
			const bundleElement = document.querySelector(
				'[data-testid="ls.bundleDetailsDisplay.messageFormat"]'
			);
			if (bundleElement) {
				details.bundle = bundleElement.textContent?.trim();

				// Extract specific bundle details
				const ramMatch =
					bundleElement.textContent.match(/(\d+)\s*GB\s*RAM/i);
				if (ramMatch) details.ram = ramMatch[1] + " GB";

				const cpuMatch =
					bundleElement.textContent.match(/(\d+)\s*vCPUs?/i);
				if (cpuMatch) details.vcpus = cpuMatch[1] + " vCPUs";

				const storageMatch =
					bundleElement.textContent.match(/(\d+)\s*GB\s*SSD/i);
				if (storageMatch) details.storage = storageMatch[1] + " GB SSD";
			}

			// Enhanced IP extraction with IPv6 support
			const ipData = extractIPs(pageText);
			Object.assign(details, ipData);

			// Also look for IPs in specific elements
			const staticIpElements = document.querySelectorAll(
				"span.css-plo5ah, .ip-address, [data-testid*='ip']"
			);
			staticIpElements.forEach((element) => {
				const text = element.textContent?.trim();
				if (text) {
					const elementIPs = extractIPs(text);
					// Merge IPs, keeping existing ones if already found
					Object.keys(elementIPs).forEach((key) => {
						if (elementIPs[key] && !details[key]) {
							details[key] = elementIPs[key];
						}
					});
				}
			});

			// Comprehensive data extraction from all tabs
			const allTabsData = await extractAllTabsData(name);

			// Get firewall data from networking tab
			const firewallData = allTabsData?.networking?.firewall || {
				ipv4Rules: [],
				ipv6Rules: [],
			};

			// Format firewall rules for both IPv4 and IPv6
			const formattedRules = [];

			// Add IPv4 rules
			if (firewallData.ipv4Rules && firewallData.ipv4Rules.length > 0) {
				formattedRules.push("=== IPv4 Firewall Rules ===");
				firewallData.ipv4Rules.forEach((rule) => {
					if (rule.application && rule.portRange) {
						formattedRules.push(
							`${
								rule.application
							} (${rule.protocol?.toUpperCase()} ${
								rule.portRange
							}) - ${rule.allowConnections || "Any IP"}`
						);
					}
				});
			}

			// Add IPv6 rules
			if (firewallData.ipv6Rules && firewallData.ipv6Rules.length > 0) {
				formattedRules.push("=== IPv6 Firewall Rules ===");
				firewallData.ipv6Rules.forEach((rule) => {
					if (rule.application && rule.portRange) {
						formattedRules.push(
							`${
								rule.application
							} (${rule.protocol?.toUpperCase()} ${
								rule.portRange
							}) - ${rule.allowConnections || "Any IP"}`
						);
					}
				});
			}

			// Fallback to page text search if no tab data
			if (formattedRules.length === 0) {
				const firewallElements = document.querySelectorAll(
					'[data-testid*="firewall"], [data-testid*="port"], [data-testid*="protocol"], .integ_ipv4FirewallSection, .integ_ipv6FirewallSection'
				);

				const extractedRules = [];
				firewallElements.forEach((element) => {
					const firewallText = element.textContent?.trim();
					if (firewallText) {
						// Extract port and protocol information
						const portMatches = firewallText.match(
							/(\d+(?:-\d+)?)\s*\/(tcp|udp|icmp)/gi
						);
						if (portMatches) {
							extractedRules.push(...portMatches);
						}

						// Extract service names
						const serviceMatches = firewallText.match(
							/\b(SSH|HTTP|HTTPS|FTP|MySQL|PostgreSQL|DNS|NTP|SMTP|IMAP|POP3|LDAP|RDP|VNC)\b/gi
						);
						if (serviceMatches) {
							extractedRules.push(...serviceMatches);
						}
					}
				});

				const uniqueRules = [...new Set(extractedRules)].filter(
					(rule) => rule && rule.trim()
				);

				if (uniqueRules.length > 0) {
					formattedRules.push("=== Detected Firewall Rules ===");
					formattedRules.push(...uniqueRules);
				}
			}

			// Set firewall rules or default
			if (formattedRules.length > 0) {
				details.firewallRules = formattedRules;
			} else {
				details.firewallRules = ["N/A"];
			}

			// Store comprehensive tab data
			details.tabsData = allTabsData;
			details.firewallDetails = firewallData;

			// SSH Key name
			const sshKeyElement = document.querySelector(
				'[data-testid="instances.descriptions.customKeySummary"] strong'
			);
			if (sshKeyElement) {
				details.sshKeyName = sshKeyElement.textContent?.trim();
			}

			// Connect URL for browser-based SSH
			const connectLink = document.querySelector(
				'a[href*="/remote/"][href*="/terminal"]'
			);
			if (connectLink) {
				details.connectUrl = connectLink.href;
			}
		} catch (error) {
			// Error extracting enhanced Lightsail details
		}

		// Set default values for missing core data
		if (!details.state) details.state = "N/A";
		if (!details.blueprint) details.blueprint = "N/A";
		if (!details.bundle) details.bundle = "N/A";
		if (!details.sshKeyName) details.sshKeyName = "N/A";

		return details;
	}

	// Extract Lightsail-specific instance details
	function extractLightsailDetails(elem) {
		const url = window.location.href;
		const pageText = document.body.textContent || "";
		const text = elem ? elem.innerText || elem.textContent || "" : "";

		let instanceId = "";
		let name = "";

		// Extract instance name from Lightsail URL patterns
		const instanceNameMatch = url.match(/\/instances\/([^\/\?#]+)/);
		if (instanceNameMatch) {
			name = decodeURIComponent(instanceNameMatch[1]);
			instanceId = name; // Lightsail uses name as identifier
		}

		return extractLightsailDetailsFromPage(instanceId, name);
	}

	// Gather and share function for Lightsail
	function gatherAndShare(targetElem) {
		// Show loading state
		const btn = targetElem.querySelector(`.${BUTTON_CLASS}`);
		if (btn) {
			btn.innerHTML = `
        <svg class="aws-share-icon" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
        </svg>
        Sharing...
      `;
			btn.disabled = true;
		}

		// Add spinner animation
		if (!document.getElementById("spinner-style")) {
			const style = document.createElement("style");
			style.id = "spinner-style";
			style.textContent =
				"@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
			document.head.appendChild(style);
		}

		setTimeout(async () => {
			try {
				// Extract Lightsail details
				const details = await extractLightsailDetails(targetElem);

				// Extract region and account info
				const regionText = extractRegionInfo();
				const accountInfo = extractAccountInfo();
				const complete = Object.assign({}, details, {
					region: regionText,
				});

				// Generate subject line
				let subject = "🚀 AWS Lightsail Instance Details";
				if (complete.name) {
					subject = `🚀 ${complete.name} - AWS Lightsail Instance`;
				}
				if (complete.state) {
					subject += ` [${complete.state.toUpperCase()}]`;
				}

				const body = buildEmailBody(complete, accountInfo);

				// Reset button state
				if (btn) {
					btn.innerHTML = `
            <svg class="aws-share-icon" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
            </svg>
            Share
          `;
					btn.disabled = false;
				}

				openComposer(subject, body);
			} catch (error) {
				console.error("Error in gatherAndShare:", error);
				// Reset button on error
				if (btn) {
					btn.innerHTML = `
            <svg class="aws-share-icon" viewBox="0 0 24 24">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
            </svg>
            Share
          `;
					btn.disabled = false;
				}
			}
		}, 500);
	}

	// Scan and attach functions for Lightsail (only for detail pages, not lists)
	function scanAndAttach() {
		const url = window.location.href;
		const now = Date.now();

		// Prevent rapid successive calls
		if (buttonCreationInProgress || now - lastButtonCreationTime < 5000) {
			return;
		}

		// Only handle Lightsail instance detail pages, NOT list pages
		if (url.includes("/instances/") && !url.includes("/instances?")) {
			buttonCreationInProgress = true;
			lastButtonCreationTime = now;

			try {
				attachLightsailInstancePageButton();
			} finally {
				// Reset flag after a delay
				setTimeout(() => {
					buttonCreationInProgress = false;
				}, 2000);
			}
		}
	}

	// Listen for messages from extension
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

	// Only run on Lightsail pages
	if (detectLightsailService()) {
		// Observe for changes (AWS console loads data after navigation)
		const observer = new MutationObserver(() => {
			scanAndAttach();
		});

		observer.observe(document.body, { childList: true, subtree: true });

		// Initial scan
		setTimeout(scanAndAttach, 1500);
		// Also run every 8s as a fallback
		setInterval(scanAndAttach, 8000);
	}
})();
