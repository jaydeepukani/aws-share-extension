#!/usr/bin/env node

/**
 * AWS Instance Fetcher CLI
 * Fetches full EC2 and Lightsail instance details using Playwright
 */

import chalk from "chalk";
import { program } from "commander";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

// Configuration
const AWS_CONSOLE_URL = "https://console.aws.amazon.com/";
const EC2_CONSOLE_URL = "https://console.aws.amazon.com/ec2/home";
const LIGHTSAIL_CONSOLE_URL = "https://lightsail.aws.amazon.com/";

// Parse CLI arguments
program
	.name("aws-fetch")
	.description(
		"Fetch full EC2 and Lightsail instance details from AWS Console",
	)
	.version("1.0.0")
	.option(
		"-s, --service <type>",
		"Service to fetch: ec2, lightsail, or all",
		"all",
	)
	.option("-r, --region <region>", "AWS region (e.g., us-east-1)", "")
	.option(
		"-o, --output <file>",
		"Output file path (JSON or CSV based on extension)",
		"aws-instances.json",
	)
	.option("-t, --timeout <seconds>", "Login timeout in seconds", "300")
	.option(
		"--headless",
		"Run in headless mode (not recommended for login)",
		false,
	)
	.option("--debug", "Enable debug mode with verbose logging", false)
	.parse();

const options = program.opts();

// Utility functions
function log(message, type = "info") {
	const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
	const prefix = `[${timestamp}]`;

	switch (type) {
		case "success":
			console.log(chalk.green(`${prefix} ✓ ${message}`));
			break;
		case "error":
			console.log(chalk.red(`${prefix} ✗ ${message}`));
			break;
		case "warn":
			console.log(chalk.yellow(`${prefix} ⚠ ${message}`));
			break;
		case "progress":
			console.log(chalk.cyan(`${prefix} → ${message}`));
			break;
		case "debug":
			if (options.debug) {
				console.log(chalk.gray(`${prefix} [DEBUG] ${message}`));
			}
			break;
		default:
			console.log(chalk.white(`${prefix}   ${message}`));
	}
}

// Wait for user to complete login
async function waitForLogin(page, timeoutSeconds) {
	log("Waiting for you to log in to AWS Console...", "progress");
	log(`Timeout: ${timeoutSeconds} seconds`, "info");

	const startTime = Date.now();
	const timeoutMs = timeoutSeconds * 1000;

	while (Date.now() - startTime < timeoutMs) {
		const url = page.url();

		// Check if we're logged in (not on signin page)
		if (
			!url.includes("signin") &&
			!url.includes("login") &&
			(url.includes("console.aws.amazon.com") ||
				url.includes("lightsail.aws.amazon.com"))
		) {
			// Additional check: look for common logged-in elements
			try {
				const isLoggedIn = await page.evaluate(() => {
					// Check for user menu or account info
					return (
						document.querySelector(
							'[data-testid="awsc-nav-account-menu-button"]',
						) !== null ||
						document.querySelector("#nav-usernameMenu") !== null ||
						document.querySelector(
							'[data-testid="account-menu-button"]',
						) !== null ||
						document.body.innerHTML.includes("aws-account-info") ||
						document.body.innerHTML.includes("Account ID")
					);
				});

				if (isLoggedIn) {
					log("Login detected!", "success");
					return true;
				}
			} catch (e) {
				log(`Login check error: ${e.message}`, "debug");
			}
		}

		await new Promise((r) => setTimeout(r, 2000));
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		if (elapsed % 30 === 0 && elapsed > 0) {
			log(
				`Still waiting... ${timeoutSeconds - elapsed}s remaining`,
				"info",
			);
		}
	}

	throw new Error("Login timeout exceeded");
}

// Extract current region from page
async function getCurrentRegion(page) {
	try {
		const region = await page.evaluate(() => {
			// Try multiple methods to get region
			const regionButton = document.querySelector(
				'[data-testid="awsc-nav-regions-menu-button"]',
			);
			if (regionButton) {
				return regionButton.textContent?.trim() || "";
			}

			// Try URL
			const url = window.location.href;
			const regionMatch = url.match(/region=([a-z]{2}-[a-z]+-\d)/);
			if (regionMatch) return regionMatch[1];

			return "";
		});
		return region;
	} catch (e) {
		return "";
	}
}

// EC2 Instance extraction
async function extractEC2Instances(page) {
	log("Navigating to EC2 Console...", "progress");

	const region = options.region || "";
	const ec2Url = region
		? `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#Instances:`
		: "https://console.aws.amazon.com/ec2/home#Instances:";

	await page.goto(ec2Url, { waitUntil: "networkidle", timeout: 60000 });
	await page.waitForTimeout(3000);

	log("Extracting EC2 instance list...", "progress");

	// Wait for instance table to load
	try {
		await page.waitForSelector("table", { timeout: 30000 });
	} catch (e) {
		log("No instances found or table not loaded", "warn");
		return [];
	}

	// Get list of instance IDs from the table
	const instanceIds = await page.evaluate(() => {
		const ids = [];
		// Look for instance ID patterns in the table
		const cells = document.querySelectorAll("td");
		cells.forEach((cell) => {
			const text = cell.textContent || "";
			const match = text.match(/\b(i-[a-f0-9]{8,17})\b/);
			if (match && !ids.includes(match[1])) {
				ids.push(match[1]);
			}
		});
		return ids;
	});

	log(`Found ${instanceIds.length} EC2 instances`, "success");

	const instances = [];

	for (let i = 0; i < instanceIds.length; i++) {
		const instanceId = instanceIds[i];
		log(
			`Extracting details for ${instanceId} (${i + 1}/${instanceIds.length})...`,
			"progress",
		);

		try {
			const instanceData = await extractEC2InstanceDetails(
				page,
				instanceId,
			);
			instances.push(instanceData);
			log(`Extracted ${instanceId}`, "success");
		} catch (e) {
			log(`Failed to extract ${instanceId}: ${e.message}`, "error");
			instances.push({ instanceId, error: e.message });
		}
	}

	return instances;
}

