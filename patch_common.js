const fs = require('fs');

let content = fs.readFileSync('content_script_common.js', 'utf8');

// Update buildEmailBody signature and logic
content = content.replace(
    /window\.awsExtension\.buildEmailBody = function \(\s*details,\s*accountInfo = \{\},\s*compact = false,\s*\) {/g,
    'window.awsExtension.buildEmailBody = function (details, accountInfo = {}, compact = false, options = {}) {'
);

// We need to replace the exact signature of buildEmailBody
content = content.replace(
    /window\.awsExtension\.buildEmailBody = function \(\n\s*details,\n\s*accountInfo = \{\},\n\s*compact = false,\n\s*\) \{/m,
    'window.awsExtension.buildEmailBody = function (details, accountInfo = {}, compact = false, options = {}) {'
);

// Actually, let's just use string replacement on the file
