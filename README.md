# 🚀 AWS Instance Share Extension

A powerful Chrome extension that adds floating share buttons to AWS EC2 and Lightsail instances, allowing you to quickly share comprehensive instance details via email with beautiful formatting.

## ✨ Features

-   **Floating Share Buttons**: Orange-styled floating buttons for consistent access across all AWS pages
-   **Complete Firewall Extraction**: Accurately extracts all IPv4 and IPv6 firewall rules including port ranges
-   **Beautiful Email Format**: Rich, organized email templates with emojis and sections
-   **Comprehensive Details**: Includes instance ID, name, IPs, security groups, VPC, OS, and complete networking configuration
-   **Multiple Email Clients**: Support for Outlook Web, Gmail, and default mail apps
-   **No Pre-filled Recipients**: Opens compose window without recipients for maximum flexibility
-   **Smart Detection**: Automatically detects instances across different AWS console layouts
-   **Dynamic CSS Handling**: Works with AWS's dynamic CSS classes and layout changes
-   **Visual Feedback**: Loading states, hover effects, and button highlighting
-   **Privacy First**: All processing happens locally - no external servers - no recipient data stored

## 🔧 Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Configure your settings by clicking the extension icon or right-clicking it

## ⚙️ Configuration

### Settings Options:

-   **Email Composer**: Choose between Outlook Web, Gmail, or default mail app

### To Configure:

1. Click the extension icon in your toolbar to open the popup
2. Select your preferred email composer
3. Click "Save Settings"
4. Use "Test" to verify configuration

## 🎯 Usage

### Basic Usage:

1. Navigate to AWS EC2 or Lightsail console
2. Look for orange floating "Share" buttons (positioned on the left for EC2, right for Lightsail)
3. Click any floating share button to generate a detailed email
4. The email will open in your configured email client with pre-filled content including complete firewall rules
5. Add recipients, review content, and click send

### Advanced Features:

-   **Floating Button Design**: Always-visible floating buttons with orange styling and tilt animations
-   **Complete Firewall Data**: Extracts all configured firewall rules for both IPv4 and IPv6, including port ranges and custom rules
-   **Dynamic CSS Handling**: Adapts to AWS's changing CSS classes and layout updates automatically
-   **Button Highlighting**: Click the extension icon while on AWS console to highlight all share buttons
-   **Automatic Detection**: Works across different AWS console layouts and updates
-   **Rich Information**: Automatically extracts instance details, network config, and complete security settings

## 📧 Email Format

The extension generates beautifully formatted emails including:

### 🏢 Account Information

-   Account ID and name
-   Region information
-   Contact details

### 💻 Instance Overview

-   Instance ID and name
-   Instance type and state
-   Availability zone

### 🌐 Network Configuration

-   Public and private IP addresses
-   VPC ID and network details

### 🔒 Security Configuration

-   Security group IDs and policies
-   Complete IPv4 firewall rules with port ranges
-   Complete IPv6 firewall rules with port ranges
-   Application-specific security settings
-   Connection restrictions and IP allowlists

### 🔗 Quick Access

-   Direct AWS console links
-   SSH connection examples

## 🛡️ Privacy & Security

-   **No External Servers**: All processing happens locally in your browser
-   **Read-Only Access**: Only reads information visible in your AWS console
-   **No Data Storage**: Instance data is not stored or transmitted anywhere
-   **No Recipient Storage**: Email recipients are not stored - you add them each time
-   **Secure by Design**: Uses Chrome's built-in security features

## 🌟 Supported AWS Services

-   **EC2 Instances**: Full support for all EC2 instance types
-   **Lightsail Instances**: Complete Lightsail integration
-   **Multiple Regions**: Works across all AWS regions
-   **Various Layouts**: Adapts to different console UI updates

## 🔄 Browser Compatibility

-   Chrome (Manifest V3)
-   Edge (Chromium-based)
-   Other Chromium-based browsers

## 🐛 Troubleshooting

### Floating Share Buttons Not Appearing?

1. Refresh the AWS console page and wait for complete loading
2. Look for orange floating buttons: left side for EC2, right side for Lightsail
3. Check browser console for EC2/Lightsail service detection messages
4. Click the extension icon to highlight existing buttons
5. Ensure you're on an EC2 instance details page or Lightsail instance page
6. Try navigating to a different instance and back

### Email Not Opening?

1. Verify your email configuration in settings
2. Test with the "Test Email" button
3. Check your browser's popup blocker settings
4. Ensure your email client is accessible

### Missing Instance Details?

-   Some details may not be available depending on AWS console layout
-   Try clicking on the instance to load more details, then share
-   Different instance states may show different information

## 📝 Development

### File Structure:

```
aws-share-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content_script.js      # Main functionality
├── aws-utils.js          # AWS service utilities
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── icons/               # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md           # Documentation
└── INSTALL.md          # Installation guide
```

### Key Technologies:

-   Chrome Extension Manifest V3
-   JavaScript ES6+
-   CSS3 with modern features
-   Chrome Storage API
-   Chrome Notifications API

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is open source. Use and modify as needed.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review your extension settings
3. Try reloading the AWS console page
4. Create an issue with detailed information about your problem

---

**Made with ❤️ for AWS users who need to share instance details quickly and professionally.**