// Extract detailed EC2 instance information
async function extractEC2InstanceDetails(page, instanceId) {
	const region = options.region || (await getCurrentRegionFromUrl(page));
	const detailUrl = region
		? `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#InstanceDetails:instanceId=${instanceId}`
		: `https://console.aws.amazon.com/ec2/home#InstanceDetails:instanceId=${instanceId}`;

	await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 60000 });
	await page.waitForTimeout(2000);

	// Check for iframe
	let targetFrame = page;
	const iframe = await page.$("#compute-react-frame");
	if (iframe) {
		const frame = await iframe.contentFrame();
		if (frame) {
			targetFrame = frame;
			await targetFrame.waitForTimeout(1000);
		}
	}

	const instanceData = {
		instanceId,
		service: "ec2",
		extractedAt: new Date().toISOString(),
		details: {},
		security: {},
		networking: {},
		storage: {},
		tags: {},
	};

	// Extract Details tab
	instanceData.details = await extractEC2DetailsTab(targetFrame);

	// Extract Security tab
	await clickTab(targetFrame, "security");
	instanceData.security = await extractEC2SecurityTab(targetFrame);

	// Extract Networking tab
	await clickTab(targetFrame, "networking");
	instanceData.networking = await extractEC2NetworkingTab(targetFrame);

	// Extract Storage tab
	await clickTab(targetFrame, "storage");
	instanceData.storage = await extractEC2StorageTab(targetFrame);

	// Extract Tags tab
	await clickTab(targetFrame, "tags");
	instanceData.tags = await extractEC2TagsTab(targetFrame);

	return instanceData;
}

// Click a tab by test ID or text
async function clickTab(frame, tabName) {
	try {
		const tab = await frame.$(`[data-testid="${tabName}"]`);
		if (tab) {
			await tab.click();
			await frame.waitForTimeout(1500);
			return true;
		}

		// Fallback: try to find by text
		const tabs = await frame.$$('button, [role="tab"]');
		for (const t of tabs) {
			const text = await t.textContent();
			if (text?.toLowerCase().includes(tabName.toLowerCase())) {
				await t.click();
				await frame.waitForTimeout(1500);
				return true;
			}
		}
	} catch (e) {
		log(`Could not click tab ${tabName}: ${e.message}`, "debug");
	}
	return false;
}

// Extract EC2 Details tab with comprehensive field extraction
async function extractEC2DetailsTab(frame) {
	return await frame.evaluate(() => {
		const data = {};

		// Helper to extract field by label - improved version
		const extractField = (labelText) => {
			// Method 1: data-analytics labels
			const labels = document.querySelectorAll(
				'[data-analytics^="label-for-"]',
			);
			for (const label of labels) {
				if (
					label.textContent
						?.toLowerCase()
						.includes(labelText.toLowerCase())
				) {
					const parent =
						label.closest('[class*="column"]') ||
						label.closest('[class*="grid"]') ||
						label.parentElement?.parentElement;
					if (parent) {
						const copySpan = parent.querySelector(
							'[class*="text-to-copy"]',
						);
						if (copySpan) return copySpan.textContent?.trim();
						const links = parent.querySelectorAll("a");
						if (links.length > 0)
							return links[0].textContent?.trim();
						const value = parent.querySelector(
							"div:last-child, span:last-child",
						);
						if (value && value !== label.parentElement) {
							return value.textContent
								?.replace(label.textContent || "", "")
								.trim();
						}
					}
				}
			}

			// Method 2: dt/dd pairs
			const dts = document.querySelectorAll("dt");
			for (const dt of dts) {
				if (
					dt.textContent
						?.toLowerCase()
						.includes(labelText.toLowerCase())
				) {
					const dd = dt.nextElementSibling;
					if (dd && dd.tagName === "DD") {
						return dd.textContent?.trim();
					}
				}
			}

			return null;
		};

		// Instance identification
		data.instanceId =
			extractField("Instance ID") ||
			document.body.innerHTML.match(/\b(i-[a-f0-9]{8,17})\b/)?.[1];
		data.instanceState = extractField("Instance state");
		data.instanceType = extractField("Instance type");
		data.lifecycle = extractField("Lifecycle");

		// Extract name from header
		const header = document.querySelector(
			'[data-testid="header-title"] h1, h1',
		);
		if (header) {
			const nameMatch = header.textContent?.match(/\(([^)]+)\)$/);
			if (nameMatch) data.name = nameMatch[1];
		}

		// Availability & Placement
		data.availabilityZone = extractField("Availability Zone");
		data.tenancy = extractField("Tenancy");
		data.placementGroup = extractField("Placement group");
		data.hostId = extractField("Host ID");
		data.capacityReservation = extractField("Capacity Reservation");
		data.partitionNumber = extractField("Partition number");

		// AMI Information
		data.amiId = extractField("AMI ID");
		data.amiName = extractField("AMI name");
		data.amiLocation = extractField("AMI location");
		data.platform = extractField("Platform");
		data.platformDetails = extractField("Platform details");
		data.architecture =
			extractField("Virtualization") || extractField("Architecture");
		data.virtualizationType = extractField("Virtualization type");
		data.bootMode = extractField("Boot mode");

		// Launch & Timing
		data.launchTime = extractField("Launch time");
		data.usageOperation = extractField("Usage operation");
		data.usageOperationUpdateTime = extractField(
			"Usage operation update time",
		);

		// IAM & Security
		data.iamRole = extractField("IAM role");
		data.iamInstanceProfile = extractField("IAM instance profile");
		data.keyPair = extractField("Key pair");

		// Networking basics
		data.publicDnsName = extractField("Public IPv4 DNS");
		data.publicDns = extractField("Public DNS");
		data.publicIpv4 = extractField("Public IPv4 address");
		data.privateDnsName = extractField("Private IPv4 DNS");
		data.privateIpDns = extractField("private-IP-DNS");
		data.privateIpv4 = extractField("Private IPv4 address");
		data.vpcId = extractField("VPC ID");
		data.subnetId = extractField("Subnet ID");
		data.sourceDestCheck = extractField("Source/dest. check");
		data.ipv6Addresses = extractField("IPv6 address");
		data.hostnameType = extractField("Hostname type");
		data.answerPrivateDnsName = extractField(
			"Answer private resource DNS name",
		);
		data.elasticIp =
			extractField("elasticIP_field") || extractField("Elastic IP");
		data.autoAssignedIp =
			extractField("autoAssignedIP_field") ||
			extractField("Auto-assigned IP");

		// Instance identifiers
		data.instanceArn =
			extractField("instance-arn") || extractField("Instance ARN");
		data.ownerId = extractField("owner-id") || extractField("Owner ID");
		data.managed = extractField("Managed");
		data.operator = extractField("Operator");

		// Status checks
		data.systemStatusCheck = extractField("System status check");
		data.instanceStatusCheck = extractField("Instance status check");

		// Compute/CPU options
		data.cpuCoreCount =
			extractField("Number of vCPUs") || extractField("Core count");
		data.cpuThreadsPerCore = extractField("Threads per core");
		data.cpuOptions = extractField("CPU options");
		data.creditSpecification = extractField("Credit specification");

		// Hardware/Features
		data.monitoring = extractField("Monitoring");
		data.ebsOptimized =
			extractField("EBS-optimized") || extractField("EBS optimized");
		data.nitroEnclave =
			extractField("Nitro Enclave") || extractField("Enclave");
		data.hibernation =
			extractField("Hibernation") || extractField("Stop - Hibernate");
		data.elasticGpuId = extractField("Elastic GPU ID");
		data.elasticInferenceAccelerator = extractField(
			"Elastic Inference accelerator",
		);

		// Storage basics
		data.rootDevice = extractField("Root device name");
		data.rootDeviceType = extractField("Root device type");
		data.blockDevices = extractField("Block devices");

		// Metadata options
		data.metadataAccessible =
			extractField("Instance metadata") ||
			extractField("Metadata accessible");
		data.imdsv2 = extractField("IMDSv2");
		data.httpTokens = extractField("HTTP tokens");
		data.httpPutResponseHopLimit = extractField(
			"HTTP put response hop limit",
		);
		data.httpEndpoint = extractField("HTTP endpoint");
		data.instanceMetadataTags = extractField("Instance metadata tags");

		// Maintenance & Recovery
		data.autoRecovery =
			extractField("Auto-recovery") || extractField("Auto recovery");
		data.stopProtection = extractField("Stop protection");
		data.terminationProtection = extractField("Termination protection");
		data.maintenanceStatus = extractField("Maintenance");

		// License
		data.licenseConfiguration = extractField("License configuration");

		return data;
	});
}

