const fs = require('fs');
let code = fs.readFileSync('content_script_ec2.js', 'utf8');

code = code.replace(
    'document.body.appendChild(button);',
    `let activeDoc = document;
		const computeIframe = document.getElementById("compute-react-frame");
		if (computeIframe && computeIframe.contentDocument) {
			activeDoc = computeIframe.contentDocument;
		}
		activeDoc.body.appendChild(button);`
);

fs.writeFileSync('content_script_ec2.js', code);
console.log('Fixed');
