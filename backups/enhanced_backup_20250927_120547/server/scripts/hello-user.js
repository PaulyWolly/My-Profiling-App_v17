#!/usr/bin/env node

// hello-user.js
const readline = require('readline');

// If a name is provided as a command-line argument, use it
const nameArg = process.argv[2];

function greet(name) {
  console.log(`Hello ${name}`);
}

if (nameArg) {
  greet(nameArg);
  process.exit(0);
}

// Otherwise, prompt for input (CLI usage)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('What is your name? ', (name) => {
  greet(name);
  rl.close();
}); 