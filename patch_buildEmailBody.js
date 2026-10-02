const fs = require('fs');

let content = fs.readFileSync('content_script_common.js', 'utf8');

// 1. Update signature
content = content.replace(
    /window\.awsExtension\.buildEmailBody = function \(\s*details,\s*accountInfo = \{\},\s*compact = false,\s*\) \{/,
    'window.awsExtension.buildEmailBody = function (details, accountInfo = {}, compact = false, options = {}) {'
);

// 2. Add includeSection helper
content = content.replace(
    /const SEP = compact \? SEPARATOR_SHORT : SEPARATOR_FULL;\s*/,
    'const SEP = compact ? SEPARATOR_SHORT : SEPARATOR_FULL;\n\t\tconst include = (key) => options[key] !== false;\n\n'
);

// 3. Wrap sections
content = content.replace(
    /\/\/ Account Information\n\t\tlines\.push\(""\);\n\t\tlines\.push\("🏢 ACCOUNT INFORMATION"\);/,
    '// Account Information\n\t\tif (include("account")) {\n\t\tlines.push("");\n\t\tlines.push("🏢 ACCOUNT INFORMATION");'
);
content = content.replace(
    /\/\/ Instance Basic Details/,
    '\t\t}\n\n\t\t// Instance Basic Details\n\t\tif (include("overview")) {'
);
content = content.replace(
    /\/\/ AMI \/ Blueprint Information \(EC2\)/,
    '\t\t}\n\n\t\t// AMI / Blueprint Information (EC2)\n\t\tif (include("ami")) {'
);
content = content.replace(
    /\/\/ Operating System/,
    '\t\t}\n\n\t\t// Operating System\n\t\tif (include("os")) {'
);
content = content.replace(
    /\/\/ CPU & Hardware \(EC2\)/,
    '\t\t}\n\n\t\t// CPU & Hardware (EC2)\n\t\tif (include("hardware")) {'
);
content = content.replace(
    /\/\/ Storage Configuration/,
    '\t\t}\n\n\t\t// Storage Configuration\n\t\tif (include("storage")) {'
);
content = content.replace(
    /\/\/ Network Configuration with comprehensive IPv4\/IPv6 support/,
    '\t\t}\n\n\t\t// Network Configuration with comprehensive IPv4/IPv6 support\n\t\tif (include("network")) {'
);
content = content.replace(
    /\/\/ IAM & Permissions \(EC2\)/,
    '\t\t}\n\n\t\t// IAM & Permissions (EC2)\n\t\tif (include("iam")) {'
);
content = content.replace(
    /\/\/ Monitoring & Maintenance \(EC2\)/,
    '\t\t}\n\n\t\t// Monitoring & Maintenance (EC2)\n\t\tif (include("monitoring")) {'
);
content = content.replace(
    /\/\/ Metadata Options \(EC2\)/,
    '\t\t}\n\n\t\t// Metadata Options (EC2)\n\t\tif (include("metadata")) {'
);
content = content.replace(
    /\/\/ Security Information with enhanced firewall details/,
    '\t\t}\n\n\t\t// Security Information with enhanced firewall details\n\t\tif (include("security")) {'
);
content = content.replace(
    /\/\/ Tags Information/,
    '\t\t}\n\n\t\t// Tags Information\n\t\tif (include("tags")) {'
);
content = content.replace(
    /\/\/ End of details\n\t\tlines\.push\(""\);/,
    '\t\t}\n\n\t\t// End of details\n\t\tlines.push("");'
);

fs.writeFileSync('content_script_common.js', content);