// Extract EC2 Security tab - comprehensive extraction
async function extractEC2SecurityTab(frame) {
	return await frame.evaluate(() => {
		const data = {
			securityGroups: [],
			securityGroupDetails: [],
			inboundRules: [],
			outboundRules: [],
			iamRole: null,
			keyPair: null,
		};

		// Extract security group IDs
		const sgPattern = /\bsg-[a-f0-9]+\b/g;
		const pageText = document.body.textContent || "";
		const sgMatches = pageText.match(sgPattern);
		if (sgMatches) {
			data.securityGroups = [...new Set(sgMatches)];
		}

		// Try to get security group names and IDs together
		const sgLinks = document.querySelectorAll('a[href*="security-groups"]');
		sgLinks.forEach((link) => {
			const href = link.href || "";
			const sgMatch = href.match(/sg-[a-f0-9]+/);
			const name = link.textContent?.trim();
			if (sgMatch && name) {
				data.securityGroupDetails.push({
					groupId: sgMatch[0],
					groupName: name,
				});
			}
		});

		// Extract IAM role
		const iamLinks = document.querySelectorAll(
			'a[href*="iam"], a[href*="role"]',
		);
		for (const link of iamLinks) {
			const text = link.textContent?.trim();
			if (text && !text.includes("IAM") && text.length > 3) {
				data.iamRole = text;
				break;
			}
		}

		// Extract key pair
		const keyPairLabels = document.querySelectorAll(
			'[data-analytics*="key"]',
		);
		for (const label of keyPairLabels) {
			const parent =
				label.closest('[class*="column"]') ||
				label.parentElement?.parentElement;
			if (parent) {
				const valueEl = parent.querySelector(
					'[class*="text-to-copy"], a',
				);
				if (valueEl) {
					data.keyPair = valueEl.textContent?.trim();
				}
			}
		}

		// Extract rules from tables
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const headerRow = table.querySelector("thead tr, tr:first-child");
			const headers = Array.from(
				headerRow?.querySelectorAll("th, td") || [],
			).map((h) => h.textContent?.toLowerCase().trim() || "");

			const isInboundTable = headers.some((h) => h.includes("source"));
			const isOutboundTable = headers.some((h) =>
				h.includes("destination"),
			);

			const rows = table.querySelectorAll(
				"tbody tr, tr:not(:first-child)",
			);
			rows.forEach((row) => {
				const cells = Array.from(row.querySelectorAll("td")).map(
					(c) => c.textContent?.trim() || "",
				);
				if (
					cells.length >= 3 &&
					!cells[0].toLowerCase().includes("no ")
				) {
					const rule = {
						ipVersion:
							cells.find((c) => c === "IPv4" || c === "IPv6") ||
							"IPv4",
						protocol:
							cells.find((c) => /^(TCP|UDP|ICMP|All)/i.test(c)) ||
							cells[0],
						portRange:
							cells.find((c) => /^(\d+(-\d+)?|All)$/.test(c)) ||
							cells[1],
						sourceOrDest:
							cells.find((c) => c.match(/[\d.:/]+|sg-/)) ||
							cells[2],
						description:
							cells[cells.length - 1] !== cells[2]
								? cells[cells.length - 1]
								: "",
					};

					if (isInboundTable) data.inboundRules.push(rule);
					else if (isOutboundTable) data.outboundRules.push(rule);
					else data.inboundRules.push(rule); // Default to inbound
				}
			});
		});

		return data;
	});
}

