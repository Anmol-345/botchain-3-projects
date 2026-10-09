const fs = require('fs');
const solc = require('solc');

const source = fs.readFileSync('AskaS.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'AskaS.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) console.error('Compiler output:', JSON.stringify(output.errors, null, 2));
const contract = output.contracts && output.contracts['AskaS.sol'] && output.contracts['AskaS.sol'].AskaS;
if (!contract || contract.evm.bytecode.object.length === 0) {
  console.error('Compilation failed');
  process.exit(1);
}
fs.writeFileSync('AskaS.abi', JSON.stringify(contract.abi, null, 2));
fs.writeFileSync('AskaS.bin', '0x' + contract.evm.bytecode.object);
console.log('Compiled AskaS.sol');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
