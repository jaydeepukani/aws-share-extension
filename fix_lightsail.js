const fs = require('fs');
let code = fs.readFileSync('content_script_lightsail.js', 'utf8');

code = code.replace(
    '</svg>',
    '</svg><span style="font-weight: bold; margin-left: 6px;">Share Details</span>'
);

code = code.replace(
    'padding: 12px 16px 12px 20px;',
    'padding: 16px 24px;'
);

fs.writeFileSync('content_script_lightsail.js', code);
console.log('Fixed Lightsail');