// Extract EC2 Networking tab - comprehensive extraction
async function extractEC2NetworkingTab(frame) {
	return await frame.evaluate(() => {
		const data = {
			networkInterfaces: [],
			elasticIps: [],
			ipAddresses: {
				publicIpv4: [],
				privateIpv4: [],
				ipv6: [],
			},
			vpc: null,
			subnet: null,
			availabilityZone: null,
		};

		const pageText = document.body.textContent || "";

		// Extract network interface details
		const eniPattern = /\beni-[a-f0-9]+\b/g;
		const eniMatches = pageText.match(eniPattern);
		if (eniMatches) {
			const uniqueEnis = [...new Set(eniMatches)];

			// Try to get ENI details from tables
			const tables = document.querySelectorAll("table");
			tables.forEach((table) => {
				const rows = table.querySelectorAll("tr");
				rows.forEach((row) => {
					const rowText = row.textContent || "";
					const eniMatch = rowText.match(/eni-[a-f0-9]+/);
					if (eniMatch) {
						const cells = Array.from(row.querySelectorAll("td"));
						const eniData = {
							eniId: eniMatch[0],
							description: "",
							subnetId: "",
							privateIp: "",
							publicIp: "",
						};

						// Extract details from cells
						cells.forEach((cell) => {
							const text = cell.textContent?.trim() || "";
							if (text.match(/subnet-[a-f0-9]+/)) {
								eniData.subnetId =
									text.match(/subnet-[a-f0-9]+/)[0];
							}
							if (text.match(/^(?:10|172|192)\.\d+\.\d+\.\d+$/)) {
								eniData.privateIp = text;
							}
							if (
								text.match(/^\d+\.\d+\.\d+\.\d+$/) &&
								!text.startsWith("10.") &&
								!text.startsWith("172.") &&
								!text.startsWith("192.168")
							) {
								eniData.publicIp = text;
							}
						});

						data.networkInterfaces.push(eniData);
					}
				});
			});

			// If no detailed extraction, at least list the IDs
			if (data.networkInterfaces.length === 0) {
				data.networkInterfaces = uniqueEnis.map((id) => ({
					eniId: id,
				}));
			}
		}

		// Extract Elastic IPs
		const eipPattern = /\beipalloc-[a-f0-9]+\b/g;
		const eipMatches = pageText.match(eipPattern);
		if (eipMatches) {
			data.elasticIps = [...new Set(eipMatches)];
		}

		// Extract all IPv4 addresses
		const ipv4Pattern =
			/\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
		const ipMatches = pageText.match(ipv4Pattern);
		if (ipMatches) {
			const uniqueIps = [...new Set(ipMatches)];
			uniqueIps.forEach((ip) => {
				if (
					ip.startsWith("10.") ||
					ip.startsWith("172.") ||
					ip.startsWith("192.168")
				) {
					data.ipAddresses.privateIpv4.push(ip);
				} else if (!ip.startsWith("127.") && !ip.startsWith("0.")) {
					data.ipAddresses.publicIpv4.push(ip);
				}
			});
		}

		// Extract IPv6 addresses
		const ipv6Pattern = /\b(?:[a-fA-F0-9]{1,4}:){2,7}[a-fA-F0-9]{1,4}\b/g;
		const ipv6Matches = pageText.match(ipv6Pattern);
		if (ipv6Matches) {
			data.ipAddresses.ipv6 = [...new Set(ipv6Matches)];
		}

		// Extract VPC and Subnet IDs
		const vpcMatch = pageText.match(/vpc-[a-f0-9]+/);
		if (vpcMatch) data.vpc = vpcMatch[0];

		const subnetMatch = pageText.match(/subnet-[a-f0-9]+/);
		if (subnetMatch) data.subnet = subnetMatch[0];

		return data;
	});
}

// Extract EC2 Storage tab - comprehensive extraction
async function extractEC2StorageTab(frame) {
	return await frame.evaluate(() => {
		const data = {
			rootDevice: null,
			rootDeviceType: null,
			blockDevices: [],
			volumes: [],
			totalStorageGiB: 0,
		};

		const pageText = document.body.textContent || "";

		// Extract root device info
		const rootDeviceMatch = pageText.match(
			/Root device[:\s]+(\/dev\/[a-z]+\d*)/i,
		);
		if (rootDeviceMatch) data.rootDevice = rootDeviceMatch[1];

		const rootTypeMatch = pageText.match(
			/Root device type[:\s]+(ebs|instance-store)/i,
		);
		if (rootTypeMatch) data.rootDeviceType = rootTypeMatch[1];

		// Extract volume IDs and details from tables
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const headerRow = table.querySelector("thead tr, tr:first-child");
			const headers = Array.from(
				headerRow?.querySelectorAll("th, td") || [],
			).map((h) => h.textContent?.toLowerCase().trim() || "");

			// Check if this is a block device table
			const isBlockDeviceTable = headers.some(
				(h) =>
					h.includes("device") ||
					h.includes("volume") ||
					h.includes("size"),
			);

			if (isBlockDeviceTable) {
				const rows = table.querySelectorAll(
					"tbody tr, tr:not(:first-child)",
				);
				rows.forEach((row) => {
					const cells = Array.from(row.querySelectorAll("td"));
					if (cells.length >= 2) {
						const rowText = row.textContent || "";
						const volMatch = rowText.match(/vol-[a-f0-9]+/);
						const sizeMatch = rowText.match(/(\d+)\s*GiB/i);
						const typeMatch = rowText.match(
							/\b(gp2|gp3|io1|io2|st1|sc1|standard)\b/i,
						);
						const deviceMatch = rowText.match(/\/dev\/[a-z]+\d*/);
						const iopsMatch = rowText.match(/(\d+)\s*IOPS/i);
						const throughputMatch = rowText.match(/(\d+)\s*MB\/s/i);

						const volume = {
							volumeId: volMatch ? volMatch[0] : null,
							deviceName: deviceMatch ? deviceMatch[0] : null,
							size: sizeMatch ? parseInt(sizeMatch[1]) : null,
							volumeType: typeMatch ? typeMatch[1] : null,
							iops: iopsMatch ? parseInt(iopsMatch[1]) : null,
							throughput: throughputMatch
								? parseInt(throughputMatch[1])
								: null,
							deleteOnTermination:
								rowText.toLowerCase().includes("yes") ||
								rowText.toLowerCase().includes("true"),
							encrypted: rowText
								.toLowerCase()
								.includes("encrypted"),
						};

						if (volume.volumeId || volume.deviceName) {
							data.volumes.push(volume);
							data.blockDevices.push(volume);
							if (volume.size)
								data.totalStorageGiB += volume.size;
						}
					}
				});
			}
		});

		// Fallback: extract volume IDs from text
		if (data.volumes.length === 0) {
			const volPattern = /\bvol-[a-f0-9]+\b/g;
			const volMatches = pageText.match(volPattern);
			if (volMatches) {
				data.volumes = [...new Set(volMatches)].map((id) => ({
					volumeId: id,
				}));
			}
		}

		return data;
	});
}

