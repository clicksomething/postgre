const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'linearProgrammingAssignmentService.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix constraint types
content = content.replace(/type: 'fx'/g, "type: 1");
content = content.replace(/type: 'up'/g, "type: 2");
content = content.replace(/type: 'lb'/g, "type: 3");
content = content.replace(/type: 'db'/g, "type: 4");

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed all constraint types in linearProgrammingAssignmentService.js'); 