const fs = require('fs');
const solc = require('solc');

const source = fs.readFileSync('OnchainTrivia.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'OnchainTrivia.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) console.error('Compiler output:', JSON.stringify(output.errors, null, 2));
const contract = output.contracts && output.contracts['OnchainTrivia.sol'] && output.contracts['OnchainTrivia.sol'].OnchainTrivia;
if (!contract || contract.evm.bytecode.object.length === 0) {
  console.error('Compilation failed');
  process.exit(1);
}
fs.writeFileSync('OnchainTrivia.abi', JSON.stringify(contract.abi, null, 2));
fs.writeFileSync('OnchainTrivia.bin', '0x' + contract.evm.bytecode.object);
console.log('Compiled OnchainTrivia.sol');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