// Extract EC2 Tags tab
async function extractEC2TagsTab(frame) {
	return await frame.evaluate(() => {
		const tags = {};

		// Try to extract tags from table
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const rows = table.querySelectorAll("tr");
			rows.forEach((row) => {
				const cells = Array.from(row.querySelectorAll("td"));
				if (cells.length >= 2) {
					const key = cells[0].textContent?.trim();
					const value = cells[1].textContent?.trim();
					if (key && key !== "Key") {
						tags[key] = value || "";
					}
				}
			});
		});

		return tags;
	});
}

// Get region from current URL
async function getCurrentRegionFromUrl(page) {
	const url = page.url();
	const regionMatch = url.match(/region=([a-z]{2}-[a-z]+-\d)/);
	if (regionMatch) return regionMatch[1];

	const subdomainMatch = url.match(
		/([a-z]{2}-[a-z]+-\d)\.console\.aws\.amazon\.com/,
	);
	if (subdomainMatch) return subdomainMatch[1];

	return "us-east-1";
}

// Lightsail Instance extraction
async function extractLightsailInstances(page) {
	log("Navigating to Lightsail Console...", "progress");

	const region = options.region || "";
	const lightsailUrl = region
		? `https://lightsail.aws.amazon.com/ls/webapp/${region}/instances`
		: LIGHTSAIL_CONSOLE_URL;

	await page.goto(lightsailUrl, { waitUntil: "networkidle", timeout: 60000 });
	await page.waitForTimeout(3000);

	log("Extracting Lightsail instance list...", "progress");

	// Get list of instance names
	const instanceNames = await page.evaluate(() => {
		const names = [];
		// Look for instance cards/links
		const links = document.querySelectorAll('a[href*="/instances/"]');
		links.forEach((link) => {
			const href = link.getAttribute("href") || "";
			const match = href.match(/\/instances\/([^\/\?#]+)/);
			if (match && !names.includes(match[1])) {
				names.push(match[1]);
			}
		});
		return names;
	});

	log(`Found ${instanceNames.length} Lightsail instances`, "success");

	const instances = [];

	for (let i = 0; i < instanceNames.length; i++) {
		const instanceName = instanceNames[i];
		log(
			`Extracting details for ${instanceName} (${i + 1}/${instanceNames.length})...`,
			"progress",
		);

		try {
			const instanceData = await extractLightsailInstanceDetails(
				page,
				instanceName,
			);
			instances.push(instanceData);
			log(`Extracted ${instanceName}`, "success");
		} catch (e) {
			log(`Failed to extract ${instanceName}: ${e.message}`, "error");
			instances.push({ instanceName, error: e.message });
		}
	}

	return instances;
}

// Extract detailed Lightsail instance information
async function extractLightsailInstanceDetails(page, instanceName) {
	const region = options.region || (await getCurrentRegionFromUrl(page));
	const detailUrl = `https://lightsail.aws.amazon.com/ls/webapp/${region}/instances/${instanceName}/connect`;

	await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 60000 });
	await page.waitForTimeout(2000);

	const instanceData = {
		instanceName,
		service: "lightsail",
		extractedAt: new Date().toISOString(),
		connect: {},
		storage: {},
		networking: {},
		tags: {},
	};

	// Extract Connect tab (main info)
	instanceData.connect = await extractLightsailConnectTab(page);

	// Extract Storage tab
	await navigateToLightsailTab(page, instanceName, "storage");
	instanceData.storage = await extractLightsailStorageTab(page);

	// Extract Networking tab
	await navigateToLightsailTab(page, instanceName, "networking");
	instanceData.networking = await extractLightsailNetworkingTab(page);

	// Extract Tags tab
	await navigateToLightsailTab(page, instanceName, "tags");
	instanceData.tags = await extractLightsailTagsTab(page);

	return instanceData;
}

// Navigate to a Lightsail tab
async function navigateToLightsailTab(page, instanceName, tabName) {
	const region = options.region || (await getCurrentRegionFromUrl(page));
	const tabUrl = `https://lightsail.aws.amazon.com/ls/webapp/${region}/instances/${instanceName}/${tabName}`;
	await page.goto(tabUrl, { waitUntil: "networkidle", timeout: 60000 });
	await page.waitForTimeout(1500);
}

// Extract Lightsail Connect tab - comprehensive extraction
async function extractLightsailConnectTab(page) {
	return await page.evaluate(() => {
		const data = {};
		const pageText = document.body.textContent || "";

		// Helper to extract field by various methods
		const extractField = (patterns) => {
			for (const pattern of patterns) {
				const match = pageText.match(pattern);
				if (match) return match[1]?.trim();
			}
			return null;
		};

		// Extract IPs
		const publicIpMatch = pageText.match(
			/Public IP[:\s]+(\d+\.\d+\.\d+\.\d+)/i,
		);
		if (publicIpMatch) data.publicIp = publicIpMatch[1];

		const privateIpMatch = pageText.match(
			/Private IP[:\s]+(\d+\.\d+\.\d+\.\d+)/i,
		);
		if (privateIpMatch) data.privateIp = privateIpMatch[1];

		// Extract IPv6 if present
		const ipv6Match = pageText.match(/IPv6[:\s]+([a-fA-F0-9:]+)/i);
		if (ipv6Match) data.ipv6 = ipv6Match[1];

		// Extract state
		if (pageText.toLowerCase().includes("running")) data.state = "Running";
		else if (pageText.toLowerCase().includes("stopped"))
			data.state = "Stopped";
		else if (pageText.toLowerCase().includes("pending"))
			data.state = "Pending";
		else if (pageText.toLowerCase().includes("starting"))
			data.state = "Starting";
		else if (pageText.toLowerCase().includes("stopping"))
			data.state = "Stopping";

		// Extract region/zone
		const zoneMatch = pageText.match(/([a-z]{2}-[a-z]+-\d[a-z])/);
		if (zoneMatch) {
			data.availabilityZone = zoneMatch[1];
			data.region = zoneMatch[1].slice(0, -1); // Remove the AZ letter
		}

		// Extract SSH user
		const userMatch = pageText.match(
			/(?:SSH|Connect using)[^:]*:\s*([a-z_][a-z0-9_-]*)/i,
		);
		if (userMatch) data.sshUser = userMatch[1];

		// Fallback SSH user based on blueprint
		if (!data.sshUser) {
			if (pageText.toLowerCase().includes("ubuntu"))
				data.sshUser = "ubuntu";
			else if (pageText.toLowerCase().includes("debian"))
				data.sshUser = "admin";
			else if (pageText.toLowerCase().includes("amazon linux"))
				data.sshUser = "ec2-user";
			else if (pageText.toLowerCase().includes("centos"))
				data.sshUser = "centos";
			else data.sshUser = "admin";
		}

		// Extract blueprint/OS
		const blueprintPatterns = [
			/Blueprint[:\s]+([A-Za-z0-9_\-\s.]+?)(?:\s*\(|$)/i,
			/(Ubuntu|Debian|Amazon Linux|CentOS|Windows Server|WordPress|LAMP|Node\.js|Django|Plesk|cPanel|Magento|Joomla|Drupal|GitLab|Redmine|Nginx|Mean)[^\n]*/i,
		];
		for (const pattern of blueprintPatterns) {
			const match = pageText.match(pattern);
			if (match) {
				data.blueprint = match[1].trim();
				break;
			}
		}

		// Extract bundle/plan details
		const ramMatch = pageText.match(
			/(\d+(?:\.\d+)?)\s*GB\s*(?:RAM|Memory)/i,
		);
		if (ramMatch) data.ram = ramMatch[1] + " GB";

		const cpuMatch = pageText.match(/(\d+)\s*(?:vCPU|CPU|cores?)/i);
		if (cpuMatch) data.vcpu = cpuMatch[1];

		const storageMatch = pageText.match(
			/(\d+)\s*GB\s*(?:SSD|Storage|Disk)/i,
		);
		if (storageMatch) data.storage = storageMatch[1] + " GB SSD";

		const transferMatch = pageText.match(
			/(\d+(?:\.\d+)?)\s*TB\s*Transfer/i,
		);
		if (transferMatch) data.transfer = transferMatch[1] + " TB";

		// Extract bundle price (if visible)
		const priceMatch = pageText.match(
			/\$(\d+(?:\.\d+)?)\s*(?:\/month|USD)/i,
		);
		if (priceMatch) data.monthlyPrice = "$" + priceMatch[1];

		// Extract key pair name
		const keyMatch = pageText.match(
			/(?:SSH key|Key pair)[:\s]+([A-Za-z0-9_\-]+)/i,
		);
		if (keyMatch) data.sshKeyName = keyMatch[1];

		// Extract support code
		const supportMatch = pageText.match(
			/Support code[:\s]+([A-Za-z0-9\-\/]+)/i,
		);
		if (supportMatch) data.supportCode = supportMatch[1];

		// Extract created date
		const createdMatch = pageText.match(
			/Created[:\s]+([A-Za-z]+\s+\d+,?\s+\d{4}|\d{4}-\d{2}-\d{2})/i,
		);
		if (createdMatch) data.createdAt = createdMatch[1];

		return data;
	});
}

// Extract Lightsail Storage tab - comprehensive extraction
async function extractLightsailStorageTab(page) {
	return await page.evaluate(() => {
		const data = {
			systemDisk: null,
			systemDiskSize: null,
			systemDiskPath: null,
			additionalDisks: [],
			snapshots: [],
			automaticSnapshots: null,
			totalStorageGiB: 0,
		};

		const pageText = document.body.textContent || "";

		// Extract system disk info
		const systemDiskMatch = pageText.match(/System disk[:\s]+(\d+)\s*GB/i);
		if (systemDiskMatch) {
			data.systemDiskSize = parseInt(systemDiskMatch[1]);
			data.totalStorageGiB += data.systemDiskSize;
		}

		// Extract disk path
		const diskPathMatch = pageText.match(
			/(?:Mount|Path)[:\s]+(\/dev\/[a-z]+\d*|\/[a-z]+)/i,
		);
		if (diskPathMatch) data.systemDiskPath = diskPathMatch[1];

		// Extract automatic snapshots status
		if (pageText.toLowerCase().includes("automatic snapshots")) {
			if (pageText.toLowerCase().includes("enabled")) {
				data.automaticSnapshots = "Enabled";
			} else if (pageText.toLowerCase().includes("disabled")) {
				data.automaticSnapshots = "Disabled";
			}
		}

		// Extract additional disks from tables
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const rows = table.querySelectorAll("tr");
			rows.forEach((row) => {
				const cells = Array.from(row.querySelectorAll("td"));
				if (cells.length >= 2) {
					const rowText = row.textContent || "";
					const sizeMatch = rowText.match(/(\d+)\s*GB/i);
					const nameMatch = rowText.match(
						/([A-Za-z0-9\-_]+disk[A-Za-z0-9\-_]*)/i,
					);
					const pathMatch = rowText.match(/(\/dev\/[a-z]+\d*)/i);
					const statusMatch = rowText.match(
						/(attached|detached|available)/i,
					);

					if (sizeMatch && (nameMatch || pathMatch)) {
						const disk = {
							name: nameMatch ? nameMatch[1] : null,
							size: parseInt(sizeMatch[1]),
							path: pathMatch ? pathMatch[1] : null,
							status: statusMatch ? statusMatch[1] : null,
						};
						data.additionalDisks.push(disk);
						data.totalStorageGiB += disk.size;
					}
				}
			});
		});

		// Extract snapshots
		const snapshotMatches = pageText.match(/snapshot[s]?[:\s]+(\d+)/gi);
		if (snapshotMatches) {
			snapshotMatches.forEach((match) => {
				const count = match.match(/(\d+)/);
				if (count) data.snapshots.push({ count: parseInt(count[1]) });
			});
		}

		// Look for snapshot cards/items
		const snapshotItems = document.querySelectorAll(
			'[class*="snapshot"], [data-testid*="snapshot"]',
		);
		if (snapshotItems.length > 0) {
			data.snapshotCount = snapshotItems.length;
		}

		return data;
	});
}

