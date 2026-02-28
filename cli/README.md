# AWS Instance Fetcher CLI

A CLI tool that uses Playwright to fetch full EC2 and Lightsail instance details from AWS Console.

## Features

- Fetches comprehensive EC2 instance details (all tabs: Details, Security, Networking, Storage, Tags)
- Fetches comprehensive Lightsail instance details (all tabs: Connect, Storage, Networking, Tags)
- Supports JSON and CSV output formats
- Interactive login (waits for you to log in manually)
- Region selection support
- Debug mode for troubleshooting

## Installation

```bash
cd cli
npm install
npx playwright install chromium
```

## Usage

```bash
# Fetch all instances (EC2 + Lightsail)
npm start

# Fetch only EC2 instances
npm run fetch:ec2

# Fetch only Lightsail instances
npm run fetch:lightsail

# With options
node index.js --service ec2 --region us-east-1 --output my-instances.json

# CSV output
node index.js --service all --output instances.csv
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --service <type>` | Service to fetch: `ec2`, `lightsail`, or `all` | `all` |
| `-r, --region <region>` | AWS region (e.g., `us-east-1`) | default |
| `-o, --output <file>` | Output file path (JSON or CSV based on extension) | `aws-instances.json` |
| `-t, --timeout <seconds>` | Login timeout in seconds | `300` |
| `--headless` | Run in headless mode (not recommended for login) | `false` |
| `--debug` | Enable debug mode with verbose logging | `false` |

## How It Works

1. Opens a Chromium browser window
2. Navigates to AWS Console
3. **Waits for you to log in** (you have 5 minutes by default)
4. Once logged in, navigates to EC2/Lightsail console
5. Extracts instance list
6. For each instance, navigates to detail page and extracts all tab data
7. Saves results to JSON or CSV file

## Output Format

### JSON Output

```json
{
  "fetchedAt": "2026-02-28T10:00:00.000Z",
  "region": "us-east-1",
  "ec2": [
    {
      "instanceId": "i-0123456789abcdef0",
      "service": "ec2",
      "extractedAt": "2026-02-28T10:01:00.000Z",
      "details": {
        "instanceId": "i-0123456789abcdef0",
        "instanceState": "running",
        "instanceType": "t3.medium",
        "availabilityZone": "us-east-1a",
        "publicIpv4": "54.123.45.67",
        "privateIpv4": "10.0.1.100",
        "vpcId": "vpc-12345678",
        "subnetId": "subnet-12345678",
        "keyPair": "my-key",
        "iamRole": "EC2Role",
        "launchTime": "2026-01-15T08:30:00.000Z",
        "amiId": "ami-12345678",
        "name": "web-server-01"
      },
      "security": {
        "securityGroups": ["sg-12345678"],
        "inboundRules": [...],
        "outboundRules": [...]
      },
      "networking": {
        "networkInterfaces": ["eni-12345678"],
        "elasticIps": [],
        "ipAddresses": ["54.123.45.67", "10.0.1.100"]
      },
      "storage": {
        "volumes": [{"volumeId": "vol-12345678", "size": 30, "type": "gp3"}],
        "totalStorage": 30
      },
      "tags": {
        "Name": "web-server-01",
        "Environment": "production"
      }
    }
  ],
  "lightsail": [
    {
      "instanceName": "my-lightsail-instance",
      "service": "lightsail",
      "extractedAt": "2026-02-28T10:02:00.000Z",
      "connect": {
        "publicIp": "3.123.45.67",
        "privateIp": "172.26.1.100",
        "state": "Running",
        "availabilityZone": "us-east-1a",
        "blueprint": "Ubuntu 22.04",
        "ram": "2 GB",
        "vcpu": "1",
        "storage": "60 GB SSD"
      },
      "storage": {...},
      "networking": {...},
      "tags": {...}
    }
  ]
}
```

## Troubleshooting

### Login Timeout

If you need more time to log in, increase the timeout:

```bash
node index.js --timeout 600
```

### Debug Mode

Enable verbose logging to troubleshoot issues:

```bash
node index.js --debug
```

### Browser Not Opening

Make sure Playwright browsers are installed:

```bash
npx playwright install chromium
```

## Requirements

- Node.js 18+
- Chromium (installed via Playwright)
