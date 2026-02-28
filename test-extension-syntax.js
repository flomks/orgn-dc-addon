#!/usr/bin/env node
/**
 * Test script to verify extension syntax and basic functionality
 */

const fs = require('fs');
const path = require('path');

console.log('Testing extension syntax...\n');

// Test files to check
const testFiles = [
  'extension/popup.js',
  'extension/background.js',
  'extension/content.js'
];

let allPassed = true;

testFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${filePath} - File not found`);
    allPassed = false;
    return;
  }
  
  try {
    // Test syntax by trying to parse the file
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Basic syntax check using Node.js parser
    const vm = require('vm');
    new vm.Script(content, { filename: filePath });
    
    // Check for potential duplicate const declarations
    const lines = content.split('\n');
    const constDeclarations = {};
    let currentFunction = null;
    let braceLevel = 0;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // Track function scope
      if (trimmed.includes('function') || trimmed.includes('=>') || trimmed.includes('async ')) {
        if (trimmed.includes('{')) {
          currentFunction = `function_${lineNum}`;
          braceLevel = 1;
        }
      }
      
      // Track braces for scope
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceLevel += openBraces - closeBraces;
      
      if (braceLevel <= 0) {
        currentFunction = null;
        braceLevel = 0;
      }
      
      // Check for const declarations
      const constMatch = trimmed.match(/^const\s+(\w+)/);
      if (constMatch) {
        const varName = constMatch[1];
        const scope = currentFunction || 'global';
        
        if (!constDeclarations[scope]) {
          constDeclarations[scope] = {};
        }
        
        if (constDeclarations[scope][varName]) {
          console.log(`❌ ${filePath}:${lineNum} - Duplicate const declaration: ${varName}`);
          console.log(`   Previous declaration at line ${constDeclarations[scope][varName]}`);
          allPassed = false;
        } else {
          constDeclarations[scope][varName] = lineNum;
        }
      }
    });
    
    console.log(`✅ ${filePath} - Syntax OK`);
    
  } catch (error) {
    console.log(`❌ ${filePath} - Syntax Error:`);
    console.log(`   ${error.message}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All extension files passed syntax checks');
  process.exit(0);
} else {
  console.log('❌ Some extension files have syntax errors');
  process.exit(1);
}