// Extract Lightsail Networking tab - comprehensive extraction
async function extractLightsailNetworkingTab(page) {
	return await page.evaluate(() => {
		const data = {
			ipv4: {
				publicIp: null,
				privateIp: null,
				isStaticIp: false,
				staticIpName: null,
			},
			ipv6: {
				enabled: false,
				addresses: [],
			},
			firewallRules: {
				ipv4: [],
				ipv6: [],
			},
			loadBalancing: null,
			distribution: null,
		};

		const pageText = document.body.textContent || "";

		// Extract IPv4 addresses
		const ipv4Pattern =
			/\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
		const ipMatches = pageText.match(ipv4Pattern);
		if (ipMatches && ipMatches.length > 0) {
			// First non-private IP is likely public
			for (const ip of ipMatches) {
				if (
					!ip.startsWith("10.") &&
					!ip.startsWith("172.") &&
					!ip.startsWith("192.168") &&
					!ip.startsWith("127.")
				) {
					data.ipv4.publicIp = ip;
					break;
				}
			}
			// Find private IP
			for (const ip of ipMatches) {
				if (
					ip.startsWith("10.") ||
					ip.startsWith("172.") ||
					ip.startsWith("192.168")
				) {
					data.ipv4.privateIp = ip;
					break;
				}
			}
		}

		// Check for static IP
		if (pageText.toLowerCase().includes("static ip")) {
			data.ipv4.isStaticIp = true;
			const staticNameMatch = pageText.match(
				/Static IP[:\s]+([A-Za-z0-9\-_]+)/i,
			);
			if (staticNameMatch) data.ipv4.staticIpName = staticNameMatch[1];
		}

		// Extract IPv6
		if (pageText.toLowerCase().includes("ipv6")) {
			data.ipv6.enabled = true;
			const ipv6Pattern =
				/\b(?:[a-fA-F0-9]{1,4}:){2,7}[a-fA-F0-9]{1,4}\b/g;
			const ipv6Matches = pageText.match(ipv6Pattern);
			if (ipv6Matches) {
				data.ipv6.addresses = [...new Set(ipv6Matches)];
			}
		}

		// Extract firewall rules from tables
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const headerRow = table.querySelector("thead tr, tr:first-child");
			const headers = Array.from(
				headerRow?.querySelectorAll("th, td") || [],
			).map((h) => h.textContent?.toLowerCase().trim() || "");

			// Check if this is a firewall rules table
			const isFirewallTable = headers.some(
				(h) =>
					h.includes("application") ||
					h.includes("protocol") ||
					h.includes("port"),
			);

			if (isFirewallTable) {
				const rows = table.querySelectorAll(
					"tbody tr, tr:not(:first-child)",
				);
				rows.forEach((row) => {
					const cells = Array.from(row.querySelectorAll("td")).map(
						(c) => c.textContent?.trim() || "",
					);
					if (
						cells.length >= 2 &&
						!cells[0].toLowerCase().includes("no rules")
					) {
						const rule = {
							application: cells[0] || "Custom",
							protocol:
								cells.find((c) =>
									/^(TCP|UDP|ICMP|All)/i.test(c),
								) ||
								cells[1] ||
								"TCP",
							portRange:
								cells.find((c) =>
									/^(\d+(-\d+)?|All)$/i.test(c),
								) ||
								cells[2] ||
								"",
							restrictedTo:
								cells.find((c) => c.match(/[\d.:/]+|Any/i)) ||
								cells[3] ||
								"Any",
						};

						// Determine if IPv4 or IPv6 rule
						const rowText = row.textContent?.toLowerCase() || "";
						if (rowText.includes("ipv6")) {
							data.firewallRules.ipv6.push(rule);
						} else {
							data.firewallRules.ipv4.push(rule);
						}
					}
				});
			}
		});

		// Check for load balancer attachment
		if (pageText.toLowerCase().includes("load balancer")) {
			const lbMatch = pageText.match(
				/Load balancer[:\s]+([A-Za-z0-9\-_]+)/i,
			);
			data.loadBalancing = lbMatch ? lbMatch[1] : "Attached";
		}

		// Check for distribution attachment
		if (pageText.toLowerCase().includes("distribution")) {
			const distMatch = pageText.match(
				/Distribution[:\s]+([A-Za-z0-9\-_]+)/i,
			);
			data.distribution = distMatch ? distMatch[1] : "Attached";
		}

		return data;
	});
}

// Extract Lightsail Tags tab - comprehensive extraction
async function extractLightsailTagsTab(page) {
	return await page.evaluate(() => {
		const tags = {};
		const keyOnlyTags = [];

		// Try to extract tags from table
		const tables = document.querySelectorAll("table");
		tables.forEach((table) => {
			const headerRow = table.querySelector("thead tr, tr:first-child");
			const headers = Array.from(
				headerRow?.querySelectorAll("th, td") || [],
			).map((h) => h.textContent?.toLowerCase().trim() || "");

			const keyIndex = headers.findIndex(
				(h) => h === "key" || h.includes("tag key"),
			);
			const valueIndex = headers.findIndex(
				(h) => h === "value" || h.includes("tag value"),
			);

			const rows = table.querySelectorAll(
				"tbody tr, tr:not(:first-child)",
			);
			rows.forEach((row) => {
				const cells = Array.from(row.querySelectorAll("td"));
				if (cells.length >= 1) {
					const key =
						cells[
							keyIndex >= 0 ? keyIndex : 0
						]?.textContent?.trim();
					const value =
						cells[
							valueIndex >= 0 ? valueIndex : 1
						]?.textContent?.trim() || "";

					if (
						key &&
						key !== "Key" &&
						!key.toLowerCase().includes("no tags")
					) {
						if (value || valueIndex >= 0) {
							tags[key] = value;
						} else {
							keyOnlyTags.push(key);
						}
					}
				}
			});
		});

		// Also try to find key-value pairs outside tables
		const keyValuePairs = document.querySelectorAll(
			'[class*="key-value"], [class*="tag-"]',
		);
		keyValuePairs.forEach((pair) => {
			const keyEl = pair.querySelector('[class*="key"]');
			const valueEl = pair.querySelector('[class*="value"]');
			if (keyEl) {
				const key = keyEl.textContent?.trim();
				const value = valueEl?.textContent?.trim() || "";
				if (key && key.length < 128) {
					tags[key] = value;
				}
			}
		});

		// Find tag badges
		const tagBadges = document.querySelectorAll(
			'[class*="tag"], [class*="badge"], [class*="chip"]',
		);
		tagBadges.forEach((badge) => {
			const text = badge.textContent?.trim();
			if (
				text &&
				text.length < 50 &&
				!text.includes(":") &&
				!Object.keys(tags).includes(text)
			) {
				// Check if it looks like a tag (not a status or button)
				const classList = badge.className?.toLowerCase() || "";
				if (
					!classList.includes("status") &&
					!classList.includes("button") &&
					!classList.includes("btn")
				) {
					keyOnlyTags.push(text);
				}
			}
		});

		return {
			tags,
			keyOnlyTags: [...new Set(keyOnlyTags)],
		};
	});
}

// Export to CSV
function exportToCSV(data) {
	const rows = [];

	// Flatten data for CSV
	const flattenObject = (obj, prefix = "") => {
		const result = {};
		for (const [key, value] of Object.entries(obj)) {
			const newKey = prefix ? `${prefix}_${key}` : key;
			if (value && typeof value === "object" && !Array.isArray(value)) {
				Object.assign(result, flattenObject(value, newKey));
			} else if (Array.isArray(value)) {
				result[newKey] = value.join("; ");
			} else {
				result[newKey] = value ?? "";
			}
		}
		return result;
	};

	// Get all possible headers
	const allInstances = [...(data.ec2 || []), ...(data.lightsail || [])];
	const allKeys = new Set();
	const flatInstances = allInstances.map((instance) => {
		const flat = flattenObject(instance);
		Object.keys(flat).forEach((k) => allKeys.add(k));
		return flat;
	});

	const headers = Array.from(allKeys).sort();
	rows.push(headers.join(","));

	flatInstances.forEach((instance) => {
		const values = headers.map((h) => {
			const val = instance[h] ?? "";
			// Escape CSV values
			if (
				typeof val === "string" &&
				(val.includes(",") || val.includes('"') || val.includes("\n"))
			) {
				return `"${val.replace(/"/g, '""')}"`;
			}
			return val;
		});
		rows.push(values.join(","));
	});

	return rows.join("\n");
}

// Main execution
async function main() {
	console.log(chalk.bold.cyan("\n🚀 AWS Instance Fetcher CLI\n"));
	console.log(chalk.gray("─".repeat(50)));
	console.log(chalk.white(`Service: ${options.service}`));
	console.log(chalk.white(`Region: ${options.region || "default"}`));
	console.log(chalk.white(`Output: ${options.output}`));
	console.log(chalk.white(`Headless: ${options.headless}`));
	console.log(chalk.gray("─".repeat(50)) + "\n");

	const browser = await chromium.launch({
		headless: options.headless,
		args: ["--start-maximized"],
	});

	const context = await browser.newContext({
		viewport: null,
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	});

	const page = await context.newPage();

	try {
		log("Opening AWS Console...", "progress");
		await page.goto(AWS_CONSOLE_URL, {
			waitUntil: "networkidle",
			timeout: 60000,
		});

		// Wait for login
		await waitForLogin(page, parseInt(options.timeout));

		const results = {
			fetchedAt: new Date().toISOString(),
			region: options.region || "default",
			ec2: [],
			lightsail: [],
		};

		// Fetch EC2 instances
		if (options.service === "ec2" || options.service === "all") {
			results.ec2 = await extractEC2Instances(page);
		}

		// Fetch Lightsail instances
		if (options.service === "lightsail" || options.service === "all") {
			results.lightsail = await extractLightsailInstances(page);
		}

		// Write output
		const outputPath = path.resolve(options.output);
		const ext = path.extname(outputPath).toLowerCase();

		if (ext === ".csv") {
			fs.writeFileSync(outputPath, exportToCSV(results));
		} else {
			fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
		}

		log(`Results saved to ${outputPath}`, "success");

		// Summary
		console.log(chalk.bold.cyan("\n📊 Summary"));
		console.log(chalk.gray("─".repeat(50)));
		console.log(chalk.white(`EC2 Instances: ${results.ec2.length}`));
		console.log(
			chalk.white(`Lightsail Instances: ${results.lightsail.length}`),
		);
		console.log(
			chalk.white(
				`Total: ${results.ec2.length + results.lightsail.length}`,
			),
		);
		console.log(chalk.gray("─".repeat(50)) + "\n");
	} catch (error) {
		log(`Error: ${error.message}`, "error");
		if (options.debug) {
			console.error(error);
		}
		process.exit(1);
	} finally {
		await browser.close();
		log("Browser closed", "info");
	}
}

main().catch(console.error);
